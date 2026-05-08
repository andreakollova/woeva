import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';

type Target = 'all' | 'city' | 'interest';
type Channel = 'push' | 'email' | 'both';

export default function AdminBroadcastScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [target, setTarget] = useState<Target>('all');
  const [channel, setChannel] = useState<Channel>('push');
  const [targetCity, setTargetCity] = useState('');
  const [targetInterest, setTargetInterest] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);

  async function countRecipients() {
    setCounting(true);
    let query = supabase.from('profiles').select('id', { count: 'exact', head: true });
    if (target === 'city' && targetCity.trim()) {
      query = query.ilike('city', `%${targetCity.trim()}%`);
    } else if (target === 'interest' && targetInterest.trim()) {
      query = query.contains('interests', [targetInterest.trim()]);
    }
    const { count } = await query;
    setRecipientCount(count ?? 0);
    setCounting(false);
  }

  async function sendBroadcast() {
    const needsPush = channel === 'push' || channel === 'both';
    const needsEmail = channel === 'email' || channel === 'both';

    if (needsPush && (!pushTitle.trim() || !pushBody.trim())) {
      Alert.alert('Chýbajúce polia', 'Vyplň prosím nadpis a text push notifikácie.'); return;
    }
    if (needsEmail && (!emailSubject.trim() || !emailBody.trim())) {
      Alert.alert('Chýbajúce polia', 'Vyplň prosím predmet a telo emailu.'); return;
    }

    const count = recipientCount ?? '?';
    Alert.alert(
      'Odoslať broadcast',
      `Odoslať ~${count} používateľom cez ${channel}?`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        {
          text: 'Odoslať', onPress: async () => {
            setSending(true);

            // Fetch recipients
            let query = supabase.from('profiles').select('push_token, email');
            if (target === 'city' && targetCity.trim()) {
              query = query.ilike('city', `%${targetCity.trim()}%`);
            } else if (target === 'interest' && targetInterest.trim()) {
              query = query.contains('interests', [targetInterest.trim()]);
            }
            const { data: profiles } = await query;

            const tokens = (profiles ?? []).map((p: any) => p.push_token).filter(Boolean);
            const emails = (profiles ?? []).map((p: any) => p.email).filter(Boolean);

            await Promise.all([
              needsPush && tokens.length > 0 &&
                supabase.functions.invoke('send-push', {
                  body: { tokens, title: pushTitle.trim(), body: pushBody.trim(), data: { type: 'broadcast' } }
                }),
              needsEmail && emails.length > 0 &&
                supabase.functions.invoke('send-email', {
                  body: {
                    to: emails,
                    subject: emailSubject.trim(),
                    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;">${emailBody.trim().replace(/\n/g, '<br/>')}</div>`,
                  }
                }),
            ]);

            // Log
            await supabase.from('admin_log').insert({
              admin_id: adminUser?.id,
              action: 'broadcast',
              note: `${channel} to ${target}: ${pushTitle || emailSubject}. Recipients: ~${count}`,
            });

            setSending(false);
            Alert.alert('Odoslané!', `Broadcast odoslaný ~${count} používateľom.`);
            setPushTitle(''); setPushBody(''); setEmailSubject(''); setEmailBody('');
            setRecipientCount(null);
          }
        },
      ]
    );
  }

  const TARGETS: { key: Target; label: string; icon: string }[] = [
    { key: 'all', label: 'Všetci', icon: '🌍' },
    { key: 'city', label: 'Podľa mesta', icon: '📍' },
    { key: 'interest', label: 'Podľa záujmu', icon: '🏷' },
  ];

  const CHANNELS: { key: Channel; label: string }[] = [
    { key: 'push', label: 'Iba push' },
    { key: 'email', label: 'Iba email' },
    { key: 'both', label: 'Push + Email' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Broadcast</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {/* Target */}
        <Text style={styles.sectionLabel}>CIEĽOVÁ SKUPINA</Text>
        <View style={styles.pillRow}>
          {TARGETS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.pill, target === t.key && styles.pillActive]}
              onPress={() => { setTarget(t.key); setRecipientCount(null); }}
            >
              <Text style={styles.pillIcon}>{t.icon}</Text>
              <Text style={[styles.pillText, target === t.key && styles.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {target === 'city' && (
          <TextInput
            style={styles.input}
            placeholder="Mesto (napr. Bratislava)"
            placeholderTextColor={Colors.gray}
            value={targetCity}
            onChangeText={t => { setTargetCity(t); setRecipientCount(null); }}
          />
        )}
        {target === 'interest' && (
          <TextInput
            style={styles.input}
            placeholder="Záujem (napr. Joga)"
            placeholderTextColor={Colors.gray}
            value={targetInterest}
            onChangeText={t => { setTargetInterest(t); setRecipientCount(null); }}
          />
        )}

        <TouchableOpacity style={styles.countBtn} onPress={countRecipients} disabled={counting}>
          {counting
            ? <ActivityIndicator color={Colors.black} size="small" />
            : <Text style={styles.countBtnText}>
                {recipientCount !== null ? `~${recipientCount} príjemcov` : 'Spočítať príjemcov'}
              </Text>
          }
        </TouchableOpacity>

        {/* Channel */}
        <Text style={styles.sectionLabel}>KANÁL</Text>
        <View style={styles.pillRow}>
          {CHANNELS.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.pill, channel === c.key && styles.pillActive]}
              onPress={() => setChannel(c.key)}
            >
              <Text style={[styles.pillText, channel === c.key && styles.pillTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Push fields */}
        {(channel === 'push' || channel === 'both') && (
          <>
            <Text style={styles.sectionLabel}>PUSH NOTIFIKÁCIA</Text>
            <TextInput
              style={styles.input}
              placeholder="Nadpis"
              placeholderTextColor={Colors.gray}
              value={pushTitle}
              onChangeText={setPushTitle}
            />
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Text správy"
              placeholderTextColor={Colors.gray}
              value={pushBody}
              onChangeText={setPushBody}
              multiline
            />
          </>
        )}

        {/* Email fields */}
        {(channel === 'email' || channel === 'both') && (
          <>
            <Text style={styles.sectionLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="Predmet"
              placeholderTextColor={Colors.gray}
              value={emailSubject}
              onChangeText={setEmailSubject}
            />
            <TextInput
              style={[styles.input, styles.multiline, { minHeight: 120 }]}
              placeholder="Telo emailu (plain text alebo HTML)"
              placeholderTextColor={Colors.gray}
              value={emailBody}
              onChangeText={setEmailBody}
              multiline
            />
          </>
        )}

        {/* Send */}
        <TouchableOpacity
          style={[styles.sendBtn, sending && { opacity: 0.6 }]}
          onPress={sendBroadcast}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color={Colors.black} />
            : <Text style={styles.sendBtnText}>Odoslať broadcast</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase', marginTop: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.grayLight },
  pillActive: { backgroundColor: Colors.black },
  pillIcon: { fontSize: 14 },
  pillText: { fontSize: 13, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  pillTextActive: { color: Colors.lime },
  input: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  countBtn: { backgroundColor: Colors.grayLight, borderRadius: 12, padding: 12, alignItems: 'center' },
  countBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  sendBtn: { backgroundColor: Colors.lime, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  sendBtnText: { fontSize: 16, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
});
