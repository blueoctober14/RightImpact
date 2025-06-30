import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import Button from '../components/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

type SkippedContactsScreenProps = {
  navigation: any;
};

type SkippedContact = {
  id: number;
  shared_contact_id: number;
  first_name: string;
  last_name: string;
  mobile_numbers: string[];
  created_at: string;
};

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '';
  const match = phone.match(/^(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
};

const SkippedContactsScreen: React.FC<SkippedContactsScreenProps> = ({ navigation }) => {
  const [skippedContacts, setSkippedContacts] = useState<SkippedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSkippedContacts = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/api/contacts/skipped', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response && response.data && response.data.contacts) {
        setSkippedContacts(response.data.contacts);
      } else {
        setSkippedContacts([]);
      }
    } catch (error) {
      console.error('Failed to load skipped contacts:', error);
      Alert.alert('Error', 'Failed to load skipped contacts');
      setSkippedContacts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnskipContact = async (contactId: number) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.delete(`/api/contacts/skip/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response && response.data && response.data.status === 'success') {
        // Remove from local state
        setSkippedContacts(prev => prev.filter(contact => contact.shared_contact_id !== contactId));
        Alert.alert('Success', 'Contact has been unskipped successfully');
        
        // Simply go back - ContactsSharedScreen will refresh when focused
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Failed to unskip contact. Please try again.');
      }
    } catch (error) {
      console.error('Error unskipping contact:', error);
      Alert.alert('Error', 'An error occurred while unskipping the contact');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSkippedContacts();
  };

  useEffect(() => {
    fetchSkippedContacts();
    
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchSkippedContacts();
    });
    
    return unsubscribe;
  }, [navigation]);

  const renderContactItem = ({ item }: { item: SkippedContact }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactRow}>
        <View style={styles.contactAvatar}>
          <Icon name="person" size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={styles.contactDetail}>
            {item.mobile_numbers && item.mobile_numbers.length > 0 
              ? formatPhoneNumber(item.mobile_numbers[0]) 
              : 'No phone number'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.unskipButton}
          onPress={() => {
            Alert.alert(
              'Unskip Contact',
              'Are you sure you want to unskip this contact?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Unskip', 
                  onPress: () => handleUnskipContact(item.shared_contact_id) 
                }
              ]
            );
          }}
        >
          <Icon name="refresh-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Skipped Contacts</Text>
        <Text style={styles.description}>
          Contacts you've chosen to exclude from your identification list
        </Text>
        
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : skippedContacts.length === 0 ? (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>No skipped contacts yet</Text>
          </View>
        ) : (
          <FlatList
            data={skippedContacts}
            keyExtractor={(item) => `skipped-${item.shared_contact_id}`}
            renderItem={renderContactItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
              />
            }
          />
        )}
        
        <Button 
          title="Back to Contacts" 
          onPress={() => navigation.navigate('ContactsShared')}
          variant="secondary"
        />
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.text,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    color: theme.colors.textSecondary,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  placeholderText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flexGrow: 1,
  },
  contactCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  contactDetail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  unskipButton: {
    padding: 8,
    justifyContent: 'center',
  },
});

export default SkippedContactsScreen;
