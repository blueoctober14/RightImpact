import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList,
  Alert,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import Button from '../components/Button';
import { requestContactsPermission, getContacts, shareContacts } from '../services/contacts';

interface Friend {
  id: string;
  name: string;
  shared: number;
}

import type { FriendsScreenProps } from '../types/navigation.types';

const FriendsTab: React.FC<FriendsScreenProps> = ({ navigation }) => {
  const [contactsShared, setContactsShared] = useState<boolean>(false);
  const [matchingProgress, setMatchingProgress] = useState<'notStarted' | 'inProgress' | 'complete'>('notStarted');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Example friend data - in a real app, this would come from your API
  const [friends, setFriends] = useState<Friend[]>([
    { id: '1', name: 'John Doe', shared: 5 },
    { id: '2', name: 'Jane Smith', shared: 3 },
    { id: '3', name: 'Mike Johnson', shared: 7 },
  ]);

  const handleShareContactsPress = async () => {
    console.log('=== Starting handleShareContactsPress ===');
    setLoading(true);
    setError('');
    
    try {
      // Step 1: Request permission to access contacts
      console.log('1. Requesting contacts permission...');
      const hasPermission = await requestContactsPermission();
      console.log('2. Permission result:', hasPermission);
      
      if (!hasPermission) {
        console.log('3. Permission denied');
        setError('Permission to access contacts was denied');
        
        // If we're on iOS, we might need to guide the user to settings
        if (Platform.OS === 'ios') {
          console.log('4. Showing iOS permission alert...');
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
        setLoading(false);
        return;
      }
      
      // Step 2: Get contacts if permission granted
      console.log('3. Permission granted, getting contacts...');
      const contacts = await getContacts();
      console.log(`4. Retrieved ${contacts.length} contacts`);
      
      if (contacts.length === 0) {
        setError('No contacts found on your device');
        setLoading(false);
        return;
      }
      
      // Step 3: Share contacts with the campaign
      console.log('5. Sharing contacts with campaign...');
      await shareContacts(contacts);
      console.log('6. Contacts shared successfully');
      
      // Update UI state
      setContactsShared(true);
      setMatchingProgress('inProgress');
      
      // Simulate matching process completion after a delay
      setTimeout(() => {
        setMatchingProgress('complete');
        console.log('7. Matching process completed');
      }, 3000);
      
    } catch (err: any) {
      console.error('Error in handleShareContactsPress:', err);
      setError(err?.message || 'Failed to share contacts');
      
      Alert.alert(
        'Error',
        'Failed to share contacts. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      console.log('=== End of handleShareContactsPress ===');
    }
  };

  // Show loading state while requesting permissions or processing contacts
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.matchingContainer}>
          <Text style={styles.matchingText}>
            Requesting permission...
          </Text>
          <Text style={styles.matchingSubtext}>
            Please check for a permission dialog
          </Text>
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loadingIndicator} />
        </View>
      </SafeAreaView>
    );
  }
  
  // Show matching progress if contacts are being processed
  if (matchingProgress === 'inProgress') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.matchingContainer}>
          <Text style={styles.matchingText}>
            Matching contacts with campaign targets...
          </Text>
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loadingIndicator} />
        </View>
      </SafeAreaView>
    );
  }

  // Always show the share contacts button at the top
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Share Contacts Button - Using TouchableOpacity for visibility */}
      <TouchableOpacity 
        onPress={handleShareContactsPress}
        style={{
          margin: 16,
          backgroundColor: '#4F46E5', // Primary color from theme
          padding: 16,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '600' }}>
          {contactsShared ? "Update Shared Contacts" : "Share Contacts"}
        </Text>
      </TouchableOpacity>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            onPress={handleShareContactsPress}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>
            {contactsShared 
              ? 'Your contacts have been shared. You can update your shared contacts above.'
              : 'Share your contacts to help the campaign reach more people'}
          </Text>
        </View>

        {contactsShared && (
          <View style={styles.friendsList}>
            <Text style={styles.sectionTitle}>Your Friends</Text>
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.friendItem}>
                  <Text style={styles.friendName}>{item.name}</Text>
                  <Text style={styles.sharedCount}>{item.shared} shared contacts</Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No friends found. Share your contacts to find friends.</Text>
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
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
  buttonContainer: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  shareButton: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
  },
  friendsList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.h5,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  friendItem: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  friendName: {
    fontSize: theme.fontSizes.body1,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  sharedCount: {
    fontSize: theme.fontSizes.body2,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  matchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  matchingText: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  matchingSubtext: {
    fontSize: theme.fontSizes.body2,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  loadingIndicator: {
    marginTop: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
  },
  errorContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    marginTop: theme.spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default FriendsTab;
