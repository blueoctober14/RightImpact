import api from '../services/api';

export interface ContactMatch {
  id: number;
  target_contact_id: number;
  voter_id: string | null;
  target_list_id: number;
  target_list_name: string | null;
  match_confidence: 'high' | 'medium' | 'low';
  created_at: string;
}

export interface ExportContact {
  id: number;
  first_name: string;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  matched_lists: ContactMatch[];
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

export async function fetchContactsWithMatches(contactIds: number[]): Promise<ExportContact[]> {
  try {
    // Fetch all contacts with their matches
    const response = await api.get(`/contacts/shared?ids=${contactIds.join(',')}`);
    const contacts = response.data || [];
    
    // For each contact, fetch their matches if not already included
    const contactsWithMatches = await Promise.all(
      contacts.map(async (contact: any) => {
        if (!contact.matches && contact.match_count > 0) {
          try {
            const matchesResponse = await api.get(`/contacts/${contact.id}/matches`);
            contact.matches = matchesResponse.data || [];
          } catch (error) {
            console.error(`Error fetching matches for contact ${contact.id}:`, error);
            contact.matches = [];
          }
        }
        return {
          ...contact,
          phone1: contact.mobile_numbers?.[0] || null,
          phone2: contact.mobile_numbers?.[1] || null,
          phone3: contact.mobile_numbers?.[2] || null,
          matched_lists: contact.matches || []
        };
      })
    );
    
    return contactsWithMatches;
  } catch (error) {
    console.error('Error fetching contacts with matches:', error);
    throw error;
  }
}

export function prepareExportData(
  contacts: ExportContact[], 
  columnVisibility: { [key: string]: boolean }
): any[] {
  // Find the maximum number of matches across all contacts
  const maxMatches = Math.max(...contacts.map(c => c.matched_lists?.length || 0));
  
  return contacts.map(contact => {
    const baseData: any = {
      'ID': contact.id,
      'First Name': contact.first_name || '',
      'Last Name': contact.last_name || '',
      'Email': contact.email || '',
      'Phone 1': contact.phone1 || '',
      'Matched Lists Count': contact.matched_lists?.length || 0,
      'Shared By': contact.user_name || 'Unknown',
      'Date Shared': new Date(contact.created_at).toLocaleString()
    };

    // Add company if visible
    if (columnVisibility.company) {
      baseData['Company'] = contact.company || '';
    }

    // Add phone 2 and 3 if visible
    if (columnVisibility.phone2) {
      baseData['Phone 2'] = contact.phone2 || '';
    }
    if (columnVisibility.phone3) {
      baseData['Phone 3'] = contact.phone3 || '';
    }

    // Add match information
    contact.matched_lists?.forEach((match, index) => {
      baseData[`Matched List ${index + 1} Name`] = match.target_list_name || '';
      baseData[`Matched List ${index + 1} Voter ID`] = match.voter_id || '';
    });

    return baseData;
  });
}
