import { BackButton } from '@/components/ui/BackButton';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/context/LanguageContext';

export default function OtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phone, email, name, type: otpType } = useLocalSearchParams<{ phone?: string; email?: string; name?: string; type?: string }>();
  const isEmail = otpType === 'email';
  const { t } = useTranslations();
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  function handleChange(text: string, index: number) {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 7) inputs.current[index + 1]?.focus();
    if (!text && index > 0) inputs.current[index - 1]?.focus();
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 8) { setError(t.auth.enter6Digit); return; }
    setLoading(true);

    if (isEmail) {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: email!, token: code, type: 'email' });
      setLoading(false);
      if (verifyError) { setError(t.auth.invalidCode); return; }
      // Save profile name now that we have a verified session
      if (data.user && name) {
        await supabase.from('profiles').upsert({ id: data.user.id, name: decodeURIComponent(name), email: email!.toLowerCase() });
      }
      router.replace('/(auth)/profile-setup');
    } else {
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: phone!, token: code, type: 'sms' });
      setLoading(false);
      if (verifyError) { setError(t.auth.invalidCode); return; }
      router.replace('/(auth)/interests');
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendSent(false);
    setError('');
    if (isEmail) {
      await supabase.auth.signInWithOtp({ email: email!, options: { shouldCreateUser: true } });
    } else {
      await supabase.auth.signInWithOtp({ phone: phone! });
    }
    setResendLoading(false);
    setResendSent(true);
    setResendTimer(60);
    setOtp(['', '', '', '', '', '', '', '']);
    setTimeout(() => setResendSent(false), 8000);
  }

  const destination = isEmail ? email! : phone!;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.title}>{isEmail ? t.auth.checkEmail : t.auth.checkMessages}</Text>
        <Text style={styles.subtitle}>{t.auth.codeSentTo(destination)}</Text>
        {resendSent && (
          <View style={styles.resendSuccess}>
            <Text style={styles.resendSuccessText}>✓ Nový kód odoslaný</Text>
          </View>
        )}
      </View>

      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={r => { if (r) inputs.current[i] = r; }}
            style={[styles.otpBox, digit && styles.otpBoxFilled, error && styles.otpBoxError]}
            value={digit}
            onChangeText={v => handleChange(v.slice(-1), i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.bottom}>
        <Button label={t.auth.verify} onPress={handleVerify} loading={loading} variant="black" />
        {resendTimer > 0
          ? <Text style={styles.resendTimer}>Znovu odoslať za <Text style={styles.resendTimerBold}>{resendTimer}s</Text></Text>
          : <Button label={resendLoading ? 'Odosielam...' : t.auth.resendCode} onPress={handleResend} variant="ghost" disabled={resendLoading} />
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  backBtn: { marginBottom: 40 },
  backText: { fontSize: 22, color: Colors.black },
  header: { marginTop: 36, marginBottom: 40, gap: 8 },
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
  resendSuccess: { alignSelf: 'flex-start', backgroundColor: Colors.black, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  resendSuccessText: { fontSize: 13, color: Colors.lime, fontWeight: '700' },
  resendTimer: { textAlign: 'center', fontSize: 14, color: Colors.gray },
  resendTimerBold: { fontWeight: '700', color: Colors.black },
});
