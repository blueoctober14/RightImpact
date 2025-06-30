// This file contains type definitions for custom fonts

type FontWeight =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | '100italic'
  | '200italic'
  | '300italic'
  | '400italic'
  | '500italic'
  | '600italic'
  | '700italic'
  | '800italic'
  | '900italic'
  | 'normal'
  | 'italic';

declare module 'react-native-vector-icons/FontAwesome' {
  import { ComponentType } from 'react';
  import { TextProps } from 'react-native';
  
  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    style?: any;
  }
  
  const Icon: ComponentType<IconProps>;
  export default Icon;
}

declare module '*.ttf' {
  const value: number;
  export default value;
}

declare module '*.otf' {
  const value: number;
  export default value;
}

declare module '*.woff' {
  const value: number;
  export default value;
}

declare module '*.woff2' {
  const value: number;
  export default value;
}
