import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Dimensions, 
  StatusBar, 
  View, 
  Text, 
  TextInput,
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Animated, 
  PanResponder,
  Linking,
  Platform,
  ScrollView,
  FlatList,
  RefreshControl,
  Image,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme';
import { getAuthToken } from '../services/auth';

// Helper function to format phone number as xxx-xxx-xxxx
const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return 'No phone number';
  // Remove all non-digit characters
  const cleaned = ('' + phone).replace(/\D/g, '');
  // Format as xxx-xxx-xxxx if we have at least 10 digits
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
};
import { API_URL } from '../config';
import api from '../services/api';
import Button from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { fetchUserMessagesWithMatches, markMessageAsSent, verifyToken, makeDirectApiCall } from '../services/api';
import { replaceMessageVariables } from '../utils/messageUtils';
import { getCurrentUser } from '../services/auth';
import { fetchIdentificationStatus, ContactIdentificationStatus } from '../services/identification';
import { ContactsContext } from '../contexts/ContactsContext';

import type { FriendsScreenProps } from '../types/navigation.types'; // Adjust if necessary

interface ContactsSharedScreenProps {
  navigation: any;
  route: {
    params?: {
      refresh?: boolean;
    };
  };
}

interface ContactData {
  shared_contact_id?: string;
  contact_id?: string;
  id?: string;
  first_name: string;
  last_name: string;
  city?: string;
  zip?: string;
  messageId?: string;
}

const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;

