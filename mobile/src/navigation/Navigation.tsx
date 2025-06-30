import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import FriendsTab from '../screens/FriendsTab';
import NeighborsTab from '../screens/NeighborsTab';
import SettingsScreen from '../screens/SettingsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import ContactsSharedScreen from '../screens/ContactsSharedScreen';
import IdentificationScreen from '../screens/IdentificationScreen';
import SkippedContactsScreen from '../screens/SkippedContactsScreen';

// Types
import type { 
  AuthStackParamList, 
  MainTabParamList,
  FriendsStackParamList,
  SettingsStackParamList
} from '../types/navigation.types';

// Create navigators with type parameters
const AuthStackNavigator = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const FriendsStack = createNativeStackNavigator<FriendsStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

// Common screen options
const screenOptions: NativeStackNavigationOptions = {
  headerStyle: {
    backgroundColor: '#fff',
    // @ts-ignore - elevation is valid but not in the type definition
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: '#2563eb',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
  headerBackTitleVisible: false,
};

// Loading component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#2563eb" />
  </View>
);

// Auth Stack (Login/Register)
const AuthStack = () => (
  <AuthStackNavigator.Navigator screenOptions={screenOptions}>
    <AuthStackNavigator.Screen 
      name="Login" 
      component={LoginScreen} 
      options={{ title: 'Sign In' }} 
    />
  </AuthStackNavigator.Navigator>
);

// Friends Stack Navigator
const FriendsStackScreen = () => (
  <FriendsStack.Navigator screenOptions={screenOptions}>
    <FriendsStack.Screen 
      name="FriendsList" 
      component={FriendsTab} 
      options={{ title: 'Friends' }} 
    />
    <FriendsStack.Screen
      name="PrivacyPolicy"
      component={PrivacyPolicyScreen}
      options={{ title: 'Privacy Policy' }}
    />
    <FriendsStack.Screen
      name="ContactsShared"
      component={ContactsSharedScreen}
      options={{ title: 'Contacts Shared' }}
    />
    <FriendsStack.Screen
      name="Identification"
      component={IdentificationScreen}
      options={{ title: 'Identification' }}
    />
  </FriendsStack.Navigator>
);

// Settings Stack Navigator
const SettingsStackScreen = () => (
  <SettingsStack.Navigator screenOptions={screenOptions}>
    <SettingsStack.Screen 
      name="SettingsMain" 
      component={SettingsScreen} 
      options={{ title: 'Settings' }} 
    />
    <SettingsStack.Screen
      name="SkippedContacts"
      component={SkippedContactsScreen}
      options={{ title: 'Skipped Contacts' }}
    />
  </SettingsStack.Navigator>
);

// Main App Tabs
const AppTabs = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          paddingVertical: 8,
          height: Platform.OS === 'ios' ? 80 : 60, 
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          paddingBottom: Platform.OS === 'ios' ? 30 : 8, 
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: Platform.OS === 'ios' ? 0 : 4, 
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="home-outline" size={size} color={color} />
          ),
          title: 'Home',
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="people-outline" size={size} color={color} />
          ),
          title: 'Friends',
        }}
      />
      <Tab.Screen
        name="Neighbors"
        component={NeighborsTab}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="people-circle-outline" size={size} color={color} />
          ),
          title: 'Neighbors',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings-outline" size={size} color={color} />
          ),
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

// Main Navigation
const Navigation: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return user ? <AppTabs /> : <AuthStack />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default Navigation;
