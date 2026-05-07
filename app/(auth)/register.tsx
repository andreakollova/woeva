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
import { notify } from '@/lib/notify';
import { useTranslations } from '@/context/LanguageContext';
import type { Lang } from '@/lib/i18n';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useTranslations();
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
    if (!name.trim()) e.name = t.auth.nameRequired;
    if (!email.includes('@')) e.email = t.auth.validEmail;
    if (password.length < 8) e.password = t.auth.minPassword;
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
        setErrors({ email: t.auth.emailAlreadyRegistered });
        Alert.alert(t.auth.accountExists, t.auth.accountExistsMsg, [
          { text: t.auth.cancel, style: 'cancel' },
          { text: t.auth.signInAction, onPress: () => router.replace('/(auth)/login') },
        ]);
      } else {
        setErrors({ email: error.message });
      }
      return;
    }

    if (!data.session) {
      // Email confirmation required — user must confirm before they can log in
      Alert.alert(
        t.auth.checkEmail,
        t.auth.checkEmailMsg(email),
        [{ text: t.auth.ok, onPress: () => router.replace('/(auth)') }],
      );
      return;
    }

    // Session created — save profile with name immediately
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, name: name.trim(), email: email.trim().toLowerCase() });
      notify.welcome({ email: email.trim().toLowerCase(), name: name.trim() });
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
        <View style={styles.langRow}>
          <BackButton />
          <View style={styles.langPicker}>
            {(['en', 'sk'] as Lang[]).map(l => (
              <TouchableOpacity key={l} style={[styles.langBtn, lang === l && styles.langBtnActive]} onPress={() => setLang(l)} activeOpacity={0.7}>
                <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]}>{t.languages[l]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{t.auth.createAccount}</Text>
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

        {/* Fields */}
        <View style={styles.form}>
          <Input
            label={t.auth.yourName}
            value={name}
            onChangeText={setName}
            placeholder={t.auth.fullNamePlaceholder}
            error={errors.name}
          />
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
            label={t.auth.createPassword}
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.passwordPlaceholder}
            secureTextEntry
            error={errors.password}
          />
        </View>

        <Button label={t.auth.register} onPress={handleRegister} loading={loading} variant="black" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 32 },
  backText: { fontSize: 22, color: Colors.black, fontWeight: '400', fontFamily: Fonts.regular },
  langRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langPicker: { flexDirection: 'row', gap: 6 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight },
  langBtnActive: { backgroundColor: Colors.black },
  langBtnText: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  langBtnTextActive: { color: Colors.lime },
  header: { marginTop: 32, marginBottom: 28 },
  title: { fontSize: 30, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, letterSpacing: -0.5 },
  social: { gap: 12, marginBottom: 20 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.grayBorder },
  dividerText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  form: { gap: 20, marginBottom: 32 },
});
