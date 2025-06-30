// Field mapping configuration
export const fieldMappings: Record<string, string[]> = {
  // Voter ID mappings
  voter_id: ['vuid', 'voter id', 'state voter id', 'voterid', 'statevoterid'],
  
  // Name mappings
  first_name: ['first', 'firstname', 'first name', 'fn'],
  last_name: ['last', 'lastname', 'last name', 'ln'],
  
  // Address mappings
  address_1: ['address', 'address 1', 'address1', 'regadd1', 'registration addr 1', 'reg add 1'],
  address_2: ['address 2', 'address2', 'regadd2', 'registration addr 2', 'reg add 2'],
  city: ['city', 'city name', 'cityname'],
  state: ['state'],
  zip_code: ['zip', 'zipcode', 'zip code', 'regzip5'],
  
  // Contact mappings
  email: ['email', 'e-mail'],
  cell_1: ['phone', 'phone 1', 'cell', 'cell 1', 'phone1', 'cell1'],
  cell_2: ['phone2', 'phone 2', 'cell2', 'cell 2'],
  cell_3: ['phone3', 'phone 3', 'cell3', 'cell 3']
};

/**
 * Automatically maps CSV headers to field names based on common patterns
 * @param headers Array of header names from the CSV
 * @returns Object mapping field names to header names
 */
export function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  
  // Convert headers to lowercase for case-insensitive matching
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  // For each field and its possible aliases
  for (const [field, aliases] of Object.entries(fieldMappings)) {
    // Find the first matching header that hasn't been used yet
    const matchingHeaderIndex = normalizedHeaders.findIndex((header, index) => {
      return !usedHeaders.has(headers[index]) && 
             aliases.some(alias => header.includes(alias));
    });
    
    // If we found a match, add it to the mapping
    if (matchingHeaderIndex !== -1) {
      mapping[field] = headers[matchingHeaderIndex];
      usedHeaders.add(headers[matchingHeaderIndex]);
    }
  }
  
  return mapping;
}