const ContactsSharedScreen: React.FC<ContactsSharedScreenProps> = ({ navigation, route }) => {
  const { onUpdatePress } = React.useContext(ContactsContext);
  const [selectedTab, setSelectedTab] = React.useState<'Messaging' | 'Identification'>('Messaging');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [messages, setMessages] = React.useState<any[]>([]);
  const [sharedContacts, setSharedContacts] = React.useState<any[]>([]);
  const [contactLimits, setContactLimits] = React.useState<Record<string, number>>({});
  
  // Track sent messages by message_id and contact_id
  const [sentMessages, setSentMessages] = React.useState<Record<string, Set<string>>>({});
  const [sentCounts, setSentCounts] = React.useState<Record<string, number>>({});
  
  // Animation values for swipe actions
  const [activeSwipeContact, setActiveSwipeContact] = React.useState<string | null>(null);
  // Animation values for each contact row: { [messageId:contactId]: Animated.Value }
  const [rowAnimations, setRowAnimations] = useState<Record<string, Animated.Value>>( {} );

  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [skippedContactIds, setSkippedContactIds] = React.useState<Set<number>>(new Set());
  const [identificationStatus, setIdentificationStatus] = React.useState<Record<number, ContactIdentificationStatus>>({});

  const toggleMessageExpanded = useCallback((messageId: string) => {
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  }, []);

  // Hide navigation header completely
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      headerLeft: () => null,
      headerTitle: () => null
    });
  }, [navigation]);

  // Load skipped contacts on mount
  React.useEffect(() => {
    const loadSkippedContacts = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await api.get('/api/contacts/skipped', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response && response.data && response.data.contacts) {
          const skippedIds = response.data.contacts.map((contact: any) => contact.shared_contact_id);
          setSkippedContactIds(new Set(skippedIds));
        }
      } catch (error) {
        console.error('Failed to load skipped contacts:', error);
      }
    };
    
    loadSkippedContacts();
  }, []);

  // Load user messages and shared contacts on mount
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Load messages for the messaging tab
        const messagesData = await fetchUserMessagesWithMatches();
        setMessages(messagesData);
        
        // Load identification status
        try {
          const statusData = await fetchIdentificationStatus();
          const statusMap: Record<number, ContactIdentificationStatus> = {};
          statusData.forEach(status => {
            const contactId = status.shared_contact_id || status.contact_id;
            if (contactId) {
              statusMap[contactId] = status;
            }
          });
          setIdentificationStatus(statusMap);
        } catch (error) {
          console.error('Failed to load identification status:', error);
        }
        
        // Load all shared contacts for the identification tab
        try {
          // First try to get the current user's contacts
          const currentUser = await getCurrentUser();
          if (!currentUser || !currentUser.id) {
            throw new Error('User not found');
          }
          
          // Fetch shared contacts for the current user with increased limit
          const response = await makeDirectApiCall(
            `/api/contacts/shared?user_id=${currentUser.id}&limit=500`, 
            'GET'
          );
          
          console.log('API Response for shared contacts:', response);
          
          // Handle the response data safely
          const responseData = response?.data || response;
          let contacts = [];
          
          // Check for different possible response formats
          if (Array.isArray(responseData)) {
            contacts = responseData;
          } else if (responseData && typeof responseData === 'object') {
            if (Array.isArray(responseData.contacts)) {
              contacts = responseData.contacts;
            } else if (Array.isArray(responseData.data?.contacts)) {
              contacts = responseData.data.contacts;
            } else if (Array.isArray(responseData.data)) {
              contacts = responseData.data;
            }
          }
          
          console.log('Fetched shared contacts:', contacts);
          console.log('First contact data:', contacts[0]);
          setSharedContacts(contacts);
        } catch (error) {
          console.error('Failed to fetch shared contacts:', error);
          setSharedContacts([]);
          // Show a user-friendly error message
          Alert.alert('Error', 'Unable to load shared contacts. Please try again later.');
        }
      } catch (e: any) {
        console.error('Error loading data:', e);
        setError(e?.message || 'Failed to load data');
      }
      setLoading(false);
    };
    load();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load skipped contacts
      const skippedResponse = await api.get<{contacts: Array<{shared_contact_id: number}>}>('/api/contacts/skipped');
      setSkippedContactIds(new Set(skippedResponse.data.contacts.map(c => c.shared_contact_id)));
      
      // Load shared contacts
      const response = await api.get<{contacts: any[]}>('/api/contacts/shared');
      setSharedContacts(response.data.contacts);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  React.useEffect(() => {
    loadData();
  }, []);
  
  // Handle refresh from navigation params
  React.useEffect(() => {
    if (route.params?.refresh) {
      loadData();
      navigation.setParams({ refresh: undefined });
    }
  }, [route.params?.refresh]);

  // Add this useEffect to watch for refresh triggers
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh both skipped contacts and shared contacts
      const refreshContacts = async () => {
        try {
          setLoading(true);
          setError('');
          
          // Load skipped contacts
          const skippedResponse = await api.get<{contacts: Array<{shared_contact_id: number}>}>('/api/contacts/skipped');
          setSkippedContactIds(new Set(skippedResponse.data.contacts.map(c => c.shared_contact_id)));
          
          // Load shared contacts
          const response = await api.get<{contacts: any[]}>('/api/contacts/shared');
          setSharedContacts(response.data.contacts);
        } catch (error) {
          console.error('Error refreshing contacts:', error);
        } finally {
          setLoading(false);
        }
      };
      
      refreshContacts();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Add focus listener to refresh data when screen comes into view
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Function to mark a contact as sent
  // Mark a contact as sent and update UI; all error/success logic is handled here
  const markAsSent = async (messageId: string, contactId: string) => {
    // Animate the row first, then update state
    const key = `${messageId}:${contactId}`;
    if (!rowAnimations[key]) return; // Defensive: should always exist
    Animated.timing(rowAnimations[key], {
      toValue: 0,
      duration: 350,
      useNativeDriver: false,
    }).start(() => {
      // After animation, update state
      setMessages(prev => prev.map(msg => {
        if (msg.message_id === messageId) {
          return {
            ...msg,
            // Remove contact from matched_contacts
            matched_contacts: msg.matched_contacts.filter(c => c.shared_contact_id !== contactId),
            // Instantly increment sent_count for immediate feedback
            sent_count: (msg.sent_count ?? 0) + 1,
          };
        }
        return msg;
      }));
      setSentMessages(prev => {
        const updatedSent = { ...prev };
        if (!Array.isArray(updatedSent[messageId])) {
          updatedSent[messageId] = [];
        }
        const contactIdStr = contactId.toString();
        if (!updatedSent[messageId].includes(contactIdStr)) {
          updatedSent[messageId].push(contactIdStr);
        }
        return updatedSent;
      });
      setSentCounts(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || 0) + 1
      }));
      setActiveSwipeContact(null);
      // Clean up animation value
      setRowAnimations(prev => {
        const newAnims = { ...prev };
        delete newAnims[key];
        return newAnims;
      });
    });
    // API call in background for optimistic UI
    let offlineMode = false;
    let apiError = null;
    try {
      const response = await markMessageAsSent(messageId, contactId);
      offlineMode = response?.offline === true;
    } catch (error) {
      console.error('Error marking message as sent:', error);
      apiError = error;
    }
    setLoading(false);
    if (apiError) {
      Alert.alert(
        "Warning",
        "Message marked as sent locally, but we couldn't update the server. Changes will sync when you reconnect."
      );
    } else if (offlineMode) {
      Alert.alert(
        "Success (Offline Mode)",
        "Message marked as sent in the app. Changes will sync when you reconnect."
      );
    }
  };
  


  // Function to get sent count for a message
  const getSentCount = (messageId: string): number => {
    return sentCounts[messageId] || 0;
  };
  
  // Function to check if a contact is marked as sent
  const isContactSent = (messageId: string, contactId: string): boolean => {
    const arr = Array.isArray(sentMessages[messageId]) ? sentMessages[messageId] : [];
    return new Set(arr.map(String)).has(contactId.toString());
  };

  // Function to open native Messages app with pre-populated content
  const openNativeMessagesApp = (phoneNumber: string, messageContent: string) => {
    // Debug logs
    console.log('Phone Number:', phoneNumber);
    console.log('Message Content:', messageContent);
    
    // Format the phone number (remove any non-numeric characters)
    const formattedNumber = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';
    const safeMessageContent = messageContent || 'Hello';
    
    console.log('Formatted Number:', formattedNumber);
    console.log('Safe Message Content:', safeMessageContent);
    
    // Create the SMS URL
    let smsUrl;
    
    // iOS uses a different format than Android
    if (Platform.OS === 'ios') {
      // For iOS, we need to use the format: sms:<phone>&body=<message>
      // The & is important - it's not ?body like in Android
      smsUrl = `sms:${formattedNumber}&body=${encodeURIComponent(safeMessageContent)}`;
      console.log('iOS SMS URL:', smsUrl);
    } else {
      // Android format
      smsUrl = `sms:${formattedNumber}?body=${encodeURIComponent(safeMessageContent)}`;
      console.log('Android SMS URL:', smsUrl);
    }
    
    // Open the Messages app
    Linking.canOpenURL(smsUrl)
      .then(supported => {
        if (supported) {
          console.log('Opening URL:', smsUrl);
          return Linking.openURL(smsUrl);
        } else {
          console.log('URL not supported:', smsUrl);
          
          // Try a fallback approach for iOS
          if (Platform.OS === 'ios') {
            const fallbackUrl = `sms:${formattedNumber}`;
            console.log('Trying fallback URL:', fallbackUrl);
            
            return Linking.openURL(fallbackUrl).then(() => {
              // Show a toast or alert that the user needs to paste the message manually
              setTimeout(() => {
                Alert.alert(
                  "Message Ready",
                  "Please paste this message:\n\n" + safeMessageContent,
                  [
                    { text: "Copy Message", onPress: () => {
                      // In a real app, we would use Clipboard.setString(safeMessageContent)
                      // But for now, just show the message
                      Alert.alert("Message to Send", safeMessageContent);
                    }},
                    { text: "OK" }
                  ]
                );
              }, 1000);
            });
          } else {
            Alert.alert(
              "Error",
              "Your device doesn't support sending SMS messages."
            );
          }
        }
      })
      .catch(error => {
        console.error('Error opening Messages app:', error);
        Alert.alert(
          "Error",
          "Could not open the Messages app. Please try again."
        );
      });
  };

  // Function to handle send button press
  const handleSendPress = async (messageId: string, contactId: string, contactName: string, phoneNumber: string, messageContent: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }
      
      // Get current user data for variable replacement
      let userData = {};
      try {
        // First try to get from AsyncStorage
        const userDataStr = await AsyncStorage.getItem('userData');
        userData = userDataStr ? JSON.parse(userDataStr) : {};
        
        // If no user data in storage, try to fetch from API
        if (!userData || Object.keys(userData).length === 0) {
          console.log('No user data in storage, fetching from API...');
          const currentUser = await getCurrentUser();
          if (currentUser) {
            userData = {
              first_name: currentUser.first_name,
              last_name: currentUser.last_name,
              city: currentUser.city,
              ...currentUser
            };
            // Save to storage for future use
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
          }
        }
        
        console.log('User data for variables:', JSON.stringify(userData, null, 2));
      } catch (error) {
        console.error('Error getting user data:', error);
        // Continue with empty user data if there's an error
        userData = {};
      }
      
      // Get contact data from the matched_contacts array
      const currentMessage = messages.find(m => m.message_id === messageId);
      const contactData = currentMessage?.matched_contacts?.find(
        (c: any) => (c.shared_contact_id || c.contact_id || c.id) === contactId
      ) || {};
      
      console.log('Contact data:', JSON.stringify(contactData, null, 2));
      
      // Extract city and zip separately
      const contactCity = contactData.city || contactData.matched_target?.city || '';
      const contactZip = contactData.zip || contactData.matched_target?.zip_code || '';
      
      // Prepare user and contact data for variable replacement
      const userReplacementData = {
        first_name: userData.first_name || userData.firstName || '',
        last_name: userData.last_name || userData.lastName || '',
        city: userData.city || userData.location?.city || ''
      };
      
      const contactReplacementData = {
        first_name: contactData.first_name || contactData.firstName || contactData.matched_target?.first_name || '',
        last_name: contactData.last_name || contactData.lastName || contactData.matched_target?.last_name || '',
        city: contactCity,
        zip: contactZip
      };
      
      console.log('User replacement data:', userReplacementData);
      console.log('Contact replacement data:', contactReplacementData);
      
      // Replace variables in the message content
      const processedContent = replaceMessageVariables(
        messageContent,
        userReplacementData,
        contactReplacementData
      );
      
      console.log('Original message:', messageContent);
      console.log('Processed message:', processedContent);
      
      // Ensure proper Bearer format
      const authToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      
      console.log('Sending message with token:', authToken.substring(0, 20) + '...');
      
      // Open the native Messages app with processed content
      openNativeMessagesApp(phoneNumber, processedContent);
      
      // Then ask if the message was sent successfully
      setTimeout(() => {
        Alert.alert(
          "Mark as Sent",
          `Did you send this message to ${contactName}?`,
          [
            { text: "No", style: "cancel" },
            { 
              text: "Yes", 
              onPress: async () => {
                await markAsSent(messageId, contactId);
              }
            }
          ]
        );
      }, 500); // Short delay to allow Messages app to open first
    } catch (error) {
      console.error('Error in handleSendPress:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Initial load of contacts
  React.useEffect(() => {
    const loadInitialContacts = async () => {
      setLoading(true);
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser?.id) throw new Error('User not found');
        
        const response = await makeDirectApiCall(
          `/api/contacts/shared?user_id=${currentUser.id}&skip=0&limit=${200}`, 
          'GET'
        );
        
        const initialContacts = response?.data?.contacts || response?.data || [];
        setSharedContacts(initialContacts);
        setHasMore(initialContacts.length === 200);
        setPage(2); // Next page to load is 2
      } catch (error) {
        console.error('Failed to load contacts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialContacts();
  }, []);

  const loadMoreContacts = async ({distanceFromEnd}: {distanceFromEnd: number}) => {
    if (!hasMore || loading || distanceFromEnd < 0) return;
    
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.id) throw new Error('User not found');
      
      const response = await makeDirectApiCall(
        `/api/contacts/shared?user_id=${currentUser.id}&skip=${(page-1)*200}&limit=${200}`, 
        'GET'
      );
      
      const newContacts = response?.data?.contacts || response?.data || [];
      
      // Filter out any duplicates before adding to state
      const uniqueNewContacts = newContacts.filter(newContact => 
        !sharedContacts.some(existingContact => 
          existingContact.shared_contact_id === newContact.shared_contact_id
        )
      );
      
      setSharedContacts(prev => [...prev, ...uniqueNewContacts]);
      setHasMore(uniqueNewContacts.length === 200);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load more contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const PAGE_SIZE = 200; // Number of contacts to fetch per page
  
  // Filter messages to exclude skipped contacts and sent messages
  const filteredMessages = messages.map((msg: any) => {
    const arr = Array.isArray(sentMessages[msg.message_id]) ? sentMessages[msg.message_id] : [];
    const sentForMessage = new Set(arr.map(String));
    return {
      ...msg,
      matched_contacts: msg.matched_contacts.filter(
        (contact: any) => {
          const contactId = contact.shared_contact_id?.toString();
          return !sentForMessage.has(contactId) && 
                 !skippedContactIds.has(contact.shared_contact_id || contact.id);
        }
      )
    };
  });

  const renderMatchedMessages = () => (
    <View style={styles.edgeToEdgeContainer}>
      {/* Message cards with full width */}
      {filteredMessages.map((msg) => {
        const isExpanded = expandedMessages[msg.message_id] || filteredMessages.length === 1;
        // Debug log the message structure
        console.log('Message object:', JSON.stringify(msg, null, 2));
        
        return (
        <View key={msg.message_id} style={styles.edgeToEdgeCard}>
          <View style={styles.cardHeader}>
            <TouchableOpacity 
              onPress={() => toggleMessageExpanded(msg.message_id)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}
            >
              <Text style={styles.messageTitle} numberOfLines={2} ellipsizeMode="tail">{msg.message_name}</Text>
              {filteredMessages.length > 1 && (
                <Icon 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>
          </View>
          
          {isExpanded && (
            <>
              <View style={styles.divider} />
              
              <View style={styles.contactsHeader}>
                <Icon name="people" size={20} color={theme.colors.primary} />
                <Text style={styles.contactsHeaderText}>Target Contacts</Text>
                <View style={styles.contactsCount}>
                  <Text style={styles.contactsCountText}>
                    {/* Count unique contacts by shared_contact_id */}
                    {new Set(msg.matched_contacts.map((c: any) => c.shared_contact_id)).size}
                  </Text>
                </View>
                
                {/* Messages Sent counter */}
                <View style={styles.sentMessagesContainer}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success || "#4CD964"} />
                  <Text style={styles.sentMessagesText}>Messages Sent: {msg.sent_count ?? 0}</Text>
                </View>
              </View>
              
              <View style={styles.contactsList}>
                {(() => {
                  // Filter out contacts that have already been sent
                  const filteredContacts = msg.matched_contacts.filter((contact: any) => {
                    // Use shared_contact_id as the primary ID, fall back to contact_id if not available
                    const contactId = contact.shared_contact_id || contact.contact_id || contact.id;
                    return !isContactSent(msg.message_id, contactId);
                  });
                  
                  // If no contacts left, show a message
                  if (filteredContacts.length === 0) {
                    return (
                      <View style={styles.noContactsContainer}>
                        <Text style={styles.noContactsText}>All contacts have been messaged!</Text>
                      </View>
                    );
                  }
                  
                  // Apply contact pagination
                  const contactLimit = contactLimits[msg.message_id] || 10;
                  const hasMoreContacts = filteredContacts.length > contactLimit;
                  
                  return (
                    <>
                      {filteredContacts.slice(0, contactLimit).map((contact: any) => {
                        const contactId = contact.shared_contact_id || contact.contact_id || contact.id;
                        const key = `${msg.message_id}:${contactId}`;
                        // Set up animation value if not already present
                        if (!rowAnimations[key]) {
                          rowAnimations[key] = new Animated.Value(1);
                          setRowAnimations(prev => ({ ...prev, [key]: rowAnimations[key] }));
                        }

                        const contactName = `${contact.first_name} ${contact.last_name}`;
                        // Get phone number - handle different possible data structures
                        let phoneNumber = '';
                        
                        // Try to get phone number from different possible locations in the data
                        // Based on the console output, we can see the phone number is in mobile1
                        if (contact.mobile1) {
                          // This is the correct field based on the API response
                          phoneNumber = contact.mobile1;
                          console.log('Found phone number in mobile1:', phoneNumber);
                        } else if (contact.phone_number) {
                          phoneNumber = contact.phone_number;
                        } else if (contact.phone && typeof contact.phone === 'string') {
                          phoneNumber = contact.phone;
                        } else if (contact.phone_numbers && Array.isArray(contact.phone_numbers) && contact.phone_numbers.length > 0) {
                          if (typeof contact.phone_numbers[0] === 'object' && contact.phone_numbers[0].number) {
                            phoneNumber = contact.phone_numbers[0].number;
                          } else if (typeof contact.phone_numbers[0] === 'string') {
                            phoneNumber = contact.phone_numbers[0];
                          }
                        } else if (contact.phones && Array.isArray(contact.phones) && contact.phones.length > 0) {
                          if (typeof contact.phones[0] === 'object' && contact.phones[0].number) {
                            phoneNumber = contact.phones[0].number;
                          } else if (typeof contact.phones[0] === 'string') {
                            phoneNumber = contact.phones[0];
                          }
                        }
                        
                        // Ensure we have a valid phone number format
                        if (!phoneNumber || phoneNumber.trim() === '') {
                          phoneNumber = ''; // Default empty string if no valid phone number found
                        }
                        
                        return (
                          <Animated.View
                            key={contact.shared_contact_id}
                            style={[
                              styles.contactRow,
                              {
                                opacity: rowAnimations[key],
                                height: rowAnimations[key].interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 72], // 72 is row height, adjust as needed
                                }),
                                marginVertical: rowAnimations[key].interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 8], // 8 is original marginVertical
                                }),
                              },
                            ]}
                          >
                            <View style={styles.contactAvatar}>
                              <Text style={styles.contactInitials}>
                                {contact.first_name?.[0]}{contact.last_name?.[0]}
                              </Text>
                            </View>
                            <View style={styles.contactInfo}>
                              <Text style={styles.contactName} numberOfLines={1} ellipsizeMode="tail">
                                {contactName}
                              </Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.sendButton} 
                              onPress={() => {
                                // Extract the correct message content by checking all possible properties
                                // Log the entire message object to debug
                                console.log('Message object for content extraction:', msg);
                                
                                // Try to find the message content in various possible locations
                                let messageContent = '';
                                if (msg.content) messageContent = msg.content;
                                else if (msg.message_content) messageContent = msg.message_content;
                                else if (msg.message_text) messageContent = msg.message_text;
                                else if (msg.text) messageContent = msg.text;
                                else if (msg.body) messageContent = msg.body;
                                else if (msg.message) messageContent = msg.message;
                                else if (typeof msg.message === 'object' && msg.message.content) messageContent = msg.message.content;
                                
                                // If we still don't have content, use the message name as fallback
                                if (!messageContent && msg.message_name) {
                                  messageContent = msg.message_name;
                                }
                                
                                // Debug log the contact ID that will be used
                                const contactId = contact.shared_contact_id || contact.contact_id || contact.id;
                                console.log('Using contact ID for sending:', contactId);
                                
                                console.log('Final message content found:', messageContent);
                                
                                // Use the properly resolved contact ID
                                const contactIdForSending = contact.shared_contact_id || contact.contact_id || contact.id;
                                
                                // Log the IDs being used
                                console.log('Message ID:', msg.message_id);
                                console.log('Contact ID for sending:', contactIdForSending);
                                
                                handleSendPress(
                                  msg.message_id, 
                                  contactIdForSending, 
                                  contactName,
                                  phoneNumber,
                                  messageContent
                                );
                              }}
                            >
                              <Icon name="paper-plane" size={16} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.menuButton}
                              onPress={() => {
                                setSelectedContact(contact);
                                setMenuVisible(true);
                              }}
                            >
                              <Icon name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                          </Animated.View>
                        );
                      })}
                      {hasMoreContacts && (
                        <TouchableOpacity 
                          style={styles.loadMoreButton}
                          onPress={() => loadMoreContacts(msg.message_id)}
                        >
                          <Text style={styles.loadMoreText}>Load More Contacts</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>
            </>
          )}
        </View>
      );
    })}
    
    </View>
  );

  // Function to render all shared contacts for identification
  // Filter contacts based on search query and skipped status
  const filteredContacts = React.useMemo(() => {
    // First filter out skipped contacts
    const nonSkippedContacts = sharedContacts.filter(contact => {
      const contactId = contact.shared_contact_id || contact.id;
      return !skippedContactIds.has(contactId);
    });
    
    // Then apply search filter
    if (!searchQuery) return nonSkippedContacts;
    
    const query = searchQuery.toLowerCase().replace(/[^\d\w]/g, '');
    
    return nonSkippedContacts.filter(contact => {
      // Search name fields
      const nameMatch = 
        (contact.first_name?.toLowerCase().includes(query) || 
         contact.last_name?.toLowerCase().includes(query));
      
      // Search phone numbers (first mobile number only)
      const phoneMatch = contact.mobile_numbers?.[0]?.replace(/[^\d]/g, '').includes(query);
      
      return nameMatch || phoneMatch;
    });
  }, [sharedContacts, searchQuery, skippedContactIds]);
  
  // Function to handle skipping a contact
  const handleSkipContact = async () => {
    if (!selectedContact) return;
    closeMenu();
    
    try {
      const token = await AsyncStorage.getItem('token');
      const contactId = selectedContact.shared_contact_id || selectedContact.id;
      
      // Use query parameter format that matches backend expectation
      const response = await api.post(
        `/api/contacts/skip?shared_contact_id=${contactId}`,
        {}, // Empty body
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (response.data?.status === 'success') {
        setSkippedContactIds(prev => new Set([...prev, contactId]));
        Alert.alert('Success', 'Contact skipped successfully');
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to skip contact');
      }
    } catch (error: any) {
      console.error('Error skipping contact:', error);
      const errorMessage = error.response?.data?.detail?.[0] || 
                         error.response?.data?.message || 
                         'Failed to skip contact';
      Alert.alert('Error', errorMessage);
    }
  };
  
  // Function to handle menu option selection
  const handleMenuOptionSelect = (option: string) => {
    if (!selectedContact) return;
    
    const contactId = selectedContact.shared_contact_id || selectedContact.id;
    
    switch (option) {
      case 'view':
        navigation.navigate('Identification', { contact: selectedContact });
        setMenuVisible(false);
        setSelectedContact(null);
        break;
      case 'skip':
        Alert.alert(
          'Skip Contact',
          'Are you sure you want to skip this contact permanently?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {
              setMenuVisible(false);
              setSelectedContact(null);
            }},
            { text: 'Skip', style: 'destructive', onPress: () => handleSkipContact() }
          ]
        );
        break;
      default:
        setMenuVisible(false);
        setSelectedContact(null);
    }
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Icon name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Icon name="close-circle" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderSharedContacts = () => (
    <View style={styles.edgeToEdgeContainer}>
      {renderSearchBar()}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => {
          if (item.shared_contact_id) return `contact-${item.shared_contact_id}`;
          if (item.contact_id) return `contact-${item.contact_id}`;
          if (item.id) return `contact-${item.id}`;
          
          // Final fallback - should never happen with valid data
          console.warn('Contact missing unique identifier:', item);
          return `contact-fallback-${Math.random().toString(36).substr(2, 9)}`;
        }}
        renderItem={({ item }) => {
          const uniqueKey = item.shared_contact_id || item.contact_id || item.id || `fallback-${Math.random().toString(36).substr(2, 9)}`;
          const contactId = item.shared_contact_id || item.contact_id || item.id;
          const status = contactId ? identificationStatus[contactId] : undefined;
          
          // Determine status indicator
          let statusIcon = null;
          if (status) {
            if (status.answered_questions > 0 && status.answered_questions < status.total_questions) {
              // Yellow checkmark for partial completion
              statusIcon = (
                <View style={styles.statusIndicator}>
                  <Icon name="checkmark-circle" size={18} color="#FFC107" />
                </View>
              );
            } else if (status.answered_questions >= status.total_questions && status.total_questions > 0) {
              // Green checkmark for full completion
              statusIcon = (
                <View style={styles.statusIndicator}>
                  <Icon name="checkmark-circle" size={18} color="#4CAF50" />
                </View>
              );
            }
          }
          
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('Identification', { contact: item })}
              activeOpacity={0.8}
            >
              <View key={`contact-${uniqueKey}`} style={styles.edgeToEdgeCard}>
                <View style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Icon name="person" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.contactInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.contactName}>
                        {item.first_name} {item.last_name}
                      </Text>
                      {statusIcon}
                    </View>
                    <Text style={styles.contactDetail}>
                      {item.mobile_numbers && item.mobile_numbers.length > 0 
                        ? formatPhoneNumber(item.mobile_numbers[0]) 
                        : 'No phone number'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.menuButton}
                    onPress={() => {
                      setSelectedContact(item);
                      setMenuVisible(true);
                    }}
                  >
                    <Icon name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="people" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyStateText}>No shared contacts found</Text>
          </View>
        }
        onEndReached={loadMoreContacts}
        onEndReachedThreshold={0.5}
      />
    </View>
  );

  // Use layout effect to measure screen height and set it to state
  const [screenHeight, setScreenHeight] = React.useState(0);
  
  React.useLayoutEffect(() => {
    // Get screen dimensions
    const { height } = Dimensions.get('window');
    setScreenHeight(height);
  }, []);
  
  useEffect(() => {
    const loadSentData = async () => {
      try {
        const savedSent = await AsyncStorage.getItem('sentMessages');
        const savedCounts = await AsyncStorage.getItem('sentCounts');
        
        if (savedSent) setSentMessages(JSON.parse(savedSent));
        if (savedCounts) setSentCounts(JSON.parse(savedCounts));
      } catch (error) {
        console.error('Error loading sent data:', error);
      }
    };
    
    loadSentData();
  }, []);

  useEffect(() => {
    const saveSentData = async () => {
      try {
        await AsyncStorage.setItem('sentMessages', JSON.stringify(sentMessages));
        await AsyncStorage.setItem('sentCounts', JSON.stringify(sentCounts));
      } catch (error) {
        console.error('Error saving sent data:', error);
      }
    };
    
    saveSentData();
  }, [sentMessages, sentCounts]);

  // Contact options menu modal
  const renderOptionsMenu = () => (
    <Modal
      visible={menuVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setMenuVisible(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setMenuVisible(false)}
      >
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => handleMenuOptionSelect('view')}
          >
            <Icon name="eye-outline" size={20} color={theme.colors.text} />
            <Text style={styles.menuItemText}>View Details</Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => handleMenuOptionSelect('skip')}
          >
            <Icon name="close-circle-outline" size={20} color={theme.colors.error} />
            <Text style={[styles.menuItemText, {color: theme.colors.error}]}>Skip Contact Permanently</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderMenu = () => (
    <Modal
      transparent={true}
      visible={menuVisible}
      onRequestClose={() => setMenuVisible(false)}
    >
      <TouchableOpacity 
        style={styles.menuOverlay} 
        activeOpacity={1} 
        onPress={() => setMenuVisible(false)}
      >
        <View style={styles.menuOptions}>
          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => {
              setMenuVisible(false);
              // View details placeholder
            }}
          >
            <Text style={styles.menuOptionText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={handleSkipContact}
          >
            <Text style={styles.menuOptionText}>Skip Contact Permanently</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedContact(null);
  };

  return (
    <View style={styles.container}>
      {renderOptionsMenu()}
      {renderMenu()}
      
      {/* Main content with precise top padding */}
      <View style={styles.content}>
        {/* iOS-style Tab Navigation */}
        <View style={[styles.iosTabsContainer, {marginTop: (Platform.OS === 'ios' ? 44 : StatusBar.currentHeight) + 18}]}>
          <View style={styles.iosTabsWrapper}>
            <TouchableOpacity
              style={[
                styles.iosTabButton,
                selectedTab === 'Messaging' && styles.iosTabButtonActive
              ]}
              onPress={() => setSelectedTab('Messaging')}
              activeOpacity={0.7}
            >
              <Icon 
                name={selectedTab === 'Messaging' ? "chatbubbles" : "chatbubbles-outline"} 
                size={22} 
                color={selectedTab === 'Messaging' ? theme.colors.primary : '#8E8E93'} 
                style={styles.iosTabIcon}
              />
              <Text style={[styles.iosTabText, selectedTab === 'Messaging' && styles.iosTabTextActive]}>Messaging</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.iosTabButton,
                selectedTab === 'Identification' && styles.iosTabButtonActive
              ]}
              onPress={() => setSelectedTab('Identification')}
              activeOpacity={0.7}
            >
              <Icon 
                name={selectedTab === 'Identification' ? "person-circle" : "person-circle-outline"} 
                size={22} 
                color={selectedTab === 'Identification' ? theme.colors.primary : '#8E8E93'} 
                style={styles.iosTabIcon}
              />
              <Text style={[styles.iosTabText, selectedTab === 'Identification' && styles.iosTabTextActive]}>Identification</Text>
            </TouchableOpacity>
          </View>
          
          {/* Full-width tab indicator */}
          <View 
            style={[
              styles.iosTabIndicator,
              { left: selectedTab === 'Messaging' ? 0 : '50%' }
            ]} 
          />
        </View>

        {/* Tab Content - Full Width */}
        {selectedTab === 'Messaging' ? (
          <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerContent}>
                <Icon name="cloud-download-outline" size={48} color={theme.colors.primary} />
                <Text style={styles.statusText}>Loading messages...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContent}>
                <Icon name="alert-circle-outline" size={48} color={theme.colors.error} />
                <Text style={[styles.statusText, {color: theme.colors.error}]}>{error}</Text>
              </View>
            ) : filteredMessages.length > 0 ? (
              renderMatchedMessages()
            ) : (
              <View style={styles.fullWidthSuccess}>
                <View style={styles.successContainerStyle}>
                  <Icon name="checkmark-circle-outline" size={64} color={theme.colors.primary} style={styles.successIcon} />
                  <Text style={styles.successTitle}>Contacts Shared Successfully</Text>
                  <Text style={styles.successText}>
                    We'll notify you when messages are ready for your contacts.
                  </Text>
                </View>
                
                <View style={styles.fullWidthCard}>
                  <Text style={styles.cardTitle}>Next Steps</Text>
                  <View style={styles.actionRow}>
                    <Icon name="person-circle-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.actionText}>
                      Visit <Text style={styles.boldText}>Identification</Text> to add details about your contacts
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <Icon name="people-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.actionText}>
                      Check <Text style={styles.boldText}>Neighbors</Text> to help reach nearby voters
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        ) : (
          renderSharedContacts()
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    paddingTop: STATUS_BAR_HEIGHT + 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
    marginHorizontal: 10,
    marginVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 8,
    marginRight: -8,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  // Full edge-to-edge container styles
  fullContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    width: '100%',
  },
  iosTabsContainer: {
    backgroundColor: '#fff',
    width: '100%',
    paddingTop: STATUS_BAR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 1,
  },
  iosTabsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  iosTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: 'transparent',
  },
  iosTabButtonActive: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  iosTabIcon: {
    marginRight: 8,
  },
  iosTabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    letterSpacing: -0.2,
  },
  iosTabTextActive: {
    color: theme.colors.primary,
  },
  iosTabIndicator: {
    position: 'absolute',
    bottom: -1,
    width: '50%',
    height: 2,
    backgroundColor: theme.colors.primary,
  },
  fullWidthContent: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  statusText: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
    marginTop: 16,
  },
  fullWidthSuccess: {
    flex: 1,
    width: '100%',
  },
  // Edge-to-edge messaging styles
  edgeToEdgeContainer: {
    flex: 1,
    width: '100%',
  },
  // Modern header with gradient and better spacing
  fullWidthHeader: {
    width: '100%',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 8,
  },
  // headerTitle style moved to avoid duplicates
  headerSubtitle: {
    fontSize: 15,
    color: `${theme.colors.onPrimary}e6`, // Using template literal for opacity
    fontWeight: '400',
    lineHeight: 20,
  },
  edgeToEdgeCard: {
    backgroundColor: theme.colors.surface || '#fff',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 20,
    paddingBottom: 12,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 0,
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border || '#eee',
    width: '100%',
    marginBottom: 16,
  },
  contactsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  contactsHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: 8,
    flex: 1,
  },
  contactsCount: {
    backgroundColor: theme.colors.primaryLight || 'rgba(0,122,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 10,
  },
  contactsCountText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  sentMessagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,217,100,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sentMessagesText: {
    color: theme.colors.success || '#4CD964',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContactsMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    flexDirection: 'row',
  },
  emptyContactsText: {
    fontSize: 15,
    color: theme.colors.success || '#4CD964',
    fontWeight: '500',
    marginLeft: 8,
  },
  contactsList: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowRadius: 4,
    elevation: 3,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },

  menuButton: {
    padding: 8,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    width: '80%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Success screen styles
  // Moved to bottom of file to avoid duplicates
  // Moved to bottom of file to avoid duplicates
  fullWidthCard: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: '100%',
  },
  // cardTitle style moved to the bottom of the file to avoid duplicates
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 12,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  tabContentPlaceholder: {
    padding: 20,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  // container style defined elsewhere
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: '#fff',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 1,
  },
  tabButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    position: 'relative',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  tabContentFull: {
    flex: 1,
    width: '100%',
    padding: 24,
    paddingTop: 32,
  },
  // tabContentPlaceholder style defined elsewhere
  tabContent: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  successContainerStyle: {
    alignItems: 'center',
    marginBottom: 32,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    marginLeft: 4,
  },
  successIcon: {
    marginBottom: 16,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },
  infoCard: {
    backgroundColor: theme.colors.backgroundVariant,
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  cardText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    flex: 1,
  },
  // boldText style defined elsewhere
  loadMoreButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadMoreText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noContactsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    flexDirection: 'row',
  },
  noContactsText: {
    fontSize: 15,
    color: theme.colors.success || '#4CD964',
    fontWeight: '500',
    marginLeft: 8,
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20, 
  },
  // Contact component styles moved to avoid duplicates
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  menuButton: {
    padding: 8,
    marginLeft: 8,
  },
  menuOptions: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 8,
  },
  menuOption: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuOptionText: {
    color: theme.colors.text,
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ContactsSharedScreen;
