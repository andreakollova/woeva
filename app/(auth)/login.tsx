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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    if (!email) { setErrors(e => ({ ...e, email: 'Email is required' })); return; }
    if (!password) { setErrors(e => ({ ...e, password: 'Password is required' })); return; }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErrors({ password: '*Incorrect password' });
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Your city is waiting for you.</Text>
        </View>

        {/* Social buttons first */}
        <View style={styles.social}>
          <SocialButton provider="google" onPress={() => handleSocialLogin('google')} loading={socialLoading === 'google'} />
          <SocialButton provider="apple" onPress={() => handleSocialLogin('apple')} loading={socialLoading === 'apple'} />
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email + password */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Andrea@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••••"
            secureTextEntry
            error={errors.password}
            rightLabel="Forgot Password?"
            onRightLabelPress={() => router.push('/(auth)/forgot-password')}
          />
        </View>

        <Button label="Sign in" onPress={handleLogin} loading={loading} variant="black" />
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
