import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import Contacts from 'react-native-contacts';
import api from '../utils/api';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

export const requestContactsPermission = async () => {
  try {
    if (Platform.OS === 'ios') {
      // Official minimal iOS permission flow using react-native-permissions
      const status = await check(PERMISSIONS.IOS.CONTACTS);
      if (status === RESULTS.GRANTED) return true;
      if (status === RESULTS.BLOCKED) {
        Alert.alert(
          'Contacts Permission Blocked',
          'Please enable contacts access in Settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]
        );
        return false;
      }
      // Only call request() if not BLOCKED
      const reqStatus = await request(PERMISSIONS.IOS.CONTACTS);
      if (reqStatus === RESULTS.GRANTED) return true;
      if (reqStatus === RESULTS.BLOCKED) {
        Alert.alert(
          'Contacts Permission Blocked',
          'Please enable contacts access in Settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ]
        );
        return false;
      }
      Alert.alert(
        'Contacts Permission Denied',
        'Contacts access is required to share contacts.',
        [{ text: 'OK', style: 'default' }]
      );
      return false;
    } else if (Platform.OS === 'android') {
      if (Platform.Version < 23) return true;
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts',
          message: 'This app needs access to your contacts to share them.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  } catch (error) {
    console.error('Error requesting contacts permission:', error);
    return false;
  }
};

const formatContact = (contact) => {
  const { recordID, givenName, familyName, emailAddresses, phoneNumbers, postalAddresses } = contact;

  const mobileNumbers = phoneNumbers
    .filter(pn => {
      const label = pn.label ? pn.label.toLowerCase() : '';
      // Prioritize 'mobile', 'iphone', or numbers without specific non-mobile labels
      if (['mobile', 'iphone'].includes(label)) return true;
      if (['main', 'home fax', 'work fax', 'pager', 'work', 'home', 'landline', 'office', 'other fax'].includes(label)) return false;
      // If label is generic like 'other' or not present, include it for now, can be refined
      return true; 
    })
    .map(pn => pn.number)
    .slice(0, 3); // Max 3 mobile numbers

  if (mobileNumbers.length === 0) {
    return null; // Skip contact if no mobile number is found
  }

  const address = postalAddresses && postalAddresses[0] ? {
    street: postalAddresses[0].street || '',
    city: postalAddresses[0].city || '',
    state: postalAddresses[0].state || '',
    zip: postalAddresses[0].postCode || '',  // Changed from postalCode to postCode
  } : {
    street: '', city: '', state: '', zip: '',
  };

  // Get the company from the contact's organization field if available
  const company = contact.organizationName || contact.companyName || contact.company || '';
  
  return {
    id: recordID,
    firstName: givenName || '',
    lastName: familyName || '',
    company: company,
    phoneNumbers: mobileNumbers, // Array of up to 3 mobile numbers
    email: emailAddresses && emailAddresses[0] ? emailAddresses[0].email : '',
    address: address.street, // Keeping flat structure as per original request example
    city: address.city,
    state: address.state,
    zip: address.zip,
  };
};

export const getContacts = async () => {
  console.log('=== Starting getContacts ===');
  try {
    console.log('1. Checking contacts permission...');
    const hasPermission = await requestContactsPermission();
    console.log('2. Contacts permission status in getContacts:', hasPermission);

    if (!hasPermission) {
      console.log('Permission denied, returning empty array.');
      return [];
    }

    console.log('3. Permission granted, fetching contacts from device...');
    const rawContacts = await Contacts.getAll();
    console.log('4. Successfully retrieved', rawContacts.length, 'raw contacts');

    console.log('5. Processing and formatting contacts...');
    const formattedContacts = rawContacts
      .map(formatContact)
      .filter(contact => contact !== null); // Remove contacts that were filtered out (no mobile number)

    console.log('6. Successfully formatted contacts:', formattedContacts.length);
    return formattedContacts;
  } catch (error) {
    console.error('Error in getContacts:', error);
    if (error.message && error.message.includes('denied')) {
      Alert.alert('Permission Denied', 'Contacts permission was denied. Please enable it in settings.');
    }
    return []; // Return empty array on error or permission denial
  }
};

export const shareContacts = async (contactsToShare) => {
  if (!contactsToShare || contactsToShare.length === 0) {
    console.log('No contacts to share.');
    return { message: 'No contacts provided to share.' };
  }
  try {
    console.log(`Attempting to share ${contactsToShare.length} contacts...`);
    
    // Format contacts to match backend's expected schema
    const formattedContacts = contactsToShare.map(contact => {
      console.log('Original contact data:', JSON.stringify(contact, null, 2));
      return {
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        company: contact.company || '', // Include company field
        phoneNumbers: Array.isArray(contact.phoneNumbers) 
          ? contact.phoneNumbers.map(number => ({
              label: 'mobile',
              number: number
            }))
          : [],
        email: contact.email || '',
        address: {
          street: contact.address || '',
          city: contact.city || '',
          state: contact.state || '',
          zip_code: contact.zip || ''
        }
      };
    });
    
    const response = await api.post('/api/contacts/share', { 
      contacts: formattedContacts 
    });
    
    console.log('Successfully shared contacts:', response.data);
    return response.data;
  } catch (error) {
    // Log the detailed error object from Axios if available
    if (error.isAxiosError && error.response) {
      console.error('Error sharing contacts - Axios response error:', JSON.stringify(error.response.data, null, 2));
    } else if (error.isAxiosError && error.request) {
      console.error('Error sharing contacts - Axios request error (no response):', error.request);
    } else {
      console.error('Error sharing contacts - Generic error:', error.message, error.stack);
    }
    throw new Error(error.response?.data?.message || error.message || 'Failed to share contacts');
  }
};

export const getMatchingProgress = async () => {
    try {
        const response = await api.get('/contacts/matching-progress');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getSharedContacts = async () => {
    try {
        const response = await api.get('/contacts/shared');
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getMatchedContacts = async () => {
    try {
        const response = await api.get('/contacts/matched');
        return response.data;
    } catch (error) {
        throw error;
    }
};
