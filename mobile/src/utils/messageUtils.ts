/**
 * Replaces variables in message content with actual values
 * @param content The message content with variables (e.g., "Hello %userfirst% %userlast%")
 * @param userData Object containing user data (first_name, last_name, city)
 * @param contactData Object containing contact data (first_name, last_name, city)
 * @returns The message with variables replaced by actual values
 */
export const replaceMessageVariables = (
  content: string,
  userData: {
    first_name?: string | null;
    last_name?: string | null;
    city?: string | null;
  },
  contactData: {
    first_name?: string | null;
    last_name?: string | null;
    city?: string | null;
  }
): string => {
  if (!content) return '';
  
  // Default values to handle null/undefined cases
  const user = {
    first_name: userData?.first_name || '',
    last_name: userData?.last_name || '',
    city: userData?.city || ''
  };
  
  const contact = {
    first_name: contactData?.first_name || '',
    last_name: contactData?.last_name || '',
    city: contactData?.city || ''
  };
  
  // Create a mapping of variables to their values (case insensitive)
  const variables: Record<string, string> = {
    // User variables
    '%userfirst%': user.first_name,
    '%userfirst': user.first_name, // Handle case where % is missing at the end
    '%userlast%': user.last_name,
    '%userlast': user.last_name,
    '%usercity%': user.city,
    '%usercity': user.city,
    
    // Contact variables
    '%contactfirst%': contact.first_name,
    '%contactfirst': contact.first_name,
    '%contactlast%': contact.last_name,
    '%contactlast': contact.last_name,
    '%contactcity%': contact.city,
    '%contactcity': contact.city,
  };
  
  // Create a case-insensitive regex pattern for all variables
  const pattern = new RegExp(
    Object.keys(variables)
      .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escape special regex chars
      .join('|'),
    'gi'
  );
  
  // Replace all occurrences of variables in the content
  return content.replace(pattern, (match) => {
    // Use the lowercase version of the match to ensure case-insensitive matching
    const lowerMatch = match.toLowerCase();
    return variables[match] || variables[lowerMatch] || match;
  });
};
