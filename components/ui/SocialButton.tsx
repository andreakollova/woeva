import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Path, G, ClipPath, Rect, Defs } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface SocialButtonProps {
  provider: 'google' | 'apple';
  onPress: () => void;
  loading?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Defs>
        <ClipPath id="clip">
          <Rect width={20} height={20} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip)">
        <Path
          d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z"
          fill="#4285F4"
        />
        <Path
          d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.759-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z"
          fill="#34A853"
        />
        <Path
          d="M4.405 11.9A6.01 6.01 0 014.09 10c0-.661.114-1.305.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49L4.405 11.9z"
          fill="#FBBC05"
        />
        <Path
          d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0A9.996 9.996 0 001.064 5.51l3.34 2.59C5.192 5.736 7.396 3.977 10 3.977z"
          fill="#EA4335"
        />
      </G>
    </Svg>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={22} viewBox="0 0 18 22" fill="none">
      <Path
        d="M14.9225 11.6512C14.9326 10.7767 15.1671 9.91934 15.6038 9.16078C16.0405 8.40221 16.6648 7.76766 17.4178 7.31641C16.9408 6.63925 16.3098 6.08208 15.5765 5.6907C14.8432 5.29933 14.028 5.08459 13.197 5.06445C11.4238 4.87977 9.70522 6.11191 8.80194 6.11191C7.88144 6.11191 6.48529 5.08271 4.98851 5.11318C4.02009 5.14406 3.07617 5.42352 2.24943 5.92468C1.42269 6.42584 0.741898 7.13163 0.272461 7.97461C-1.74207 11.4321 -0.0314534 16.5339 1.89501 19.3318C2.86036 20.7014 3.99155 22.232 5.48706 22.1762C6.94921 22.1149 7.49437 21.2487 9.25875 21.2487C11.0073 21.2487 11.5178 22.1762 13.0434 22.1413C14.6136 22.1149 15.5902 20.7674 16.5212 19.384C17.2196 18.3938 17.7554 17.2994 18.1082 16.1414C17.1963 15.7534 16.4192 15.1003 15.8727 14.2652C15.3261 13.4301 15.0341 12.4514 14.9225 11.6512Z"
        fill="white"
      />
      <Path
        d="M12.0083 3.37539C12.8529 2.35693 13.2696 1.04477 13.1699 -0.000976562C11.8979 0.133513 10.7228 0.750725 9.87347 1.72617C9.45831 2.20337 9.14176 2.75919 8.94209 3.36049C8.74243 3.96179 8.66366 4.59647 8.7103 5.22836C9.35484 5.2349 9.99315 5.09158 10.5746 4.80927C11.156 4.52696 11.6645 4.11338 12.0618 3.60156L12.0083 3.37539Z"
        fill="white"
      />
    </Svg>
  );
}

export function SocialButton({ provider, onPress, loading }: SocialButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isApple = provider === 'apple';

  return (
    <AnimatedTouchable
      style={[styles.btn, isApple ? styles.apple : styles.google, animStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      activeOpacity={1}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={isApple ? Colors.white : Colors.black} size="small" />
      ) : (
        <>
          {isApple ? <AppleIcon /> : <GoogleIcon />}
          <Text style={[styles.label, isApple ? styles.labelApple : styles.labelGoogle]}>
            Continue with {isApple ? 'Apple' : 'Google'}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  apple: {
    backgroundColor: Colors.black,
  },
  google: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelApple: {
    color: Colors.white,
  },
  labelGoogle: {
    color: Colors.black,
  },
});
