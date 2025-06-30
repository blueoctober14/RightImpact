import re
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime
import logging

# Import models from their respective modules to avoid circular imports
from models.targets.target_list import TargetList
from models.targets.target_contact import TargetContact
from models.shared_contact import SharedContact
from models.contact_match import ContactMatch

logger = logging.getLogger(__name__)

def clean_phone_number(phone: Optional[str]) -> Optional[str]:
    """
    Clean and standardize phone number to 10 digits.
    Handles various formats including:
    - (123) 456-7890
    - 123-456-7890
    - 123.456.7890
    - 1234567890
    - +1 (123) 456-7890
    - 1-123-456-7890
    """
    if not phone:
        return None
        
    logger.debug(f"Cleaning phone number: {phone}")
    
    try:
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', str(phone))
        
        # If empty after cleaning, return None
        if not digits:
            logger.debug("No digits found in phone number")
            return None
            
        # Remove leading 1 (US country code) if present and length is 11
        if len(digits) == 11 and digits[0] == '1':
            digits = digits[1:]
            logger.debug(f"Removed US country code, remaining: {digits}")
        
        # Check if we have exactly 10 digits
        if len(digits) != 10:
            logger.debug(f"Invalid length: {len(digits)} digits (expected 10)")
            return None
            
        logger.debug(f"Cleaned phone number: {digits}")
        return digits
        
    except Exception as e:
        logger.error(f"Error cleaning phone number '{phone}': {str(e)}")
        return None

def get_shared_contact_phones(shared_contact: Any) -> List[str]:
    """Get all valid phone numbers from a shared contact"""
    logger.info(f"Getting phone numbers for shared contact ID {shared_contact.id}")
    
    phones = []
    
    def process_phone(phone: Optional[str], field_name: str) -> Optional[str]:
        if not phone:
            logger.debug(f"  {field_name}: No phone number")
            return None
            
        logger.debug(f"  {field_name} (raw): {phone}")
        cleaned = clean_phone_number(phone)
        logger.debug(f"  {field_name} (cleaned): {cleaned}")
        return cleaned
    
    # Process each phone number field
    if phone := process_phone(shared_contact.mobile1, "mobile1"):
        phones.append(phone)
    if phone := process_phone(shared_contact.mobile2, "mobile2"):
        phones.append(phone)
    if phone := process_phone(shared_contact.mobile3, "mobile3"):
        phones.append(phone)
    
    logger.info(f"Found {len(phones)} valid phone numbers for shared contact {shared_contact.id}")
    return phones

def find_phone_matches(db: Session, phone_numbers: List[str], target_list_id: int) -> List[Dict[str, Any]]:
    """
    Find target contacts with matching phone numbers in the specified list.
    Returns a list of dictionaries containing the contact data.
    """
    if not phone_numbers:
        return []
        
    logger.info(f"Searching for phone matches in list {target_list_id} for numbers: {phone_numbers}")
    
    # Build OR conditions for each phone number in each phone field
    conditions = []
    for phone in phone_numbers:
        # Check all possible phone number fields with the correct field names
        phone_conditions = [
            # Cell phone fields
            TargetContact.cell_1 == phone,
            TargetContact.cell_2 == phone,
            TargetContact.cell_3 == phone,
            # Landline fields
            TargetContact.landline_1 == phone,
            TargetContact.landline_2 == phone,
            TargetContact.landline_3 == phone,
            # Also check for phone numbers with country code
            TargetContact.cell_1 == f'1{phone}',
            TargetContact.cell_2 == f'1{phone}',
            TargetContact.cell_3 == f'1{phone}',
            TargetContact.landline_1 == f'1{phone}',
            TargetContact.landline_2 == f'1{phone}',
            TargetContact.landline_3 == f'1{phone}'
        ]
        
        # Add all conditions with OR between them
        conditions.append(or_(*phone_conditions))
    
    # Create the query with list_id filter and all phone conditions
    query = (
        db.query(TargetContact)
        .filter(TargetContact.list_id == target_list_id)
        .filter(or_(*conditions))
    )
    
    # Log the SQL query for debugging
    logger.info(f"SQL Query: {str(query.statement.compile(compile_kwargs={"literal_binds": True}))}")
    
    # Execute the query and convert to dictionaries immediately
    matches = []
    for contact in query.all():
        try:
            match_dict = {
                'id': contact.id,
                'voter_id': contact.voter_id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'cell_1': contact.cell_1,
                'cell_2': contact.cell_2,
                'cell_3': contact.cell_3,
                'landline_1': contact.landline_1,
                'landline_2': contact.landline_2,
                'landline_3': contact.landline_3,
                'email': contact.email,
                'list_id': contact.list_id,
                'is_matched': contact.is_matched,
                'match_confidence': contact.match_confidence,
                'match_score': contact.match_score
            }
            matches.append(match_dict)
            
            logger.info(f"Match: ID={contact.id}, VoterID={contact.voter_id}, "
                      f"Cells: {contact.cell_1}, {contact.cell_2}, {contact.cell_3}, "
                      f"Landlines: {contact.landline_1}, {contact.landline_2}, {contact.landline_3}")
        except Exception as e:
            logger.error(f"Error processing contact {getattr(contact, 'id', 'unknown')}: {str(e)}")
            continue
    
    logger.info(f"Found {len(matches)} potential matches in list {target_list_id}")
    return matches

