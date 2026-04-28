import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp() {
    if (!phone || phone.length < 9) { setError('Enter a valid phone number'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push({ pathname: '/(auth)/otp', params: { phone } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Enter your number</Text>
          <Text style={styles.subtitle}>We'll send you a code to verify.</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Phone number"
            value={phone}
            onChangeText={t => { setPhone(t); setError(''); }}
            placeholder="+421 900 000 000"
            keyboardType="phone-pad"
            error={error}
          />
        </View>

        <View style={styles.bottom}>
          <Button label="Send code" onPress={handleSendOtp} loading={loading} variant="black" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  backBtn: { marginBottom: 40 },
  backText: { fontSize: 22, color: Colors.black, fontWeight: '400' },
  header: { marginBottom: 36, gap: 6 },
  title: { fontSize: 30, fontWeight: '700', color: Colors.black, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.gray },
  form: { gap: 20, marginBottom: 40 },
  bottom: { gap: 14 },
});
