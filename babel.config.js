module.exports = function(api) {
  api.cache(true);
  
  // Set __DEV__ for development mode
  if (typeof global.__DEV__ === 'undefined') {
    global.__DEV__ = process.env.NODE_ENV !== 'production';
  }

  return {
    presets: ['module:metro-react-native-babel-preset'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: [
            '.ios.js',
            '.android.js',
            '.js',
            '.jsx',
            '.json',
            '.tsx',
            '.ts'
          ],
          alias: {
            '@': './src',
            '^react-native$': 'react-native-web',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@assets': './src/assets',
            '@utils': './src/utils',
            '@services': './src/services',
            '@contexts': './src/contexts',
            '@hooks': './src/hooks',
            '@constants': './src/constants',
            '@types': './src/types',
            '@theme': './src/theme'
          }
        }
      ],
      'react-native-reanimated/plugin',
      ['@babel/plugin-proposal-decorators', { legacy: true }]
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
    },
  };
};
