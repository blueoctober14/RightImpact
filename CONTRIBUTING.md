# Contributing to RightImpact

Thank you for your interest in contributing to RightImpact! We're excited to have you on board. This document will guide you through the process of setting up the development environment and making contributions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Development Workflow](#development-workflow)
  - [Branching Strategy](#branching-strategy)
  - [Commit Message Guidelines](#commit-message-guidelines)
  - [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. We are committed to fostering an open and welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm (v9 or later) or Yarn (v1.22 or later)
- React Native CLI
- Xcode (for iOS development, macOS only)
- Android Studio (for Android development)
- CocoaPods (for iOS, macOS only)
- Watchman (recommended for macOS/Linux)
- Git

### Installation

1. **Fork the repository**
   Click the "Fork" button in the top-right corner of the repository page on GitHub.

2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/RightImpact.git
   cd RightImpact
   ```

3. **Install dependencies**
   ```bash
   # Using npm
   npm install
   
   # Or using Yarn
   yarn
   ```

4. **Install iOS dependencies (macOS only)**
   ```bash
   cd ios
   pod install
   cd ..
   ```

5. **Set up environment variables**
   Copy the example environment file and update the values as needed:
   ```bash
   cp .env.example .env
   ```

### Running the App

#### iOS

1. Start the Metro bundler:
   ```bash
   npm start
   # or
   yarn start
   ```

2. In a new terminal, run the app on iOS:
   ```bash
   npm run ios
   # or
   yarn ios
   ```

#### Android

1. Make sure you have an Android emulator running or a device connected.

2. Start the Metro bundler (if not already running):
   ```bash
   npm start
   # or
   yarn start
   ```

3. In a new terminal, run the app on Android:
   ```bash
   npm run android
   # or
   yarn android
   ```

## Development Workflow

### Branching Strategy

We follow the [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) branching model:

- `main` - Production code (protected branch)
- `develop` - Integration branch for features (protected branch)
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Hotfixes for production
- `release/*` - Release preparation

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries

**Example:**
```
feat(authentication): add login with Google

Add support for Google OAuth authentication.

Closes #123
```

### Pull Request Process

1. Fork the repository and create your branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/amazing-feature
   ```

2. Make your changes and commit them with a descriptive message.

3. Push your changes to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```

4. Open a Pull Request to the `develop` branch.

5. Ensure all tests pass and your code is properly documented.

6. Request a code review from at least one maintainer.

7. Once approved, your PR will be merged into the `develop` branch.

## Code Style

We use:
- ESLint for JavaScript/TypeScript linting
- Prettier for code formatting
- TypeScript for type checking

Before committing, run:
```bash
# Check for linting errors
npm run lint

# Format code
npm run format

# Check TypeScript types
npm run type-check
```

## Testing

We use Jest and React Testing Library for testing. To run tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Documentation

- Update the README.md with details of changes to the interface.
- Add comments to your code where necessary.
- Update the CHANGELOG.md with notable changes.

## Deployment

Deployment is handled automatically through CI/CD pipelines. The `main` branch is automatically deployed to production.

## Troubleshooting

### Common Issues

#### iOS Build Fails
- Make sure you've run `pod install` in the `ios` directory
- Clean the build folder in Xcode (Product > Clean Build Folder)
- Delete the `ios/build` directory and try again

#### Android Build Fails
- Make sure you have the correct Android SDK installed
- Clean the project: `cd android && ./gradlew clean`
- Invalidate caches and restart Android Studio

#### Metro Bundler Issues
- Stop the Metro bundler and remove the cache:
  ```bash
  npm start -- --reset-cache
  ```
- Or delete the Metro cache manually:
  ```bash
  rm -rf $TMPDIR/metro-* && rm -rf $TMPDIR/haste-map-*
  ```

## FAQ

### How do I update dependencies?

```bash
# Update all dependencies
npx npm-check-updates -u
npm install

# Or update a specific package
npm install package-name@latest
```

### How do I add a new dependency?

```bash
# For production dependencies
npm install package-name --save

# For development dependencies
npm install package-name --save-dev
```

### How do I debug the app?

#### iOS
- Open the project in Xcode and use the debugger
- Use the React Native Debugger: https://github.com/jhen0409/react-native-debugger

#### Android
- Use Android Studio's debugger
- Use Chrome Developer Tools: https://reactnative.dev/docs/debugging#chrome-developer-tools

### How do I contribute translations?

1. Add or update strings in the appropriate language files in `src/translations/`
2. Update the translation keys in `src/translations/index.ts`
3. Submit a pull request with your changes

## Need Help?

If you have any questions or need help, please open an issue on GitHub or reach out to the maintainers.

Thank you for contributing to RightImpact! 🚀
