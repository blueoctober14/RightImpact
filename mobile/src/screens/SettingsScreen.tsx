import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';
import { useNavigation } from '@react-navigation/native';
import type { SettingsStackParamList } from '../types/navigation.types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SettingsScreenNavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>;

const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<SettingsScreenNavigationProp>();

  const handleLogout = () => {
    // Show confirmation dialog before logging out
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          
          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')}
                </Text>
              </View>
            </View>
            <Text style={styles.userName}>{`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}</Text>
          </View>

          {/* Settings Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.option}>
              <Text style={styles.optionText}>Notification Preferences</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option}>
              <Text style={styles.optionText}>Privacy Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={handleLogout}>
              <Text style={[styles.optionText, styles.logoutText]}>Log Out</Text>
              <Ionicons name="log-out-outline" style={[styles.optionIcon, styles.logoutText]} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.optionContainer}>
              <TouchableOpacity style={styles.option}>
                <Text style={styles.optionText}>Help Center</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.option}>
                <Text style={styles.optionText}>Contact Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.option}>
                <Text style={styles.optionText}>Terms & Conditions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.option}>
                <Text style={styles.optionText}>Privacy Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.option}
                onPress={() => navigation.navigate('SkippedContacts')}
              >
                <Text style={styles.optionText}>Skipped Contacts</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>App Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: theme.fontSizes.h4,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatarContainer: {
    marginBottom: theme.spacing.md,
  },
  avatarPlaceholder: {
    width: 75,
    height: 75,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '600',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  userName: {
    fontSize: theme.fontSizes.h5,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xxs,
  },
  userPhone: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fontSizes.body2,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionContainer: {
    marginBottom: theme.spacing.xl,
  },
  optionText: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.text,
  },
  optionIcon: {
    fontSize: 22,
    color: theme.colors.textSecondary,
  },
  logoutText: {
    color: theme.colors.error,
  },
  versionContainer: {
    paddingTop: theme.spacing.xl,
  },
  versionText: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSizes.caption,
  },
});

export default SettingsScreen;
