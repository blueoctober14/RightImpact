import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList,
  TextInput,
  Platform,
  Alert,
  Linking,
  StatusBar,
  ListRenderItem
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme';
import Button from '../components/Button';
import { shareContacts, getContacts, requestContactsPermission } from '../services/contacts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

interface Contact {
  id: string;
  name: string;
  phone: string;
  shared: boolean;
}

// Define a generic type for navigation props since we're not using this screen directly anymore
type ContactSharingScreenProps = NativeStackScreenProps<any, any>;

const ContactSharingScreen: React.FC<ContactSharingScreenProps> = ({ navigation }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [shareState, setShareState] = useState<'notShared' | 'shared'>('notShared');
  const [matchingState, setMatchingState] = useState<'notStarted' | 'inProgress' | 'finished'>('notStarted');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    checkAndRequestPermission();
  }, []);

  const checkAndRequestPermission = async () => {
    console.log('=== checkAndRequestPermission called ===');
    let hasPermission = false;
    
    try {
      console.log('1. Setting loading state to true');
      setLoading(true);
      setError('');
      
      console.log('2. Starting permission check...');
      hasPermission = await requestContactsPermission();
      console.log('3. Permission check complete. Granted:', hasPermission);
      
      setPermissionGranted(hasPermission);
      
      if (hasPermission) {
        console.log('4. Permission granted, proceeding to load contacts...');
        await loadContacts();
      } else {
        const errorMsg = 'Contacts permission is required to share contacts. Please enable it in your device settings.';
        console.log('5. Permission denied:', errorMsg);
        setError(errorMsg);
        
        // If we're on iOS, we might need to guide the user to settings
        if (Platform.OS === 'ios') {
          console.log('6. Showing iOS permission alert...');
          Alert.alert(
            'Permission Required',
            'Please enable contacts access in Settings to continue.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => console.log('User cancelled settings dialog'),
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  console.log('User tapped Open Settings');
                  Linking.openSettings().catch(err => {
                    console.error('Error opening settings:', err);
                  });
                },
              },
            ],
            { cancelable: false }
          );
        }
      }
    } catch (err: any) {
      const errorMsg = `Failed to request contacts permission: ${err.message || 'Unknown error'}`;
      console.error('7. Error in checkAndRequestPermission:', errorMsg, err);
      setError(errorMsg);
      
      // Show error alert to user
      Alert.alert(
        'Error',
        'Failed to request contacts permission. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      console.log('8. Finalizing permission check, setting loading to false');
      setLoading(false);
      console.log('=== End of checkAndRequestPermission ===');
    }
  };

  const loadContacts = async () => {
    console.log('=== Starting loadContacts ===');
    
    try {
      console.log('1. Setting loading state to true');
      setLoading(true);
      setError('');
      
      console.log('2. Fetching contacts...');
      const contacts = await getContacts();
      console.log('3. Raw contacts data from getContacts:', JSON.stringify(contacts, null, 2));
      console.log(`3. Successfully loaded ${contacts.length} contacts`);
      
      if (contacts.length === 0) {
        console.log('4. No contacts found on device');
        setError('No contacts found on your device.');
        setContacts([]);
        return;
      }
      
      console.log('4. Sorting contacts...');
      // Sort contacts by name
      const sortedContacts = [...contacts].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      console.log(`5. Updating contacts state with ${sortedContacts.length} contacts`);
      setContacts(sortedContacts);
      
      // Initialize selected contacts set
      console.log('6. Initializing selected contacts set');
      setSelectedContacts(new Set());
      
      console.log('7. Contacts loaded successfully');
      
    } catch (err: any) {
      const errorMsg = `Failed to load contacts: ${err.message || 'Unknown error'}`;
      console.error('8. Error in loadContacts:', errorMsg, err);
      setError(errorMsg);
      
      // Show error alert to user
      Alert.alert(
        'Error Loading Contacts',
        'We encountered an error while loading your contacts. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: loadContacts,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } finally {
      console.log('9. Setting loading state to false');
      setLoading(false);
      console.log('=== End of loadContacts ===');
    }
  };

  const toggleContactSelection = (contact: Contact) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contact.id)) {
      newSelected.delete(contact.id);
    } else {
      newSelected.add(contact.id);
    }
    setSelectedContacts(newSelected);
  };

  const handleShareContacts = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get selected contacts
      const selected = contacts.filter(c => selectedContacts.has(c.id));
      
      if (selected.length === 0) {
        setError('Please select at least one contact to share');
        setLoading(false);
        return;
      }

      // Ensure we're only sending the necessary data
      const contactsToShare = selected.map(contact => ({
        name: contact.name,
        phone: contact.phone,
      }));

      await shareContacts(contactsToShare);
      setShareState('shared');
      setMatchingState('inProgress');
      
      // Clear selections after successful share
      setSelectedContacts(new Set());
      
      // Update UI to show contacts as shared
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          selectedContacts.has(contact.id) ? { ...contact, shared: true } : contact
        )
      );
      
      // Simulate matching process
      setTimeout(() => {
        setMatchingState('finished');
      }, 3000);
    } catch (err: any) {
      console.error('Error in handleShareContacts:', err);
      setError(err?.message || 'Failed to share contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery)
  );

  const renderContactItem: ListRenderItem<Contact> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.contactItem,
        selectedContacts.has(item.id) && styles.contactItemSelected,
      ]}
      onPress={() => toggleContactSelection(item)}
      disabled={loading}
    >
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>
      {item.shared ? (
        <View style={styles.sharedBadge}>
          <Text style={styles.sharedBadgeText}>Shared</Text>
        </View>
      ) : (
        <View style={styles.checkbox}>
          {selectedContacts.has(item.id) && (
            <Icon name="checkmark" size={16} color="#fff" />
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <View style={styles.errorContainer}>
            <Icon
              name="alert-circle-outline"
              size={48}
              color={theme.colors.error}
              style={styles.errorIcon}
            />
            <Text style={styles.errorTitle}>Unable to Access Contacts</Text>
            <Text style={styles.errorText}>{error}</Text>

            <View style={styles.buttonContainer}>
              <Button 
                title="Try Again" 
                onPress={checkAndRequestPermission} 
                style={styles.retryButton}
              />
              {Platform.OS === 'ios' && (
                <Button
                  title="Open Settings"
                  onPress={() => Linking.openSettings()}
                  style={[styles.retryButton, styles.settingsButton]}
                />
              )}
            </View>
          </View>
        </View>
      );
    }

    if (contacts.length === 0) {
      return (
        <View style={[styles.container, styles.centerContent]}>
          <Text style={styles.emptyText}>
            No contacts found. Please add contacts to your device.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        contentContainerStyle={styles.listContent}
        style={styles.contactList}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Share Contacts</Text>
          <Text style={styles.subtitle}>
            {shareState === 'notShared'
              ? 'Select contacts to share'
              : 'These contacts will be shared'}
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!loading}
            placeholderTextColor="#999"
          />
        </View>

        {renderContent()}

        {shareState === 'shared' && (
          <View style={styles.matchingContainer}>
            <Text style={styles.matchingText}>
              {matchingState === 'inProgress'
                ? 'Matching contacts with campaign targets...'
                : 'Matching complete!'}
            </Text>
            {matchingState === 'inProgress' && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={styles.matchingSpinner} />
            )}
          </View>
        )}

        {shareState === 'notShared' && selectedContacts.size > 0 && (
          <Button
            title={`Share ${selectedContacts.size} Contact${selectedContacts.size !== 1 ? 's' : ''}`}
            onPress={handleShareContacts}
            disabled={loading}
            style={styles.shareButton}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default ContactSharingScreen;

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  content: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Header
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSizes.h4,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.textSecondary,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
    color: theme.colors.textSecondary,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: theme.fontSizes.body1,
    color: theme.colors.text,
  },

  // Contact List
  contactList: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  contactItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
  },
  contactInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  contactName: {
    fontSize: theme.fontSizes.body1,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: theme.fontSizes.caption,
    color: theme.colors.textSecondary,
  },

  // Checkbox & Selection
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
  },
  // Loading & Error States
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    maxWidth: '80%',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: theme.colors.text,
  },
  errorText: {
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 12,
    width: '100%',
    backgroundColor: theme.colors.primary,
  },
  settingsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  
  // Shared Badge
  sharedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sharedBadgeText: {
    color: theme.colors.success,
    fontSize: theme.fontSizes.caption,
    fontWeight: '600',
  },
  shareButton: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
  },
  matchingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  matchingText: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  matchingSpinner: {
    marginTop: theme.spacing.sm,
  },
});
