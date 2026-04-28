import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

interface TagProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
  floatDelay?: number;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function Tag({ label, selected, onPress, small, floatDelay = 0 }: TagProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (floatDelay === -1) return; // static — no animation
    const s = floatDelay;
    const ay = 2 + (s % 9) * 0.3;
    const ax = 1 + (s % 7) * 0.25;
    const dy1 = 2600 + (s % 6) * 500;
    const dy2 = 3200 + (s % 5) * 400;
    const dx1 = 3400 + (s % 7) * 450;
    const dx2 = 2900 + (s % 4) * 600;

    translateY.value = withDelay(s,
      withRepeat(withSequence(
        withTiming(-ay, { duration: dy1 }),
        withTiming(ay * 0.5, { duration: dy2 }),
        withTiming(-ay * 0.8, { duration: dy1 + 300 }),
        withTiming(ay, { duration: dy2 - 200 }),
      ), -1, true)
    );

    translateX.value = withDelay(s + 400,
      withRepeat(withSequence(
        withTiming(ax, { duration: dx1 }),
        withTiming(-ax * 0.7, { duration: dx2 }),
        withTiming(ax * 0.4, { duration: dx1 - 300 }),
        withTiming(-ax, { duration: dx2 + 200 }),
      ), -1, true)
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
  }));

  return (
    <AnimatedTouchable
      style={[styles.tag, small && styles.small, selected && styles.selected, animStyle]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, small && styles.smallText, selected && styles.selectedText]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: Colors.grayLight,
  },
  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selected: {
    backgroundColor: Colors.black,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.black,
  },
  smallText: {
    fontSize: 13,
  },
  selectedText: {
    color: Colors.white,
  },
});
