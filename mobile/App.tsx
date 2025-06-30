/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { LogBox, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import Navigation from './src/navigation/Navigation';

// Suppress Expo-specific warnings in bare React Native
LogBox.ignoreLogs([
  /EXNativeModulesProxy/,  // ignore native module warning
  /process\.env\.EXPO_OS/, // ignore missing env warning
]);

// Provide stub values so libraries don\'t complain
if (!('process' in global)) {
  // @ts-ignore
  global.process = {};
}
// @ts-ignore
if (!global.process.env) {
  // @ts-ignore
  global.process.env = {};
}
// @ts-ignore
if (!global.process.env.EXPO_OS) {
  // @ts-ignore
  global.process.env.EXPO_OS = Platform.OS;
}


const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Navigation />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
