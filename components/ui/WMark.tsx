import React from 'react';
import { Image } from 'react-native';

interface WMarkProps {
  size?: number;
  color?: string;
  style?: object;
}

export function WMark({ size = 47, style }: WMarkProps) {
  return (
    <Image
      source={require('../../assets/images/mainlogoapp.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
