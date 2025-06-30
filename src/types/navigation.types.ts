import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Login: undefined;
  Register: undefined;
  ContactSharing: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Friends: undefined;
  Neighbors: undefined;
  Settings: undefined;
};

export type FriendsStackParamList = {
  FriendsList: undefined;
};

// Screen Props Types
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Helper type for tab screen props
type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type HomeScreenProps = TabScreenProps<'Home'>;
export type FriendsTabProps = TabScreenProps<'Friends'>;
export type NeighborsTabProps = TabScreenProps<'Neighbors'>;
export type SettingsTabProps = TabScreenProps<'Settings'>;

export type FriendsScreenProps = NativeStackScreenProps<FriendsStackParamList, 'FriendsList'>;
