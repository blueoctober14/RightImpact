import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import Button from '../components/Button';

export const PrivacyPolicyScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Privacy Policy</Text>
          
          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.paragraph}>
            When you use our app, we only collect the minimum information necessary to provide our services:
          </Text>
          <Text style={styles.listItem}>• Your name</Text>
          <Text style={styles.listItem}>• Phone numbers from your contacts</Text>
          
          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use this information solely to match your contacts with the voter file. We do not store any other information from your contacts, including notes or additional details.
          </Text>
          
          <Text style={styles.sectionTitle}>Data Security</Text>
          <Text style={styles.paragraph}>
            We take your privacy seriously. All data is encrypted in transit and at rest. We follow strict security protocols to protect your information.
          </Text>
          
          <Text style={styles.sectionTitle}>Third-Party Services</Text>
          <Text style={styles.paragraph}>
            We do not share your contact information with any third parties except as necessary to provide our services or as required by law.
          </Text>
          
          <Text style={styles.sectionTitle}>Your Consent</Text>
          <Text style={styles.paragraph}>
            By using our app, you consent to our privacy policy.
          </Text>
          
          <Button 
            title="Back to Friends" 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSizes.h4,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: theme.fontSizes.h5,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 24,
  },
  listItem: {
    fontSize: theme.fontSizes.body1,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  backButton: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
});

export default PrivacyPolicyScreen;
