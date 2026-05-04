import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SocialButton } from '@/components/ui/SocialButton';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle, signInWithApple } from '@/lib/socialAuth';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  async function handleSocialLogin(provider: 'google' | 'apple') {
    setSocialLoading(provider);
    const fn = provider === 'google' ? signInWithGoogle : signInWithApple;
    const { error } = await fn();
    setSocialLoading(null);
    if (!error) router.replace('/(tabs)');
  }

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.includes('@')) e.email = 'Add valid email address';
    if (password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        setErrors({ email: 'Tento email je už zaregistrovaný.' });
        Alert.alert('Účet existuje', 'Tento email je už zaregistrovaný. Chceš sa prihlásiť?', [
          { text: 'Zrušiť', style: 'cancel' },
          { text: 'Prihlásiť sa', onPress: () => router.replace('/(auth)/login') },
        ]);
      } else {
        setErrors({ email: error.message });
      }
      return;
    }

    if (!data.session) {
      // Email confirmation required — user must confirm before they can log in
      Alert.alert(
        'Skontroluj email',
        `Poslali sme ti potvrdzovací odkaz na ${email}. Po potvrdení sa môžeš prihlásiť.\n\nAk chceš preskočiť overovanie (pre vývoj), vypni "Confirm email" v Supabase → Authentication → Providers → Email.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)') }],
      );
      return;
    }

    // Session created — save profile with name immediately
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, name: name.trim() });
    }

    router.push('/(auth)/interests');
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
          <Text style={styles.title}>Create account</Text>
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

        {/* Fields */}
        <View style={styles.form}>
          <Input
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Daniela Vranovská"
            error={errors.name}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="danka@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Create password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter min 8 characters"
            secureTextEntry
            error={errors.password}
          />
        </View>

        <Button label="Register" onPress={handleRegister} loading={loading} variant="black" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 32 },
  backText: { fontSize: 22, color: Colors.black, fontWeight: '400', fontFamily: Fonts.regular },
  header: { marginBottom: 28 },
  title: { fontSize: 30, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, letterSpacing: -0.5 },
  social: { gap: 12, marginBottom: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.grayBorder },
  dividerText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  form: { gap: 20, marginBottom: 32 },
});
