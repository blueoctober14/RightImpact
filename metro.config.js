const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    // This is needed for handling assets in React Native
    assetPlugins: ['react-native-svg-asset-plugin'],
  },
  resolver: {
    // Add file extensions to look for in this order
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'cjs', 'json'],
    // Resolve modules from the app directory and node_modules
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../node_modules'),
    ],
    // Resolve platform-specific files
    platforms: ['ios', 'android', 'native'],
    // Enable symlinks support
    resolverMainFields: ['react-native', 'browser', 'main'],
    // Extra node modules to include in the bundle
    extraNodeModules: {
      // Add any additional node modules here
    },
    // Enable the new Metro resolver (recommended for React Native 0.60+)
    resolverMainFields: ['react-native', 'browser', 'main'],
    // Enable the new Metro resolver (recommended for React Native 0.60+)
    resolverMainFields: ['react-native', 'browser', 'main'],
  },
  // Watch all files in the project directory
  watchFolders: [path.resolve(__dirname, '.')],
  // Reset the cache
  resetCache: true,
  // Maximum number of workers for bundling
  maxWorkers: 2,
  // Cache configuration
  cacheStores: [],
  // Transform configuration
  transformerPath: require.resolve('metro-react-native-babel-transformer'),
  // Source maps configuration
  getSourceMapUrl: undefined,
  // Server configuration
  server: {
    port: 8081,
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // You can add custom middleware here if needed
        return middleware(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
