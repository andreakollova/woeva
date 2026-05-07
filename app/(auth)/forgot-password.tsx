import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.includes('@')) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    setSent(true);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Your city is waiting for you.</Text>
      </View>

      {sent ? (
        <View style={styles.sentBox}>
          <Text style={styles.sentTitle}>Check your email</Text>
          <Text style={styles.sentText}>We sent a reset link to {email}</Text>
        </View>
      ) : (
        <>
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <Button label="Send reset link" onPress={handleReset} loading={loading} variant="black" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  backBtn: { marginBottom: 40 },
  backText: { fontSize: 22, color: Colors.black },
  header: { marginBottom: 36, gap: 6 },
  title: { fontSize: 30, fontWeight: '700', color: Colors.black, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.gray },
  form: { marginBottom: 40 },
  sentBox: { padding: 20, backgroundColor: Colors.grayLight, borderRadius: 16, gap: 6 },
  sentTitle: { fontSize: 18, fontWeight: '700', color: Colors.black },
  sentText: { fontSize: 14, color: Colors.gray },
});
