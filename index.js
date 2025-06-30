/**
 * @format
 */

// Set global.__DEV__ if not set
if (global.__DEV__ === undefined) {
  global.__DEV__ = process.env.NODE_ENV !== 'production';
}

// Add error handling
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out known warnings if needed
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Require cycle:')) {
    return;
  }
  originalConsoleError(...args);
};

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Add error boundary for the root component
const RootComponent = () => {
  return <App />;
};

AppRegistry.registerComponent(appName, () => RootComponent);
