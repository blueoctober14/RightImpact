declare module '@react-native-community/slider' {
  import { ComponentType } from 'react';
  import { ViewProps } from 'react-native';

  export interface SliderProps extends ViewProps {
    value?: number;
    disabled?: boolean;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    onValueChange?: (value: number) => void;
    onSlidingStart?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
  }

  const Slider: ComponentType<SliderProps>;
  export default Slider;
}
