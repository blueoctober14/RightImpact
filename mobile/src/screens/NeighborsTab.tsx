import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';
import { useIsFocused } from '@react-navigation/native';
// Removed ContactCard import as it's not a separate component here
import IonIcon from 'react-native-vector-icons/Ionicons'; // For contact card icons
import Button from '../components/Button';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Collapsible from 'react-native-collapsible';
import { API_URL } from '../utils/api';

// Define interfaces for data from the backend
// Helper function to format phone number as xxx-xxx-xxxx
const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return 'No phone number';
  // Remove all non-digit characters
  const cleaned = ('' + phone).replace(/\D/g, '');
  // Format as xxx-xxx-xxxx if we have at least 10 digits
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
};

interface NeighborContact {
  id: number;
  voter_id: string;
  first_name: string;
  last_name: string;
  zip_code: string;
  address_1: string;
  city: string;
  state: string;
  cell_1: string;
  list_id: number;
}

interface NeighborMessage {
  id: number;
  name: string;
  content: string;
  media_url: string;
  contacts: NeighborContact[];
  total_contacts_in_zip: number;
  contact_offset: number; // To keep track of pagination for this message
  is_collapsed: boolean; // UI state for collapsible card
  sent_count: number; // To track messages sent for this template
}

interface SentMessage {
  id: number;
  message_template_id: number;
  target_contact_id: number;
  sent_at: string;
}

interface SharedContact {
  id: number;
  mobile1: string;
  mobile2: string;
  user_id: number;
}

interface TargetContact {
  id: number;
  first_name: string;
  last_name: string;
  cell_1: string;
}

const CONTACT_PAGE_SIZE = 10;

