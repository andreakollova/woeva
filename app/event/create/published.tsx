import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { WMark } from '@/components/ui/WMark';

export default function PublishedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 150 }));
    opacity.value = withDelay(100, withTiming(1, { duration: 400 }));
    setTimeout(() => router.replace('/(tabs)'), 3000);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.wDecorTop}><WMark size={200} color={Colors.limeDark} /></View>

      <Animated.View style={[styles.content, animStyle]}>
        <View style={styles.checkCircle}>
          <Text style={styles.check}>✓</Text>
        </View>
        <Text style={styles.title}>You're out there.</Text>
        <Text style={styles.subtitle}>Event published. Your people will find it.</Text>
      </Animated.View>

      <View style={styles.wDecorBottom}><WMark size={140} color={Colors.limeDark} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  wDecorTop: {
    position: 'absolute',
    top: 80,
  },
  wDecorBottom: {
    position: 'absolute',
    bottom: 60,
    opacity: 0.6,
  },
  content: { alignItems: 'center', gap: 16 },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 30, color: Colors.white, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.black, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.black, opacity: 0.65, textAlign: 'center', lineHeight: 22 },
});
