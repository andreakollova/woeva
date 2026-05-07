import { BackButton } from '@/components/ui/BackButton';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { WMark } from '@/components/ui/WMark';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import type { Lang } from '@/lib/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { t, lang, setLang } = useTranslations();

  const SECTIONS = [
    {
      title: t.settings.account,
      items: [
        { label: t.settings.profileInfo, route: '/settings/profile' },
        { label: t.settings.interests, route: '/settings/profile' },
        { label: t.settings.paymentMethods, route: '/settings/payment-methods' },
      ],
    },
    {
      title: t.settings.creator,
      items: [
        { label: t.common.notifications, route: '/settings/notifications' },
        { label: t.dashboard.revenue, route: '/dashboard' },
      ],
    },
    {
      title: t.settings.support,
      items: [
        { label: t.settings.about, route: '/settings/about' },
      ],
    },
  ];

  async function handleSignOut() {
    Alert.alert(t.settings.signOutConfirm, t.settings.signOutMsg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.settings.signOut, style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)'); } },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.settings.settings}</Text>
        <WMark size={28} color={Colors.lime} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {/* Language switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.language}</Text>
          <View style={[styles.list, styles.langRow]}>
            {(['en', 'sk'] as Lang[]).map((l, i) => (
              <TouchableOpacity
                key={l}
                style={[styles.row, styles.langItem, lang === l && styles.langItemActive, i === 1 && styles.rowLast]}
                onPress={() => setLang(l)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowLabel, lang === l && styles.langLabelActive]}>{t.languages[l]}</Text>
                {lang === l && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.list}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, i === section.items.length - 1 && styles.rowLast]}
                  onPress={() => router.push(item.route as any)}
                >
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out + delete */}
        <View style={styles.section}>
          <View style={styles.list}>
            <TouchableOpacity style={styles.row} onPress={handleSignOut}>
              <Text style={[styles.rowLabel, { color: Colors.error }]}>{t.settings.signOut}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/settings/delete-account')}>
              <Text style={[styles.rowLabel, { color: Colors.error }]}>{t.settings.deleteAccount}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.black },
  rowArrow: { fontSize: 18, color: Colors.gray },
  langRow: { flexDirection: 'column' },
  langItem: {},
  langItemActive: { backgroundColor: '#FAFFF0' },
  langLabelActive: { fontWeight: '700', fontFamily: Fonts.bold },
  langCheck: { fontSize: 14, color: Colors.lime, fontWeight: '700' },
});
