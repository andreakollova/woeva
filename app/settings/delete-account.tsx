import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/context/LanguageContext';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    Alert.alert(
      t.deleteAccount.finalWarning,
      t.deleteAccount.finalWarningMsg,
      [
        { text: t.deleteAccount.cancel, style: 'cancel' },
        {
          text: t.deleteAccount.deleteForever,
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await supabase.functions.invoke('delete-account');
            await supabase.auth.signOut();
            setLoading(false);
            router.replace('/(auth)');
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.deleteAccount.title}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.warningTitle}>{t.deleteAccount.warning}</Text>
        <Text style={styles.warningText}>{t.deleteAccount.warningText}</Text>
      </View>

      <View style={styles.footer}>
        <Button label={t.deleteAccount.deleteButton} onPress={handleDelete} loading={loading} variant="danger" />
        <Button label={t.deleteAccount.cancel} onPress={() => router.back()} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 48 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  title: { fontSize: 20, fontWeight: '700', color: Colors.black },
  content: { flex: 1, justifyContent: 'center', gap: 16 },
  warningTitle: { fontSize: 38, fontWeight: '800', color: Colors.black, letterSpacing: -1, lineHeight: 44 },
  warningText: { fontSize: 15, color: Colors.gray, lineHeight: 22 },
  footer: { gap: 10 },
});
