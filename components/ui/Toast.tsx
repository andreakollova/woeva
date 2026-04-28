import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onHide?: () => void;
}

export function Toast({ visible, title, subtitle, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
      const timeout = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        translateY.value = withTiming(-120, { duration: 300 });
        setTimeout(() => onHide?.(), 350);
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, { top: insets.top + 12 }, animStyle]}>
      <View style={styles.toast}>
        <View style={styles.icon}>
          <Text style={styles.check}>✓</Text>
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  toast: {
    backgroundColor: Colors.black,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.lime,
    marginTop: 2,
  },
});
