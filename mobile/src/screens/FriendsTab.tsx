import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Removed LinearGradient import for a flat background
import { theme } from '../theme';
import Button from '../components/Button';
import { requestContactsPermission, getContacts, shareContacts } from '../services/contacts';
import { getCurrentUser } from '../services/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import type { FriendsScreenProps } from '../types/navigation.types';
import ContactsSharedScreen from './ContactsSharedScreen';
import LoadingScreen from '../components/LoadingScreen';
import { ContactsProvider } from '../contexts/ContactsContext';

const { width } = Dimensions.get('window');

const FriendsTab: React.FC<FriendsScreenProps> = ({ navigation }) => {
  const [hasSharedContacts, setHasSharedContacts] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const fetchUserStatus = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        console.log('[DEBUG] Current user data:', user);
        const hasShared = Boolean(user?.has_shared_contacts);
        console.log('[DEBUG] has_shared_contacts value:', user?.has_shared_contacts, 'converted to:', hasShared);
        setHasSharedContacts(hasShared);
        // Immediately navigate if contacts were shared
        if (hasShared) {
          console.log('[DEBUG] Navigating to ContactsShared');
          navigation.navigate('ContactsShared');
        }
      } catch (e) {
        console.error('[DEBUG] Error fetching user status:', e);
        setHasSharedContacts(false);
        setError('Failed to load user status');
      } finally {
        setLoading(false);
      }
    };
    fetchUserStatus();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      })
    ]).start();
  }, [loading]);

  const handleShareContactsPress = async () => {
    setLoading(true);
    setError('');
    try {
      const contacts = await getContacts();
      if (contacts.length === 0) {
        setError('');
        return;
      }
      await shareContacts(contacts);
      setHasSharedContacts(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to share contacts');
      Alert.alert('Error', 'Failed to share contacts. Please try again.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const renderIcon = (isShared: boolean) => (
    <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Icon 
        name={isShared ? "checkmark-done" : "shield"} 
        size={100} 
        color={isShared ? theme.colors.success : theme.colors.error} 
        style={styles.stateIcon} 
      />
    </Animated.View>
  );

  const renderContent = () => {
    if (loading || hasSharedContacts === null) {
      return <LoadingScreen message="Loading your friends..." />;
    }
    if (hasSharedContacts) {
      // If contacts are already shared, we don't render anything here as navigation already happened
      return null;
    }
    return (
      <View style={styles.centeredContent}>
        <View style={styles.iconContainer}>
          <Icon name="people-outline" size={56} color={theme.colors.primary} style={styles.stateIcon} />
        </View>
        <Text style={styles.title}>Share Your Contacts</Text>
        <Text style={styles.privacyBlurbTitle}>
          Friend-to-friend outreach is the most effective way to communicate with voters and turn out the vote.
        </Text>
        <Text style={styles.privacyBlurbTitle}>
          By sharing your contact list the campaign will be able to tell which of your contacts are target voters, whether they've voted or not and much more!          
        </Text>

        <View style={styles.bulletList}>
          {[
            'Click the button below to share your contacts',
            'Only names and phone numbers of your contacts are stored',
            'Your data is encrypted, secure and never sold or shared',
          ].map((text, i) => (
            <View key={i} style={styles.bulletItem}>
              <Icon name="checkmark-circle-outline" size={18} color={theme.colors.primary} style={styles.bulletIcon} />
              <Text style={styles.bulletText}>{text}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.privacyPolicyRow}
          onPress={() => navigation.navigate('PrivacyPolicy')}
          activeOpacity={0.7}
        >
          <Text style={styles.privacyPolicyLink}>View Our Privacy Policy</Text>
          <Icon name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
        {(!loading && !hasSharedContacts) && (
          <Button
            title="Share Contacts"
            variant="primary"
            onPress={handleShareContactsPress}
          />
        )}
      </View>
    );
  };

  return (
    <ContactsProvider onUpdatePress={handleShareContactsPress}>
      <SafeAreaView style={styles.safeArea}>
        {renderContent()}
      </SafeAreaView>
    </ContactsProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Ultra-clean white background
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 80, // leave space for button
    justifyContent: 'center',
  },
  // Removed card styling for minimal look
  card: {},

  iconContainer: {
    marginBottom: 32,
    backgroundColor: '#F6F7FB',
    borderRadius: 48,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIcon: {
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222B45',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  primaryButton: {
    width: '100%',
    marginBottom: 16,
  },
  privacyLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  privacyLinkText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  // Removed privacyBlurbCard for minimal look
  privacyBlurbCard: {},

  // Removed privacyBlurbHeader for minimal look
  privacyBlurbHeader: {},

  // Removed privacyIconCircle for minimal look
  privacyIconCircle: {},

  privacyBlurbTitle: {
    fontWeight: '600',
    fontSize: 14,
    color: '#475467',
    textAlign: 'center',
    marginBottom: 8,
  },
  bulletList: {
    marginBottom: 0,
    width: '100%',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 0,
  },
  bulletIcon: {
    marginTop: 0,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#7B8794',
    lineHeight: 20,
    fontWeight: '400',
  },
  privacyPolicyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  privacyPolicyLink: {
    color: '#2B50EC',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    letterSpacing: -0.1,
  },
  matchingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'transparent',
  },
  matchingText: {
    marginTop: 18,
    fontSize: 16,
    color: '#475467',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.07)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 18,
    width: '100%',
    justifyContent: 'center',
  },
  errorText: {
    color: '#D92D20',
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '500',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});

export default FriendsTab;
