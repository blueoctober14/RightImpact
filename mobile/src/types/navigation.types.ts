export type AuthStackParamList = {
  Login: undefined;
  // Add other auth screens here
};

export type FriendsStackParamList = {
  FriendsList: undefined;
  PrivacyPolicy: undefined;
  ContactsShared: undefined;
  Identification: { contact: any };
};

export type MainTabParamList = {
  Home: undefined;
  Friends: undefined;
  Neighbors: undefined;
  Settings: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  SkippedContacts: undefined;
};

// Add this type for the Friends screen props
export type FriendsScreenProps = {
  navigation: {
    navigate: (screen: keyof FriendsStackParamList) => void;
    goBack: () => void;
  };
};