const NeighborsTab: React.FC = () => {
  // 1. Context hooks first
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  
  // 2. All state hooks next
  const [messages, setMessages] = useState<NeighborMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sharedContacts, setSharedContacts] = useState<SharedContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedContactsCount, setLoadedContactsCount] = useState(CONTACT_PAGE_SIZE);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [visibleContacts, setVisibleContacts] = useState<NeighborContact[]>([]);
  const [allContacts, setAllContacts] = useState<NeighborContact[]>([]);
  const [actualAvailableContacts, setActualAvailableContacts] = useState(0);

  // 3. Derived state and memoized values
  const filteredMessages = useMemo(() => {
    return messages.map((message) => {
      const filteredContacts = message.contacts.filter((contact) => {
        // Convert IDs to numbers for comparison
        const messageIdNum = Number(message.id);
        const contactIdNum = Number(contact.id);
        
        const alreadySent = sentMessages.some(
          (sm) => {
            const sentMessageId = sm.message_template_id ? Number(sm.message_template_id) : NaN;
            const sentContactId = sm.target_contact_id ? Number(sm.target_contact_id) : NaN;
            return sentMessageId === messageIdNum && sentContactId === contactIdNum;
          }
        );
        
        // Skip if no cell number
        if (!contact.cell_1) {
          console.log('Contact has no cell number - cannot be shared');
          return true;
        }
        
        // Clean contact's phone number
        const cleanCell = contact.cell_1.replace(/[^0-9]/g, '');
        
        // Check against shared contacts
        const isShared = sharedContacts.some((sc) => {
          const cleanMobile1 = sc.mobile1?.replace(/[^0-9]/g, '') || '';
          const cleanMobile2 = sc.mobile2?.replace(/[^0-9]/g, '') || '';
          
          const isMatch = (cleanMobile1 === cleanCell || cleanMobile2 === cleanCell) &&
                        sc.user_id === user?.id;
          
          if (isMatch) {
            console.log('Contact matches shared contact:', 
              { 
                contactCell: cleanCell, 
                sharedMobile1: cleanMobile1, 
                sharedMobile2: cleanMobile2,
                sharedUserId: sc.user_id,
                currentUserId: user?.id
              }
            );
          }
          
          return isMatch;
        });
        
        if (isShared) {
          console.log('Filtering out shared contact');
          return false;
        }
        
        return true;
      });
      
      console.log(`Message ${message.id} filtered contacts:`, 
        filteredContacts.map(c => `${c.first_name} (${c.cell_1})`)
      );
      
      return {
        ...message,
        contacts: filteredContacts
      };
    });
  }, [messages, sentMessages, sharedContacts, user?.id]);
  
  const totalAvailableContacts = useMemo(() => {
    const count = filteredMessages.reduce(
      (total, message) => total + message.contacts.length, 
      0
    );
    console.log('Total contacts calculation:', count);
    return count;
  }, [filteredMessages]);

  const remainingContacts = Math.max(
    0, 
    Math.min(
      totalAvailableContacts,
      (user?.max_neighbor_messages || Infinity)
    ) - loadedContactsCount
  );

  useEffect(() => {
    const contacts = filteredMessages.flatMap(m => m.contacts);
    const maxContacts = user?.max_neighbor_messages || Infinity;
    const initialLimit = Math.min(CONTACT_PAGE_SIZE, maxContacts);
    
    setAllContacts(contacts);
    setVisibleContacts(contacts.slice(0, Math.min(loadedContactsCount, maxContacts)));
    
    console.log('Contact Calculation:', {
      total: contacts.length,
      visible: Math.min(contacts.length, loadedContactsCount, maxContacts),
      remaining: Math.max(0, Math.min(contacts.length, maxContacts) - loadedContactsCount)
    });
  }, [filteredMessages, loadedContactsCount, user?.max_neighbor_messages]);

  const canLoadMore = remainingContacts > 0 && 
    loadedContactsCount < (user?.max_neighbor_messages || Infinity);

  const handleLoadMore = useCallback(() => {
    const maxContacts = user?.max_neighbor_messages || Infinity;
    const newCount = Math.min(
      loadedContactsCount + CONTACT_PAGE_SIZE,
      allContacts.length,
      maxContacts
    );
    setLoadedContactsCount(newCount);
  }, [allContacts.length, loadedContactsCount, user?.max_neighbor_messages]);

  // 4. All callbacks
  const fetchNeighborMessages = useCallback(async () => {
    if (!user?.token) {
      setError('User not authenticated.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(
        `${API_URL}/api/message-templates/neighbors?contact_limit=${CONTACT_PAGE_SIZE}&contact_offset=0`,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail && typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData) || 'Failed to fetch neighbor messages.');
      }

      const data: NeighborMessage[] = await response.json();
      // Initialize is_collapsed and contact_offset for each message
      const initializedMessages = data.map((msg) => ({
        ...msg,
        is_collapsed: true, // Start with messages collapsed
        contact_offset: msg.contacts.length, // Start offset after initially loaded contacts
        sent_count: 0, // Initialize sent_count to 0
      }));
      setMessages(initializedMessages);
    } catch (err: any) {
      console.error('Error fetching neighbor messages:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  const fetchSentMessages = useCallback(async () => {
    if (!user?.token) {
      setError('User not authenticated.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch(
        `${API_URL}/api/sent_messages/neighbors`,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail && typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData) || 'Failed to fetch sent messages.');
      }

      const data: SentMessage[] = await response.json();
      setSentMessages(data);
    } catch (err: any) {
      console.error('Error fetching sent messages:', err);
      setError(err.message || 'An unexpected error occurred.');
    }
  }, [user?.token]);

  const fetchSharedContacts = useCallback(async () => {
    if (!user?.token) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/shared_contacts/my_contacts`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSharedContacts(data);
      }
    } catch (err) {
      console.error('Error fetching shared contacts:', err);
    }
  }, [user?.token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNeighborMessages();
    fetchSentMessages();
    fetchSharedContacts();
  }, [fetchNeighborMessages, fetchSentMessages, fetchSharedContacts]);

  const toggleMessageCollapse = useCallback((messageId: number) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === messageId ? { ...msg, is_collapsed: !msg.is_collapsed } : msg
      )
    );
  }, []);

  const handleSendMessage = useCallback(async (message: NeighborMessage, contact: NeighborContact) => {
    if (!message.content) {
      Alert.alert('Error', 'Message content cannot be empty.');
      return;
    }
    if (!user?.token || !user?.id) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/sent_messages/neighbors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            message_template_id: message.id,
            target_contact_id: contact.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save message.');
      }

      const responseData = await response.json();

      Alert.alert('Success', `Message sent to ${contact.first_name} ${contact.last_name}!`);

      // Remove the contact from the list after successful send
      setMessages((prevMessages) =>
        prevMessages.map((msg) => ({
          ...msg,
          contacts: msg.contacts.filter((c) => c.id !== contact.id),
          total_contacts_in_zip: msg.total_contacts_in_zip - 1,
          sent_count: (msg.sent_count || 0) + 1,
        }))
      );
      setSentMessages((prev) => [
        ...prev, 
        {
          id: responseData.message_id,
          message_template_id: message.id,
          target_contact_id: contact.id,
          sent_at: new Date().toISOString()
        }
      ]);
    } catch (err: any) {
      console.error('Error sending message:', err);
      Alert.alert('Error', err.message || 'Failed to send message.');
    }
  }, [user?.token, user?.id]);

  // 5. Effects last
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('User max_neighbor_messages:', user?.max_neighbor_messages);
        await Promise.all([
          fetchNeighborMessages(),
          fetchSentMessages(),
          fetchSharedContacts()
        ]);
        setInitialLoadComplete(true);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [fetchNeighborMessages, fetchSentMessages, fetchSharedContacts]);

  if (!initialLoadComplete && loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading neighbor messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try Again" onPress={onRefresh} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  if (messages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, styles.centerContent]}>
          <Text style={styles.emptyStateText}>No neighbor messages found for you.</Text>
          <Button title="Refresh" onPress={onRefresh} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <View style={[styles.contentContainer, { paddingTop: 25 }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, { paddingTop: 25 }]}>
            <Text style={styles.title}>Neighbors</Text>
            <Text style={styles.subtitle}>Help spread the word to your neighbors!</Text>
          </View>

          {filteredMessages.map((message) => (
            <View key={message.id} style={styles.messageCard}>
              <TouchableOpacity
                onPress={() => toggleMessageCollapse(message.id)}
                style={styles.messageHeader}
              >
                <Text style={styles.messageName}>{message.name}</Text>
                <Text style={styles.sentCountText}>Messages Sent: {message.sent_count}</Text>
                <Icon
                  name={message.is_collapsed ? 'chevron-down' : 'chevron-up'}
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
              <Collapsible collapsed={message.is_collapsed}>
                <View style={styles.messageContentContainer}>
                  <Text style={styles.messageContent}>{message.content}</Text>
                  {message.media_url && (
                    <Text style={styles.mediaUrl}>Media: {message.media_url}</Text>
                  )}

                  <View style={styles.contactsContainer}>
                    {visibleContacts.length > 0 ? (
                      visibleContacts.map((contact) => (
                        <View key={contact.id} style={styles.contactCardContainer}>
                          <View style={styles.contactCard}>
                            <View style={styles.contactAvatar}>
                              <Text style={styles.avatarText}>
                                {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                              </Text>
                            </View>
                            <Text style={styles.contactName}>
                              {contact.first_name} {contact.last_name}
                            </Text>
                            <TouchableOpacity 
                              style={styles.sendButton}
                              onPress={() => handleSendMessage(message, contact)}
                            >
                              <IonIcon name="paper-plane" size={16} color="white" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noContactsText}>No contacts for this message.</Text>
                    )}
                  </View>

                  {canLoadMore && (
                    <Button
                      title={`Load ${Math.min(remainingContacts, CONTACT_PAGE_SIZE)} more`}
                      onPress={handleLoadMore}
                      style={styles.loadMoreButton}
                    />
                  )}
                </View>
              </Collapsible>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 10,
  },
  emptyStateText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontSize: 16,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  messageCard: {
    backgroundColor: theme.colors.cardBackground,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.cardHeaderBackground,
  },
  messageName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
    paddingRight: 10,
  },
  messageContentContainer: {
    padding: 16,
    paddingTop: 0,
  },
  messageContent: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  mediaUrl: {
    fontSize: 12,
    color: theme.colors.primary,
    marginBottom: 10,
  },
  contactsContainer: {
    marginTop: 10,
  },
  noContactsText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  loadMoreButton: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    marginVertical: 10,
    marginHorizontal: 20
  },
  loadMoreText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  sentCountText: {
    color: theme.colors.success || '#4CD964',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  messageSenderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  messageTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  sendMessageButton: {},
  contactCardContainer: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  contactName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
    marginLeft: 8,
  },
});

export default NeighborsTab;
