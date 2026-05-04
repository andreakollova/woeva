import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  style?: object;
}

export function BackButton({ onPress, color = Colors.black, style }: BackButtonProps) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={onPress ?? (() => router.back())} style={[styles.btn, style]} hitSlop={8}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
