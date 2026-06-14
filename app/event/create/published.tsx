import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { useTranslations } from '@/context/LanguageContext';

export default function PublishedScreen() {
  const router = useRouter();
  const { t } = useTranslations();

  const ease = Easing.out(Easing.cubic);

  const logoOp = useSharedValue(0);
  const logoY = useSharedValue(12);
  const titleOp = useSharedValue(0);
  const titleY = useSharedValue(16);
  const subOp = useSharedValue(0);
  const subY = useSharedValue(12);

  useEffect(() => {
    logoOp.value = withDelay(100, withTiming(1, { duration: 600, easing: ease }));
    logoY.value = withDelay(100, withTiming(0, { duration: 600, easing: ease }));

    titleOp.value = withDelay(380, withTiming(1, { duration: 540, easing: ease }));
    titleY.value = withDelay(380, withTiming(0, { duration: 540, easing: ease }));

    subOp.value = withDelay(560, withTiming(1, { duration: 500, easing: ease }));
    subY.value = withDelay(560, withTiming(0, { duration: 500, easing: ease }));

    setTimeout(() => router.replace('/(tabs)'), 2800);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOp.value,
    transform: [{ translateY: logoY.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOp.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({
    opacity: subOp.value,
    transform: [{ translateY: subY.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[logoStyle, { marginBottom: -10 }]}>
          <WMark size={80} color={Colors.black} />
        </Animated.View>
        <Animated.Text style={[styles.title, titleStyle]}>
          {t.event.youreOutThere}
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, subStyle]}>
          {t.event.eventPublishedSub}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'flex-start',
    paddingHorizontal: 36,
    gap: 14,
    width: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.black,
    letterSpacing: -1,
    fontFamily: Fonts.bold,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.55)',
    fontFamily: Fonts.regular,
    lineHeight: 24,
  },
});