def disambiguate_by_name(contacts: List[Dict[str, Any]], first_name: str, last_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Disambiguate between multiple contact matches by comparing names.
    Returns a list of contacts that have matching names, or the original list if no name matches.
    """
    if not contacts or len(contacts) <= 1:
        return contacts
        
    logger.info(f"Disambiguating {len(contacts)} contacts by name. First: '{first_name}', Last: '{last_name}'")
    
    # Normalize the search names
    search_first = (first_name or '').lower().strip()
    search_last = (last_name or '').lower().strip()
    
    # If we don't have at least a first name to match on, return all
    if not search_first:
        logger.info("No first name provided for disambiguation, returning all matches")
        return contacts
    
    # First, try to find exact matches on both first and last name
    if search_last:
        exact_matches = [
            c for c in contacts 
            if (c.get('first_name', '') or '').lower() == search_first 
            and (c.get('last_name', '') or '').lower() == search_last
        ]
        if exact_matches:
            logger.info(f"Found {len(exact_matches)} exact name matches")
            return exact_matches
    
    # Then try just first name matches
    first_name_matches = [
        c for c in contacts 
        if (c.get('first_name', '') or '').lower() == search_first
    ]
    
    if first_name_matches:
        logger.info(f"Found {len(first_name_matches)} first name matches")
        return first_name_matches
    
    # If no matches found, return the original list
    logger.info("No name matches found, returning original list")
    return contacts

def match_contact_to_lists(db: Session, shared_contact_id: int, target_list_id: Optional[int] = None):
    """
    Match a single shared contact against target lists
    
    Args:
        db: Database session
        shared_contact_id: ID of the shared contact to match
        target_list_id: Optional ID of a specific target list to match against.
                      If None, matches against all target lists.
        
    Returns:
        List of ContactMatch objects created
    """
    logger.info(f"Starting match process for shared contact {shared_contact_id} "
                f"against target list {target_list_id or 'all'}")
    
    try:
        # Start a new transaction
        with db.begin():
            # Get the shared contact with a fresh query in the new transaction
            shared_contact = db.query(SharedContact).get(shared_contact_id)
            if not shared_contact:
                logger.error(f"Shared contact {shared_contact_id} not found")
                return []
            
            # Get all phone numbers for the shared contact
            shared_phones = get_shared_contact_phones(shared_contact)
            if not shared_phones:
                logger.info(f"No valid phone numbers found for shared contact {shared_contact_id}")
                return []
            
            logger.info(f"Found {len(shared_phones)} phone numbers for shared contact {shared_contact_id}: {shared_phones}")
            
            # Get target lists to check
            target_lists_query = db.query(TargetList)
            if target_list_id is not None:
                target_lists_query = target_lists_query.filter(TargetList.id == target_list_id)
                
            target_lists = target_lists_query.all()
            
            if not target_lists:
                list_msg = f"target list {target_list_id}" if target_list_id else "any target lists"
                logger.info(f"No {list_msg} found")
                return []
            
            logger.info(f"Found {len(target_lists)} target lists to check")
            
            matches = []
            
            for target_list in target_lists:
                logger.info(f"Checking target list ID {target_list.id} - {target_list.name}")
                
                # Find all target contacts in this list that match any of the shared contact's phone numbers
                matched_contacts = find_phone_matches(db, shared_phones, target_list.id)
                logger.info(f"Found {len(matched_contacts)} potential matches in list {target_list.id}")
                
                # If multiple matches, try to disambiguate by name
                if len(matched_contacts) > 1:
                    logger.info("Multiple matches found, attempting to disambiguate by name")
                    matched_contacts = disambiguate_by_name(
                        matched_contacts, 
                        shared_contact.first_name,
                        shared_contact.last_name
                    )
                    logger.info(f"After disambiguation, {len(matched_contacts)} matches remain")
                
                # If we have a single match, create a ContactMatch record
                if len(matched_contacts) == 1:
                    target_contact_data = matched_contacts[0]
                    logger.info(f"Creating match with target contact ID {target_contact_data['id']} in list {target_list.id}")
                    
                    # Get the target contact from the database to update it
                    target_contact = db.query(TargetContact).get(target_contact_data['id'])
                    if not target_contact:
                        logger.error(f"Target contact {target_contact_data['id']} not found in database")
                        continue
                    
                    match = ContactMatch(
                        shared_contact_id=shared_contact_id,
                        target_contact_id=target_contact.id,
                        target_list_id=target_list.id,
                        match_confidence='high' if len(shared_phones) == 1 else 'medium',
                        created_at=datetime.utcnow()
                    )
                    matches.append(match)
                    
                    # Update the target contact's match status
                    target_contact.is_matched = True
                    target_contact.match_confidence = 'high' if len(shared_phones) == 1 else 'medium'
                    target_contact.match_score = 1.0 if len(shared_phones) == 1 else 0.8
                    
                    # Explicitly add the target contact to the session
                    db.add(target_contact)
                    
                    logger.info(f"Successfully matched shared contact {shared_contact_id} to target contact {target_contact.id}")
            
            # Save all matches and update status
            if matches:
                try:
                    db.add_all(matches)
                    shared_contact.matched = True
                    db.add(shared_contact)
                    logger.info(f"Successfully saved {len(matches)} matches for shared contact {shared_contact_id}")
                    return matches
                except Exception as e:
                    logger.error(f"Error saving matches: {str(e)}")
                    raise
            
            return matches
            
    except Exception as e:
        logger.error(f"Error in match_contact_to_lists: {str(e)}", exc_info=True)
        raise
                
    except Exception as e:
        logger.error(f"Error in match_contact_to_lists: {str(e)}")
        db.rollback()
        raise

def match_new_shared_contacts(db: Session, shared_contact_ids: List[int], list_ids: Optional[List[int]] = None):
    """
    Match newly shared contacts against target lists with optional filtering
    
    Args:
        db: Database session
        shared_contact_ids: List of shared contact IDs to match
        list_ids: Optional list of target list IDs to match against. If None, matches against all lists.
        
    Returns:
        Dictionary with count of matches created and any errors encountered
    """
    match_count = 0
    processed_contacts = 0
    errors = []
    
    logger.info(f"Matching {len(shared_contact_ids)} shared contacts against "
                f"{'all target lists' if not list_ids else f'{len(list_ids)} selected lists'}")
    
    # If list_ids are provided, match each contact against each specified list
    if list_ids:
        for contact_id in shared_contact_ids:
            try:
                logger.info(f"Matching shared contact ID: {contact_id}")
                list_matches = 0
                
                # Match against each specified list
                for list_id in list_ids:
                    try:
                        logger.debug(f"Matching contact {contact_id} against list {list_id}")
                        matches = match_contact_to_lists(db, contact_id, list_id)
                        list_matches += len(matches)
                    except Exception as e:
                        error_msg = f"Error matching shared contact {contact_id} to list {list_id}: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
                        continue
                
                match_count += list_matches
                processed_contacts += 1
                logger.info(f"Matched shared contact {contact_id}: {list_matches} matches found across {len(list_ids)} lists")
                
            except Exception as e:
                error_msg = f"Error processing shared contact {contact_id}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
    else:
        # Original behavior - match against all lists
        for contact_id in shared_contact_ids:
            try:
                logger.info(f"Processing shared contact ID: {contact_id}")
                matches = match_contact_to_lists(db, contact_id)
                match_count += len(matches)
                processed_contacts += 1
                logger.info(f"Processed shared contact {contact_id}: {len(matches)} matches found")
            except Exception as e:
                error_msg = f"Error processing shared contact {contact_id}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                continue
    
    # Commit any remaining changes
    try:
        db.commit()
    except Exception as e:
        error_msg = f"Error committing changes: {str(e)}"
        logger.error(error_msg)
        errors.append(error_msg)
        db.rollback()
    
    return {
        "processed_contacts": processed_contacts,
        "total_contacts": len(shared_contact_ids),
        "matches_created": match_count,
        "lists_matched": list_ids if list_ids else "all",
        "success": len(errors) == 0,
        "errors": errors if errors else None
    }

def match_new_target_list(db: Session, target_list_id: int):
    """
    Match all shared contacts against a new target list
    
    Args:
        db: Database session
        target_list_id: ID of the target list to match against
        
    Returns:
        Dictionary with count of matches created and any errors encountered
    """
    from .models import SharedContact, TargetList
    
    try:
        # Start a new transaction
        with db.begin():
            # Verify target list exists with a fresh query
            target_list = db.query(TargetList).get(target_list_id)
            if not target_list:
                raise ValueError(f"Target list {target_list_id} not found")
            
            logger.info(f"Matching shared contacts against target list: {target_list.name} (ID: {target_list_id})")
            
            # Get all shared contacts that haven't been matched to this list yet
            shared_contacts = db.query(SharedContact).filter(
                ~SharedContact.id.in_(
                    db.query(ContactMatch.shared_contact_id)
                    .filter(ContactMatch.target_list_id == target_list_id)
                )
            ).all()
            
            if not shared_contacts:
                logger.info("No unmatched shared contacts found")
                return {
                    "matched_contacts": 0,
                    "matches_created": 0,
                    "success": True,
                    "message": "No unmatched shared contacts found"
                }
            
            logger.info(f"Found {len(shared_contacts)} shared contacts to match against target list {target_list_id}")
            
            match_count = 0
            processed_contacts = 0
            errors = []
            
            for contact in shared_contacts:
                try:
                    logger.info(f"Matching shared contact ID: {contact.id} against target list {target_list_id}")
                    # Only match against the specified target list
                    matches = match_contact_to_lists(db, contact.id, target_list_id)
                    match_count += len(matches)
                    processed_contacts += 1
                    logger.info(f"Matched shared contact {contact.id}: {len(matches)} matches found")
                except Exception as e:
                    error_msg = f"Error matching shared contact {contact.id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    continue
            
            # Commit any remaining changes
            try:
                db.commit()
                logger.info(f"Successfully processed {processed_contacts} shared contacts with {match_count} total matches")
                
                return {
                    "processed_contacts": processed_contacts,
                    "total_contacts": len(shared_contacts),
                    "matches_created": match_count,
                    "success": len(errors) == 0,
                    "errors": errors if errors else None
                }
                
            except Exception as e:
                error_msg = f"Error committing changes: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
                db.rollback()
                raise
    
    except Exception as e:
        logger.error(f"Error in match_new_target_list: {str(e)}")
        db.rollback()
        raise
