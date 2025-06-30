import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  TextStyle,
  ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import ContactCard from '../components/ContactCard';
import Button from '../components/Button';

// Define the Contact interface
type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  phone?: string;
  address?: string;
  name?: string; // For backward compatibility
};

// Define the ContactAssignmentStats interface
type ContactAssignmentStats = {
  assigned: number;
  unassigned: number;
  total: number;
};

// Temporary mock implementations - replace with actual service calls
const getMessages = async (): Promise<Array<{ template_text: string }>> => [];
const getAvailableContacts = async (): Promise<Contact[]> => [];
const getContactAssignmentStats = async (): Promise<ContactAssignmentStats> => ({
  assigned: 0,
  unassigned: 0,
  total: 0
});
const assignContacts = async (): Promise<{ contacts?: Contact[] }> => ({});
const sendMessage = async (contactId: string, message: string): Promise<void> => {};
const updateLastActive = async (): Promise<void> => {};
const releaseContacts = async (): Promise<void> => {};

const CONTACTS_PER_USER = 5;

const NeighborsTab: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [remainingContacts, setRemainingContacts] = useState<number>(0);
  const [stats, setStats] = useState<ContactAssignmentStats>({
    assigned: 0,
    unassigned: 0,
    total: 0
  });
  const [currentContactIndex, setCurrentContactIndex] = useState<number>(0);
  const lastUpdate = useRef<number>(Date.now());

  // Update last active timestamp every minute
  useEffect(() => {
    const updateActiveStatus = async () => {
      try {
        await updateLastActive();
        lastUpdate.current = Date.now();
      } catch (error) {
        console.error('Failed to update last active:', error);
      }
    };

    const interval = setInterval(updateActiveStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load contacts on component mount
  useEffect(() => {
    const initialize = async () => {
      await loadContacts();
      const count = await getRemainingContactsCount();
      setRemainingContacts(count);
    };
    initialize();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadContacts();
      const count = await getRemainingContactsCount();
      setRemainingContacts(count);
    } catch (err) {
      setError('Failed to refresh contacts');
      console.error('Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const statsData = await getContactAssignmentStats();
      setStats(statsData);

      if (statsData.assigned < CONTACTS_PER_USER) {
        const assigned = await assignContacts();
        if (assigned?.contacts) {
          setContacts(assigned.contacts);
        }
      }

      const messages = await getMessages();
      setMessage(messages[0]?.template_text || '');

      const availableContacts = await getAvailableContacts();
      setContacts(availableContacts);
    } catch (err) {
      setError('Failed to load contacts');
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (contactId: string, message: string) => {
    if (!message) return;
    
    try {
      setLoading(true);
      await sendMessage(contactId, message);
      
      // Remove the contact after sending message
      setContacts(prev => prev.filter(contact => contact.id !== contactId));
      
      // Update remaining contacts count
      const count = await getRemainingContactsCount();
      setRemainingContacts(count);
      
      // Show success message or update UI
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleGetMoreContacts = async () => {
    try {
      setLoading(true);
      const assigned = await assignContacts();
      if (assigned?.contacts) {
        setContacts(prev => [...prev, ...assigned.contacts!]);
      }
      const count = await getRemainingContactsCount();
      setRemainingContacts(count);
    } catch (err) {
      setError('Failed to get more contacts');
      console.error('Error getting more contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRemainingContactsCount = async (): Promise<number> => {
    try {
      // Mock implementation - replace with actual API call
      return Math.max(0, CONTACTS_PER_USER - contacts.length);
    } catch (err) {
      console.error('Error getting remaining contacts count:', err);
      return 0;
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            title="Try Again" 
            onPress={onRefresh} 
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Render loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, styles.centerContent, styles.errorContainer]}>
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            title="Try Again" 
            onPress={onRefresh} 
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Render empty state
  if (contacts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, styles.centerContent]}>
          <Text style={styles.emptyStateText}>No contacts assigned yet</Text>
          <Button 
            title="Get New Contacts" 
            onPress={handleGetMoreContacts}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={theme.colors.background} 
      />
      
      <View style={[styles.contentContainer, { paddingTop: insets.top }]}>
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
          <View style={styles.header}>
            <Text style={styles.title}>Your Neighbors</Text>
            <Text style={styles.subtitle}>
              {contacts.length} contacts assigned • {remainingContacts} remaining
            </Text>
            
            <View style={styles.statsContainer}>
              <View style={[styles.statItem, { backgroundColor: theme.colors.primaryLight + '1A' }]}>
                <Text style={[styles.statValue, { color: theme.colors.primaryDark }]}>
                  {stats.assigned}
                </Text>
                <Text style={styles.statLabel}>Assigned</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: theme.colors.secondaryLight + '1A' }]}>
                <Text style={[styles.statValue, { color: theme.colors.secondaryDark }]}>
                  {stats.unassigned}
                </Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: theme.colors.backgroundVariant }]}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {stats.total}
                </Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          <View style={styles.contactsContainer}>
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                message={message}
                onSend={() => handleSendMessage(contact.id, message)}
              />
            ))}
          </View>
          
          {remainingContacts > 0 && (
            <View style={styles.footer}>
              <Button 
                title="Get More Contacts" 
                onPress={handleGetMoreContacts}
                variant="outline"
                fullWidth
              />
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// Define styles with proper TypeScript types
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
    paddingBottom: 32, // Using direct value since theme.spacing.xl might not be defined
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  
  // Header
  header: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb', // Light gray border
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text || '#1f2937', // Fallback color
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#6b7280',
    marginBottom: 16,
  },
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.colors.primary || '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary || '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Content
  contactsContainer: {
    padding: 16,
  },
  
  // States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary || '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error || '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary || '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  
  // Buttons
  button: {
    backgroundColor: theme.colors.primary || '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 200,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary || '#9ca3af',
    textAlign: 'center',
  },
  
  // Message
  messageLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#6b7280',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    color: theme.colors.text || '#1f2937',
    lineHeight: 24,
    marginBottom: 16,
  },
  
  // Send Button
  sendButton: {
    backgroundColor: theme.colors.primary || '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    minWidth: 150,
  },
});

export default NeighborsTab;
