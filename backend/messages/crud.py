from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, and_, text, insert
from models.messages.message_template import MessageTemplate as DBMessageTemplate
from models.messages.user_message_template import UserMessageTemplate
from models.user import User as DBUser
from models.targets.target_list import TargetList as ContactList
from models.targets.target_contact import TargetContact

# Create
def create_message_template(db: Session, template_data: dict, list_ids: List[int] = None, user_ids: List[int] = None, group_ids: List[int] = None):
    """Create a new message template with optional list, user, and group associations."""
    try:
        # Ensure status is uppercase and valid
        if 'status' in template_data and template_data['status'] is not None:
            if not isinstance(template_data['status'], str):
                template_data['status'] = str(template_data['status'])
            template_data['status'] = template_data['status'].upper()
            if template_data['status'] not in ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']:
                template_data['status'] = 'DRAFT'  # Default for new templates
        else:
            template_data['status'] = 'DRAFT'  # Default for new templates
        
        # Create the template
        db_template = DBMessageTemplate(**template_data)
        db.add(db_template)
        db.flush()  # Flush to get the ID without committing
        
        # Initialize empty lists for relationships if not provided
        list_ids = list_ids or []
        user_ids = user_ids or []
        group_ids = group_ids or []
        
        # Add list associations
        if list_ids:
            # Don't clear lists - only add the ones specified
            unique_list_ids = set(list_ids)
            added_list_ids = set()
            print(f"[CRUD] Adding lists {unique_list_ids} to template {db_template.id}")
            for lst in db.query(ContactList).filter(ContactList.id.in_(unique_list_ids)).all():
                if lst.id not in added_list_ids:
                    db_template.lists.append(lst)
                    added_list_ids.add(lst.id)
                    print(f"[CRUD] Added list {lst.id} to template {db_template.id}")
            db.flush()
        
        # Add user associations
        if user_ids:
            print(f"[CRUD] Adding users {user_ids} to template {db_template.id}")
            
            # Get existing user associations
            existing_user_assocs = db.query(UserMessageTemplate).filter(
                UserMessageTemplate.template_id == db_template.id
            ).all()
            existing_user_ids = {ua.user_id for ua in existing_user_assocs}
            
            # Only add new users that don't already exist
            new_user_ids = set(user_ids) - existing_user_ids
            
            # Get users to add
            users_to_add = db.query(DBUser).filter(DBUser.id.in_(new_user_ids)).all()
            for user in users_to_add:
                db_user_template = UserMessageTemplate(user=user, template=db_template)
                db.add(db_user_template)
                print(f"[CRUD] Added user {user.id} to template {db_template.id}")
            
            db.flush()
        
        # Add group associations
        if group_ids:
            from models.associations import message_template_groups
            from models.group import Group
            
            # Get existing groups for this template
            existing_groups = db.query(Group).join(
                message_template_groups,
                message_template_groups.c.group_id == Group.id
            ).filter(
                message_template_groups.c.template_id == db_template.id
            ).all()
            existing_group_ids = {g.id for g in existing_groups}
            
            # Only add new groups that don't already exist
            new_group_ids = set(group_ids) - existing_group_ids
            print(f"[CRUD] Adding groups {new_group_ids} to template {db_template.id}")
            
            if new_group_ids:
                db.execute(
                    insert(message_template_groups).prefix_with("OR IGNORE"),
                    [{"template_id": db_template.id, "group_id": gid} for gid in new_group_ids]
                )
                print(f"[CRUD] Added {len(new_group_ids)} groups to template {db_template.id}")
            
            db.flush()
        
        db.commit()
        db.refresh(db_template)
        db_template = (
            db.query(DBMessageTemplate)
            .options(
                selectinload(DBMessageTemplate.lists),
                selectinload(DBMessageTemplate.groups),
                selectinload(DBMessageTemplate.user_assignments).selectinload(UserMessageTemplate.user),
            )
            .get(db_template.id)
        )
        return db_template
    except Exception as e:
        db.rollback()
        print(f"Error creating message template: {e}")
        raise e
        raise

