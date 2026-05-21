import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SocialButton } from '@/components/ui/SocialButton';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle, signInWithApple } from '@/lib/socialAuth';
import { useTranslations } from '@/context/LanguageContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function handleSocialLogin(provider: 'google' | 'apple') {
    setSocialLoading(provider);
    const fn = provider === 'google' ? signInWithGoogle : signInWithApple;
    const { error } = await fn();
    setSocialLoading(null);
    if (!error) router.replace('/(tabs)');
  }

  async function handleLogin() {
    setErrors({});
    if (!email) { setErrors(e => ({ ...e, email: t.auth.validEmail })); return; }
    if (!password) { setErrors(e => ({ ...e, password: t.auth.minPassword })); return; }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      const msg = error.message ?? '';
      if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('confirm')) {
        setErrors({ email: t.auth.checkEmail });
      } else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setErrors({ password: t.auth.socialAccountHint });
      } else if (msg.toLowerCase().includes('invalid')) {
        setErrors({ password: t.auth.validEmail });
      } else {
        setErrors({ password: msg });
      }
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton />

        <View style={styles.header}>
          <Text style={styles.title}>{t.auth.welcomeBack}</Text>
          <Text style={styles.subtitle}>{t.auth.cityWaiting}</Text>
        </View>

        {/* Social buttons first */}
        <View style={styles.social}>
          <SocialButton provider="google" onPress={() => handleSocialLogin('google')} loading={socialLoading === 'google'} />
          <SocialButton provider="apple" onPress={() => handleSocialLogin('apple')} loading={socialLoading === 'apple'} />
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t.auth.or}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email + password */}
        <View style={styles.form}>
          <Input
            label={t.auth.email}
            value={email}
            onChangeText={setEmail}
            placeholder={t.auth.emailPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label={t.auth.password}
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.passwordDots}
            secureTextEntry
            error={errors.password}
            rightLabel={t.auth.forgotPassword}
            onRightLabelPress={() => router.push('/(auth)/forgot-password')}
          />
        </View>

        <Button label={t.auth.signIn} onPress={handleLogin} loading={loading} variant="black" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    paddingHorizontal: 24,
    gap: 0,
  },
  backBtn: {
    marginBottom: 32,
  },
  backText: {
    fontSize: 22,
    color: Colors.black,
    fontWeight: '400',
    fontFamily: Fonts.regular,
  },
  header: {
    marginTop: 32,
    marginBottom: 28,
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: Colors.black,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.gray,
    fontFamily: Fonts.regular,
  },
  social: {
    gap: 12,
    marginBottom: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.grayBorder,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.gray,
    fontFamily: Fonts.regular,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
});
