import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();

  const campaignOptions = [
    {
      title: 'Friends',
      icon: 'people',
      description: 'Communicate campaign messaging with your peers. Remind friends to vote and provide valuable information about their political leanings to help us allocate resources effectively.',
      action: () => navigation.navigate('Friends')
    },
    {
      title: 'Neighbors',
      icon: 'home',
      description: 'Reach voters in your neighborhood who you may not know personally but share your community values.',
      action: () => navigation.navigate('Neighbors')
    },
    {
      title: 'Social Media',
      icon: 'share-social',
      description: 'Amplify our message by sharing campaign content on your social networks.',
      action: () => navigation.navigate('Social')
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome, {user?.first_name || 'Friend'}</Text>
          <Icon 
            name="star" 
            size={32} 
            color={theme.colors.primary} 
            style={styles.flagIcon}
          />
        </View>

        {/* Campaign Intro */}
        <View style={styles.introContainer}>
          <Text style={styles.introTitle}>Three Ways to Help Keep Texas RED</Text>
          <Text style={styles.introText}>
            Your participation makes a real difference.
          </Text>
        </View>

        {/* Campaign Options */}
        {campaignOptions.map((option, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.optionCard}
            onPress={option.action}
            activeOpacity={0.8}
          >
            <View style={styles.optionIconContainer}>
              <Icon 
                name={option.icon} 
                size={28} 
                color={theme.colors.primary} 
              />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <Icon name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for helping Keep Texas RED!</Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    flex: 1,
  },
  flagIcon: {
    marginLeft: 16,
    padding: 4,
  },
  introContainer: {
    marginBottom: 32,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  introText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  optionIconContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: 16,
  },

});

export default HomeScreen;