# Read
def get_message_template(db: Session, template_id: int) -> Optional[DBMessageTemplate]:
    """Retrieve a single message template by ID with its relationships."""
    try:
        # Eagerly load all relevant relationships for correct serialization
        result = (
            db.query(DBMessageTemplate)
            .options(
                selectinload(DBMessageTemplate.lists),
                selectinload(DBMessageTemplate.groups),
                selectinload(DBMessageTemplate.user_assignments).selectinload(UserMessageTemplate.user),
            )
            .filter(DBMessageTemplate.id == template_id)
            .first()
        )
        return result
    except Exception as e:
        print(f"Error fetching message template {template_id}: {e}")
        raise

def get_message_templates(db: Session, skip: int = 0, limit: int = 100):
    """
    Get message templates with proper session handling
    """
    try:
        # Explicitly load all relationships in one query
        return db.query(DBMessageTemplate)\
            .options(
                joinedload(DBMessageTemplate.user_assignments).joinedload(UserMessageTemplate.user),
                joinedload(DBMessageTemplate.lists),
                joinedload(DBMessageTemplate.groups)
            )\
            .offset(skip)\
            .limit(limit)\
            .all()
    except Exception as e:
        print(f"Error getting message templates: {str(e)}")
        raise

def get_neighbor_messages_with_contacts(
    db: Session,
    user_id: int,
    user_zip_code: str,
    contact_limit_per_message: int = 10,
    contact_offset_per_message: int = 0
) -> List[Dict[str, Any]]:
    """
    Retrieves 'neighbor_to_neighbor' messages assigned to the user,
    along with a paginated list of target contacts in the same zip code.
    """
    print(f"[CRUD] Fetching neighbor messages for user {user_id} in zip code {user_zip_code}")

    # 1. Get active 'neighbor_to_neighbor' messages assigned to the user
    #    and eager load their associated lists.
    messages_query = db.query(DBMessageTemplate).options(
        joinedload(DBMessageTemplate.lists)
    ).filter(
        DBMessageTemplate.message_type == "neighbor_to_neighbor",
        DBMessageTemplate.status == "ACTIVE",
        DBMessageTemplate.user_assignments.any(UserMessageTemplate.user_id == user_id)
    ).all()

    print(f"[CRUD] Found {len(messages_query)} active neighbor messages for user {user_id}")

    result = []
    for message in messages_query:
        message_data = {
            "id": message.id,
            "name": message.name,
            "content": message.content,
            "media_url": message.media_url,
            "contacts": []
        }

        # Collect all list IDs associated with this message
        message_list_ids = [lst.id for lst in message.lists]
        print(f"[CRUD] Message {message.id} associated with lists: {message_list_ids}")

        if not message_list_ids:
            print(f"[CRUD] Message {message.id} has no associated lists. Skipping contacts.")
            result.append(message_data)
            continue

        # 2. For each message, find target contacts from its associated lists
        #    that match the user's zip code, with pagination.
        contacts_query = db.query(TargetContact).filter(
            TargetContact.list_id.in_(message_list_ids),
            TargetContact.zip_code == user_zip_code
        )
        
        # Apply pagination for contacts within this message
        paginated_contacts = contacts_query.offset(contact_offset_per_message).limit(contact_limit_per_message).all()
        total_contacts_for_message = contacts_query.count()

        print(f"[CRUD] Found {len(paginated_contacts)} contacts for message {message.id} in zip {user_zip_code} (Total: {total_contacts_for_message})")

        for contact in paginated_contacts:
            message_data["contacts"].append({
                "id": contact.id,
                "voter_id": contact.voter_id,
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "zip_code": contact.zip_code,
                "address_1": contact.address_1,
                "city": contact.city,
                "state": contact.state,
                "cell_1": contact.cell_1,
                "list_id": contact.list_id
            })
        
        message_data["total_contacts_in_zip"] = total_contacts_for_message
        result.append(message_data)

    return result

