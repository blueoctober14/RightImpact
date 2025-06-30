import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import Contacts from 'react-native-contacts';
import api from '../utils/api';

export const requestContactsPermission = async () => {
  console.log('=== Starting requestContactsPermission ===');
  
  try {
    if (Platform.OS === 'ios') {
      console.log('Platform: iOS - Starting permission flow');
      
      // Using the Promise-based API instead of callback-based API
      console.log('1. Checking current permission status...');
      const status = await Contacts.checkPermission();
      console.log(`2. Current iOS contacts permission status: ${status}`);
      
      if (status === 'authorized') {
        console.log('3. iOS contacts permission already granted');
        return true;
      }
      
      if (status === 'denied') {
        console.log('3. iOS contacts permission was previously denied');
        return false;
      }
      
      // If status is undetermined, request permission using Promise API
      console.log('3. Requesting iOS contacts permission...');
      try {
        console.log('4. Calling Contacts.requestPermission with Promise API...');
        // Force the permission dialog to appear by directly requesting all contacts
        // This is more reliable on iOS simulators
        const newStatus = await Contacts.requestPermission();
        console.log(`5. iOS contacts permission request completed with status: ${newStatus}`);
        
        // If still not authorized, try one more approach that works better on simulators
        if (newStatus !== 'authorized') {
          console.log('6. Permission not granted, trying direct getAll approach...');
          try {
            // This often forces the permission dialog on simulators
            await Contacts.getAll();
            console.log('7. getAll completed, checking permission again...');
            const finalStatus = await Contacts.checkPermission();
            console.log(`8. Final permission status: ${finalStatus}`);
            return finalStatus === 'authorized';
          } catch (getAllError) {
            console.log('Error in getAll approach:', getAllError);
            return false;
          }
        }
        
        console.log(`6. Final permission status after request: ${newStatus}`);
        return newStatus === 'authorized';
      } catch (requestError) {
        console.error('Error during permission request:', requestError);
        return false;
      }
      
    } else if (Platform.OS === 'android') {
      console.log('Platform: Android - Starting permission flow');
      
      try {
        console.log('1. Checking if permission is already granted...');
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        
        if (hasPermission) {
          console.log('2. Android contacts permission already granted');
          return true;
        }
        
        console.log('2. Requesting Android contacts permission...');
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
        
        console.log('3. Android contacts permission result:', granted);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
        
      } catch (androidError) {
        console.error('Error during Android permission request:', androidError);
        return false;
      }
    }
    
    console.error('Platform not supported for contacts');
    return false;
    
  } catch (error) {
    console.error('Unexpected error in requestContactsPermission:', error);
    return false;
  } finally {
    console.log('=== End of requestContactsPermission ===');
  }
};

export const getContacts = async () => {
  console.log('=== Starting getContacts ===');
  
  try {
    console.log('1. Checking contacts permission...');
    const hasPermission = await requestContactsPermission();
    console.log('2. Contacts permission status in getContacts:', hasPermission);
    
    if (!hasPermission) {
      const errorMsg = 'Contacts permission not granted';
      console.error('3. ' + errorMsg);
      throw new Error(errorMsg);
    }

    console.log('3. Permission granted, fetching contacts from device...');
    
    try {
      console.log('4. Calling Contacts.getAll with Promise API...');
      const contacts = await Contacts.getAll();
      
      console.log(`5. Successfully retrieved ${contacts?.length || 0} raw contacts`);
      
      if (!Array.isArray(contacts)) {
        const errorMsg = 'Contacts data is not an array';
        console.error('6. ' + errorMsg, { contacts });
        throw new Error(errorMsg);
      }

      if (contacts.length === 0) {
        console.log('6. No contacts found on device');
        return [];
      }

      console.log('6. Processing contacts...');
      // Filter out contacts without a name or phone number
      const validContacts = contacts.filter(contact => {
        const hasName = contact.givenName || contact.familyName || contact.displayName;
        const hasPhone = contact.phoneNumbers && contact.phoneNumbers.length > 0;
        return hasName && hasPhone;
      });

      console.log(`7. Filtered to ${validContacts.length} valid contacts`);

      // Format contacts for the app
      const formattedContacts = validContacts.map(contact => {
        const name = [contact.givenName, contact.familyName].filter(Boolean).join(' ') || 
                    contact.displayName || 'No Name';
        const phone = contact.phoneNumbers[0]?.number || '';
        
        return {
          id: contact.recordID || `contact-${Math.random().toString(36).substr(2, 9)}`,
          name: name,
          phone: phone,
          shared: false,
        };
      });

      console.log('8. Successfully formatted contacts:', formattedContacts.length);
      return formattedContacts;
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  } catch (error) {
    console.error('9. Error in getContacts:', error);
    throw error;
  }
};

export const shareContacts = async (contacts) => {
  try {
    // Format contacts for the API
    const formattedContacts = contacts.map(contact => ({
      name: contact.name,
      phone: contact.phone,
      // Include any other fields your API expects
    }));

    const response = await api.post('/contacts/share', { contacts: formattedContacts });
    return response.data;
  } catch (error) {
    console.error('Error sharing contacts:', error);
    throw new Error(error.response?.data?.message || 'Failed to share contacts');
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
