import { BackButton } from '@/components/ui/BackButton';
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputs = useRef<TextInput[]>([]);

  function handleChange(text: string, index: number) {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
    if (!text && index > 0) inputs.current[index - 1]?.focus();
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: phone!, token: code, type: 'sms' });
    setLoading(false);
    if (error) { setError('Invalid code. Try again.'); return; }
    router.replace('/(auth)/interests');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>Check your messages</Text>
        <Text style={styles.subtitle}>We sent a code to {phone}</Text>
      </View>

      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={r => { if (r) inputs.current[i] = r; }}
            style={[styles.otpBox, digit && styles.otpBoxFilled, error && styles.otpBoxError]}
            value={digit}
            onChangeText={t => handleChange(t.slice(-1), i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.bottom}>
        <Button label="Verify" onPress={handleVerify} loading={loading} variant="black" />
        <Button label="Resend code" onPress={() => supabase.auth.signInWithOtp({ phone: phone! })} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  backBtn: { marginBottom: 40 },
  backText: { fontSize: 22, color: Colors.black },
  header: { marginBottom: 40, gap: 8 },
  title: { fontSize: 30, fontWeight: '700', color: Colors.black, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.gray },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  otpBox: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  otpBoxFilled: { borderColor: Colors.black },
  otpBoxError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 16 },
  bottom: { gap: 12 },
});
