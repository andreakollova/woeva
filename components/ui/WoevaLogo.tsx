import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface WoevaLogoProps {
  size?: number;
  color?: string;
}

export function WoevaLogo({ size = 32, color = Colors.black }: WoevaLogoProps) {
  return (
    <Text style={[styles.logo, { fontSize: size, color }]}>woeva</Text>
  );
}

const styles = StyleSheet.create({
  logo: {
    fontWeight: '700',
    letterSpacing: -1,
  },
});