def get_contacts_for_message(
    db: Session,
    message_id: int,
    user_zip_code: str,
    offset: int = 0,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Retrieves paginated target contacts for a specific message template
    that match the user's zip code.
    """
    print(f"[CRUD] Fetching contacts for message {message_id} in zip code {user_zip_code} (offset: {offset}, limit: {limit})")

    # First, get the message template to find its associated lists
    message = db.query(DBMessageTemplate).options(
        joinedload(DBMessageTemplate.lists)
    ).filter(
        DBMessageTemplate.id == message_id,
        DBMessageTemplate.message_type == "neighbor_to_neighbor",
        DBMessageTemplate.status == "ACTIVE"
    ).first()

    if not message:
        print(f"[CRUD] Message {message_id} not found or not a valid neighbor message.")
        return {"contacts": [], "total_contacts": 0}

    message_list_ids = [lst.id for lst in message.lists]
    if not message_list_ids:
        print(f"[CRUD] Message {message_id} has no associated lists. No contacts to fetch.")
        return {"contacts": [], "total_contacts": 0}

    # Query for contacts
    contacts_query = db.query(TargetContact).filter(
        TargetContact.list_id.in_(message_list_ids),
        TargetContact.zip_code == user_zip_code
    )

    total_contacts = contacts_query.count()
    paginated_contacts = contacts_query.offset(offset).limit(limit).all()

    formatted_contacts = []
    for contact in paginated_contacts:
        formatted_contacts.append({
            "id": contact.id,
            "voter_id": contact.voter_id,
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "zip_code": contact.zip_code,
            "address_1": contact.address_1,
            "city": contact.city,
            "state": contact.state,
            "cell_1": contact.cell_1,
            "list_id": contact.list_id
        })
    
    print(f"[CRUD] Fetched {len(formatted_contacts)} contacts for message {message_id} (Total: {total_contacts})")
    return {"contacts": formatted_contacts, "total_contacts": total_contacts}

# Update
def update_message_template(
    db: Session, 
    template_id: int, 
    template_data: dict,
    list_ids: List[int] = None,
    user_ids: List[int] = None,
    group_ids: List[int] = None
) -> Optional[DBMessageTemplate]:
    # Start a transaction if not already in one
    needs_commit = not db.in_transaction()
    try:
        if needs_commit:
            db.begin()
        
        # Get the template with all relationships loaded
        db_template = (
            db.query(DBMessageTemplate)
            .options(
                selectinload(DBMessageTemplate.lists),
                selectinload(DBMessageTemplate.groups),
                selectinload(DBMessageTemplate.user_assignments)
            )
            .get(template_id)
        )
        
        if not db_template:
            if needs_commit:
                db.rollback()
            return None
        
        # Debug log current state
        print(f"\n[CRUD] Current template state - ID: {db_template.id}, Name: {db_template.name}")
        print(f"[CRUD] Current status: {db_template.status}")
        print(f"[CRUD] Current lists: {[l.id for l in db_template.lists]}")
        print(f"[CRUD] Current users: {[u.id for u in db_template.user_assignments]}")
        print(f"[CRUD] Current groups: {[g.id for g in db_template.groups]}")
        
        # Debug log incoming update data
        print(f"[CRUD] Updating with data: {template_data}")
        
        # Normalize status to uppercase if present
        if 'status' in template_data and template_data['status'] is not None:
            # Ensure status is a string before calling upper()
            if not isinstance(template_data['status'], str):
                print(f"[CRUD] Warning: status is not a string: {type(template_data['status'])}")
                template_data['status'] = str(template_data['status'])
            
            template_data['status'] = template_data['status'].upper()
            print(f"[CRUD] Normalized status to: {template_data['status']}")
            
            # Validate status is one of the allowed values
            if template_data['status'] not in ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']:
                print(f"[CRUD] Warning: Invalid status value: {template_data['status']}, defaulting to INACTIVE")
                template_data['status'] = 'INACTIVE'
        
        # Update template fields
        for field, value in template_data.items():
            if hasattr(db_template, field):
                old_value = getattr(db_template, field, None)
                setattr(db_template, field, value)
                print(f"[CRUD] Updated {field}: {old_value} -> {value}")
        
        # Ensure status is explicitly set and valid
        if 'status' in template_data:
            db_template.status = template_data['status']
            print(f"[CRUD] Status explicitly set to: {db_template.status}")
            
            # Force update with direct SQL to ensure it's saved
            try:
                from sqlalchemy import text
                db.execute(text(f"UPDATE message_templates SET status = '{db_template.status}' WHERE id = {template_id}"))
                db.flush()
                print(f"[CRUD] Forced status update with direct SQL: {db_template.status}")
            except Exception as e:
                print(f"[CRUD] Error with direct SQL update: {e}")
                
        elif not db_template.status:  # If status is not set, default to INACTIVE
            db_template.status = 'INACTIVE'
            print("[CRUD] Status was not set, defaulting to INACTIVE")
        
        # Force the status to be one of the valid values
        if db_template.status not in ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']:
            db_template.status = 'INACTIVE'
            print(f"[CRUD] Invalid status detected, defaulting to INACTIVE")
        
        db_template.updated_at = datetime.utcnow()
        # Explicitly save the template
        db.add(db_template)
        db.flush()
        
        # Explicitly refresh the template to ensure we have the latest state
        db.refresh(db_template)
        print(f"[CRUD] After refresh - Status: {db_template.status}")
        
        # Update list associations if provided
        if list_ids is not None:
            # Convert to set for easier comparison
            new_list_ids = set(list_ids)
            current_list_ids = {l.id for l in db_template.lists}
            
            # Only update if there are changes
            if new_list_ids != current_list_ids:
                # Clear existing list associations
                db_template.lists.clear()
                db.flush()  # Ensure the clear is processed
                
                # Add new list associations if any
                if new_list_ids:
                    # Query TargetList instead of ContactList
                    lists = db.query(ContactList).filter(ContactList.id.in_(new_list_ids)).all()
                    # Add each list individually to avoid duplicates
                    for lst in lists:
                        db_template.lists.append(lst)
                    db.flush()  # Ensure lists are added before continuing
        
        # Update user associations if provided
        if user_ids is not None:
            try:
                from models.messages.user_message_template import UserMessageTemplate
                
                # Get current user assignments
                current_assignments = db.query(UserMessageTemplate).filter(
                    UserMessageTemplate.template_id == template_id
                ).all()
                current_user_ids = {ua.user_id for ua in current_assignments}
                new_user_ids = set(user_ids or [])
                
                # Debug logging
                print(f"[DEBUG] Current user assignments: {current_user_ids}")
                print(f"[DEBUG] New user assignments: {new_user_ids}")
                
                # Remove users that are no longer assigned
                users_to_remove = current_user_ids - new_user_ids
                if users_to_remove:
                    print(f"[DEBUG] Removing users: {users_to_remove}")
                    delete_stmt = UserMessageTemplate.__table__.delete().where(
                        (UserMessageTemplate.template_id == template_id) &
                        (UserMessageTemplate.user_id.in_(users_to_remove))
                    )
                    db.execute(delete_stmt)
                
                # Add new user assignments
                users_to_add = new_user_ids - current_user_ids
                if users_to_add:
                    print(f"[DEBUG] Adding users: {users_to_add}")
                    # Check which users actually exist
                    existing_users = db.query(DBUser).filter(DBUser.id.in_(users_to_add)).all()
                    existing_user_ids = {u.id for u in existing_users}
                    
                    # Prepare batch insert
                    new_assignments = [
                        {"user_id": user_id, "template_id": template_id}
                        for user_id in users_to_add
                        if user_id in existing_user_ids
                    ]
                    
                    if new_assignments:
                        stmt = UserMessageTemplate.__table__.insert().values(new_assignments)
                        db.execute(stmt)
                
                db.flush()
                
                # Verify the changes
                updated_assignments = db.query(UserMessageTemplate).filter(
                    UserMessageTemplate.template_id == template_id
                ).all()
                print(f"[DEBUG] Updated user assignments: {[ua.user_id for ua in updated_assignments]}")
                
            except Exception as e:
                print(f"[ERROR] Failed to update user assignments: {str(e)}")
                import traceback
                traceback.print_exc()
                if needs_commit:
                    db.rollback()
                raise
        
        # Update group associations if provided
        if group_ids is not None:
            try:
                from models.group import Group
                from models.associations import message_template_groups
                
                # Convert to sets for easier comparison
                new_group_ids = set(group_ids or [])
                current_group_ids = {g.id for g in db_template.groups}
                
                # Find groups to add and remove
                groups_to_add = new_group_ids - current_group_ids
                groups_to_remove = current_group_ids - new_group_ids
                
                # Debug logging
                print(f"Current group IDs: {current_group_ids}")
                print(f"New group IDs: {new_group_ids}")
                print(f"Groups to add: {groups_to_add}")
                print(f"Groups to remove: {groups_to_remove}")
                
                # First, clear all existing associations to avoid any conflicts
                stmt = message_template_groups.delete().where(
                    message_template_groups.c.template_id == template_id
                )
                db.execute(stmt)
                
                # Then add the new associations
                if new_group_ids:
                    existing_groups = db.query(Group).filter(Group.id.in_(new_group_ids)).all()
                    for group in existing_groups:
                        try:
                            stmt = message_template_groups.insert().values(
                                template_id=template_id,
                                group_id=group.id
                            )
                            db.execute(stmt)
                        except Exception as e:
                            print(f"Error adding group {group.id} to template {template_id}: {e}")
                            # Skip this group if there's an error
                            continue
                
                db.flush()
                
                # Refresh the template to get updated relationships
                db.refresh(db_template, ['groups'])
                
            except Exception as e:
                print(f"[ERROR] Failed to update group assignments: {str(e)}")
                import traceback
                traceback.print_exc()
                if needs_commit:
                    db.rollback()
                raise
        
        # Commit the transaction if we started it
        if needs_commit:
            db.commit()
        
        # Refresh the template to get all updated relationships
        db.refresh(db_template)
        
        # Eagerly load all relationships for the response
        db_template = (
            db.query(DBMessageTemplate)
            .options(
                selectinload(DBMessageTemplate.lists),
                selectinload(DBMessageTemplate.groups),
                selectinload(DBMessageTemplate.user_assignments)
            )
            .get(template_id)
        )
        
        return db_template
        
    except Exception as e:
        print(f"[ERROR] Error in update_message_template: {e}")
        import traceback
        traceback.print_exc()
        if needs_commit:
            db.rollback()
        raise


def get_user_messages_with_matched_contacts(db: Session, user_id: int):
    """
    Return all messages assigned to the user or to groups the user belongs to, but only if the user has at least one shared contact matched to a target list assigned to the message.
    For each message, include the matched contacts.
    """
    from models.shared_contact import SharedContact
    from models.contact_match import ContactMatch
    from models.targets.target_list import TargetList
    from models.targets.target_contact import TargetContact
    from models.messages.message_template import MessageTemplate as DBMessageTemplate
    from models.messages.user_message_template import UserMessageTemplate
    from models.group import Group, UserGroup
    from sqlalchemy.orm import joinedload
    from sqlalchemy import or_

    # 1. Find all message templates assigned directly to this user
    user_assignments = db.query(UserMessageTemplate).filter(UserMessageTemplate.user_id == user_id).all()
    direct_template_ids = [ua.template_id for ua in user_assignments]
    
    # 2. Find all groups this user belongs to
    user_groups = db.query(UserGroup).filter(UserGroup.user_id == user_id).all()
    group_ids = [ug.group_id for ug in user_groups]
    
    # 3. Find all message templates assigned to these groups
    group_template_ids = []
    if group_ids:
        # Query the message_template_groups association table using SQLAlchemy text() function
        from sqlalchemy import text
        
        if len(group_ids) > 1:
            # Multiple group IDs
            sql_query = text("SELECT template_id FROM message_template_groups WHERE group_id IN :group_ids")
            group_templates = db.execute(sql_query, {"group_ids": tuple(group_ids)}).fetchall()
        else:
            # Single group ID
            sql_query = text("SELECT template_id FROM message_template_groups WHERE group_id = :group_id")
            group_templates = db.execute(sql_query, {"group_id": group_ids[0]}).fetchall()
        
        group_template_ids = [gt[0] for gt in group_templates]
    
    # 4. Combine direct and group-based template IDs
    template_ids = list(set(direct_template_ids + group_template_ids))
    
    if not template_ids:
        return []

    # 5. Get all message templates with their assigned lists
    templates = db.query(DBMessageTemplate).filter(DBMessageTemplate.id.in_(template_ids)).all()

    results = []
    for template in templates:
        list_ids = [lst.id for lst in template.lists]
        if not list_ids:
            continue
        # 3. Find all shared contacts for this user that are matched to these lists
        matches = (
            db.query(ContactMatch, SharedContact, TargetContact)
            .join(SharedContact, ContactMatch.shared_contact_id == SharedContact.id)
            .join(TargetContact, ContactMatch.target_contact_id == TargetContact.id)
            .filter(SharedContact.user_id == user_id)
            .filter(ContactMatch.target_list_id.in_(list_ids))
            .all()
        )
        if not matches:
            continue
        # Debug logging setup
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.info(f"Processing template.id={template.id} ({type(template.id)}) for user_id={user_id}")
        # Query sent_messages to get all shared_contact_ids already sent for this user and message
        from models.sent_message import SentMessage
        sent_contact_ids = set(
            str(row.shared_contact_id)
            for row in db.query(SentMessage.shared_contact_id)
            .filter(
                SentMessage.user_id == user_id,
                SentMessage.message_template_id == str(template.id)
            )
            .all()
        )
        logger.info(f"sent_contact_ids for template.id={template.id}: {sent_contact_ids}")
        # Prepare matched contacts info, excluding already sent contacts
        matched_contacts = []
        for match, shared, target in matches:
            logger.info(f"Checking shared.id={shared.id} ({type(shared.id)}) against sent_contact_ids")
            if str(shared.id) in sent_contact_ids:
                logger.info(f"Excluding shared.id={shared.id} from matched_contacts (already sent)")
                continue  # skip if already sent
            matched_contacts.append({
                "shared_contact_id": shared.id,
                "first_name": shared.first_name,
                "last_name": shared.last_name,
                "mobile1": shared.mobile1,
                "mobile2": shared.mobile2,
                "mobile3": shared.mobile3,
                "email": shared.email,
                "address": shared.address,
                "city": shared.city,
                "state": shared.state,
                "zip": shared.zip,
                "company": shared.company,
                "matched_target": {
                    "target_contact_id": target.id,
                    "list_id": target.list_id,
                    "first_name": target.first_name,
                    "last_name": target.last_name,
                    "voter_id": target.voter_id,
                    "zip_code": target.zip_code,
                    "city": target.city
                }
            })
        # Format message info
        sent_count = len(sent_contact_ids)
        results.append({
            "message_id": template.id,
            "message_name": template.name,
            "message_type": template.message_type,
            "content": template.content,
            "media_url": template.media_url,
            "status": template.status,
            "matched_contacts": matched_contacts,
            "sent_count": sent_count
        })
    return results

# Delete
def delete_message_template(db: Session, template_id: int) -> bool:
    """Delete a message template and its associations."""
    try:
        # First, get the template to ensure it exists
        template = db.query(DBMessageTemplate).get(template_id)
        if not template:
            return False
            
        # Use direct SQL for clearing relationships to avoid ORM issues
        try:
            # Clear user associations
            db.execute(
                text("DELETE FROM user_message_templates WHERE template_id = :template_id"),
                {"template_id": template_id}
            )
            
            # Clear list associations
            db.execute(
                text("DELETE FROM message_template_lists WHERE template_id = :template_id"),
                {"template_id": template_id}
            )
            
            # Delete the template
            db.delete(template)
            db.commit()
            return True
            
        except Exception as inner_e:
            db.rollback()
            print(f"Error in cleanup for template {template_id}: {inner_e}")
            # Try direct delete as fallback
            try:
                db.execute(
                    text("DELETE FROM message_templates WHERE id = :template_id"),
                    {"template_id": template_id}
                )
                db.commit()
                return True
            except Exception as final_e:
                db.rollback()
                print(f"Final fallback delete failed for template {template_id}: {final_e}")
                raise
            
    except Exception as e:
        db.rollback()
        print(f"Error deleting message template {template_id}: {e}")
        raise
