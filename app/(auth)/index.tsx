import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/ui/Button';
import { Fonts } from '@/constants/fonts';
import { useTranslations } from '@/context/LanguageContext';

const { width: W, height: H } = Dimensions.get('window');

const W_PATH = "M33.4624 21.8164C36.5885 19.7012 38.3888 10.3787 38.9699 6.59557C39.129 5.56037 39.3437 3.22128 39.6251 2.36191C39.84 1.7032 40.2528 1.12674 40.8072 0.710897C41.5699 0.136594 42.5327 -0.104688 43.4762 0.0419523C44.3968 0.183348 45.2228 0.68651 45.7705 1.43967C46.1055 1.9079 46.3192 2.45194 46.3923 3.02295C46.5287 4.09214 45.9023 7.6206 45.7185 8.78841C45.439 10.0535 45.2916 11.3562 44.9759 12.6592C43.6179 18.2634 41.4487 26.9321 35.0124 28.6259C30.9668 29.6905 27.147 26.3444 25.2693 23.1137C24.6203 21.9972 24.0236 20.827 23.2145 19.7803C22.3057 20.9104 21.7387 22.2232 20.9384 23.4452C19.3523 25.8674 17.2491 28.0599 14.2975 28.6683C12.426 29.0541 10.453 28.5914 8.88887 27.5232C4.24843 24.3543 2.2283 16.5898 1.18004 11.383C0.836369 9.62206 0.537759 7.85266 0.284525 6.07649C0.197627 5.46889 0.128804 4.85579 0.046078 4.25028C-0.240841 2.14994 0.821644 0.46197 2.96886 0.0351288C3.93882 -0.073856 4.85974 0.11821 5.63853 0.727324C7.12412 1.8892 7.01113 3.49825 7.24844 5.16392C7.86645 9.5012 9.49563 19.1552 12.9475 21.8164C14.7124 20.754 15.4635 18.8293 16.5019 17.1495C17.7586 15.1164 19.4407 13.0837 21.8772 12.5184C23.1425 12.2183 24.4719 12.3512 25.6526 12.8959C29.9491 14.8641 30.4671 19.9621 33.4624 21.8164Z";

function DecorativeW({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 46.4115 28.8274" fill="none" preserveAspectRatio="none">
      <Path d={W_PATH} fill="#B9FF00" fillOpacity={0.5} />
    </Svg>
  );
}

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useTranslations();

  // Content animations
  const decoOpacity = useSharedValue(0);
  const decoScale = useSharedValue(0.88);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(1.06);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(22);
  const buttonsOpacity = useSharedValue(0);
  const buttonsY = useSharedValue(16);

  useEffect(() => {
    // Content sequence
    decoOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
    decoScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });

    logoOpacity.value = withDelay(180, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }));
    logoScale.value = withDelay(180, withSpring(1, { damping: 22, stiffness: 160, mass: 1 }));

    taglineOpacity.value = withDelay(460, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    taglineY.value = withDelay(460, withTiming(0, { duration: 500, easing: Easing.bezier(0.16, 1, 0.3, 1) }));

    buttonsOpacity.value = withDelay(820, withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
    buttonsY.value = withDelay(820, withTiming(0, { duration: 500, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, []);

  const decoStyle = useAnimatedStyle(() => ({
    opacity: decoOpacity.value,
    transform: [{ scale: decoScale.value }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsY.value }],
  }));

  const W_RATIO = 46.4115 / 28.8274;
  const topWW = W * 0.95;
  const topWH = topWW / W_RATIO;
  const smallWW = W * 0.52;
  const smallWH = smallWW / W_RATIO;

  return (
    <View style={styles.container}>
      {/* Base gradient */}
      <LinearGradient
        colors={['#DEFF6E', '#EAFF99', '#F3FFCC', '#FAFFF0']}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Ws */}
      <Animated.View style={[styles.wContainer, { top: H * 0.05, left: W * 0.22, width: topWW, height: topWH }, decoStyle]}>
        <View style={{ transform: [{ rotate: '16.44deg' }], flex: 1 }}>
          <DecorativeW width={topWW} height={topWH} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.wContainer, { top: H * 0.60, left: -W * 0.12, width: smallWW, height: smallWH }, decoStyle]}>
        <View style={{ transform: [{ rotate: '-17.44deg' }], flex: 1 }}>
          <DecorativeW width={smallWW} height={smallWH} />
        </View>
      </Animated.View>

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { top: H * 0.33 }, logoStyle]}>
        <Image
          source={require('../../assets/images/mainlogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineWrap, { top: H * 0.33 + W * 0.58 * (2 / 3) - 40 }, taglineStyle]}>
        <Text style={styles.tagline}>{t.auth.splashTagline}</Text>
      </Animated.View>

      {/* Language selector */}
      <View style={[styles.langSelector, { top: insets.top + 14 }]}>
        {(['sk', 'en'] as const).map(l => (
          <TouchableOpacity
            key={l}
            style={[styles.langChip, lang === l && styles.langChipActive]}
            onPress={() => setLang(l)}
            activeOpacity={0.8}
          >
            <Text style={[styles.langChipText, lang === l && styles.langChipTextActive]}>
              {l.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.buttons, { paddingBottom: insets.bottom + 16 }, buttonsStyle]}>
        <Button
          label={t.auth.getStarted}
          onPress={() => router.push('/(auth)/register')}
          variant="black"
          textStyle={{ color: '#FFFFFF' }}
        />
        <Button
          label={t.auth.haveAccount}
          onPress={() => router.push('/(auth)/login')}
          variant="ghost"
          textStyle={{ color: '#0A0A09', textDecorationLine: 'underline', fontSize: 18, fontWeight: '600' }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#B9FF00',
  },
  wContainer: {
    position: 'absolute',
    overflow: 'visible',
  },
  logoWrap: {
    position: 'absolute',
    left: W * 0.112,
  },
  logo: {
    width: W * 0.58,
    height: W * 0.58 * (2 / 3),
  },
  taglineWrap: {
    position: 'absolute',
    left: W * 0.112,
    right: W * 0.112,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: '#0A0A09',
    lineHeight: 26,
  },
  buttons: {
    position: 'absolute',
    bottom: 0,
    left: W * 0.08,
    right: W * 0.08,
    gap: 4,
  },
  langSelector: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 50,
    padding: 3,
    gap: 2,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
  },
  langChipActive: {
    backgroundColor: '#0A0A09',
  },
  langChipText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.medium,
    color: 'rgba(0,0,0,0.4)',
  },
  langChipTextActive: {
    color: '#B9FF00',
  },
});
