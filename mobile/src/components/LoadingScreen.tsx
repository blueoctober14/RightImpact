import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions, Image } from 'react-native';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>

      <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },

  spinner: {
    marginBottom: 24,
  },
  text: {
    fontSize: 22,
    color: theme.colors.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default LoadingScreen;
