import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

type Variant = 'black' | 'lime' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function Button({ label, onPress, variant = 'black', loading, disabled, style, textStyle }: ButtonProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }

  const isDisabled = disabled || loading;

  return (
    <AnimatedTouchable
      style={[styles.base, styles[variant], isDisabled && styles.disabled, animStyle, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'black' ? Colors.lime : Colors.black} />
      ) : (
        <Text style={[textStyles[variant], textStyle]}>{label}</Text>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  black: {
    backgroundColor: Colors.black,
  },
  lime: {
    backgroundColor: Colors.lime,
  },
  outline: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.black,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
  },
  disabled: {
    opacity: 0.45,
  },
});

const textStyles = StyleSheet.create({
  black: {
    color: Colors.lime,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    letterSpacing: 0.2,
  },
  lime: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    letterSpacing: 0.2,
  },
  outline: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    letterSpacing: 0.2,
  },
  ghost: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    textDecorationLine: 'underline',
  },
  danger: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    letterSpacing: 0.2,
  },
});
