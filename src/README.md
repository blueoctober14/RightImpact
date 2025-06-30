# Source Code Structure

This directory contains all the source code for the RightImpact React Native application.

## Directory Structure

- `src/`
  - `components/` - Reusable UI components
  - `screens/` - Screen components (one per screen)
  - `navigation/` - Navigation configuration and stack navigators
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions and helpers
  - `assets/` - Static assets (images, fonts, etc.)
  - `constants/` - Application constants and configuration
  - `services/` - API services and external integrations
  - `store/` - State management (Redux, Context API, etc.)
  - `types/` - TypeScript type definitions
  - `theme/` - Styling and theming configuration
  - `__tests__/` - Test files

## Naming Conventions

- Components: `PascalCase` (e.g., `Button.tsx`)
- Hooks: `useCamelCase` (e.g., `useAuth.ts`)
- Utilities: `camelCase` (e.g., `formatDate.ts`)
- Types: `PascalCase` with `.types.ts` suffix (e.g., `user.types.ts`)
- Test files: `ComponentName.test.tsx` or `hookName.test.ts`

## Best Practices

1. Keep components small and focused on a single responsibility
2. Use TypeScript for type safety
3. Write tests for all new features
4. Follow the "container/component" pattern for separating logic and presentation
5. Use absolute imports with the `@/` prefix
6. Document all components and functions with JSDoc comments

## Getting Started

1. Create a new component in the appropriate directory
2. Add TypeScript types for all props and state
3. Write tests for your component
4. Document your component with a JSDoc comment
5. Import and use your component in a screen

## Example Component

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ExampleProps {
  title: string;
  description?: string;
}

/**
 * Example component that demonstrates the component structure
 * 
 * @param {string} title - The title to display
 * @param {string} [description] - Optional description
 */
const Example: React.FC<ExampleProps> = ({ title, description }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});

export default Example;
```

## Testing

We use Jest and React Testing Library for testing. Each component should have a corresponding test file.

Example test:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import Example from './Example';

describe('Example', () => {
  it('renders the title', () => {
    const { getByText } = render(<Example title="Test Title" />);
    expect(getByText('Test Title')).toBeTruthy();
  });

  it('renders the description when provided', () => {
    const { getByText } = render(
      <Example title="Test Title" description="Test Description" />
    );
    expect(getByText('Test Description')).toBeTruthy();
  });
});
```
