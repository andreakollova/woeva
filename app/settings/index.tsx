import { BackButton } from '@/components/ui/BackButton';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import type { Lang } from '@/lib/i18n';

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke="#C0C0C0" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { t, lang, setLang } = useTranslations();

  const SECTIONS = [
    {
      title: t.settings.account,
      items: [
        { label: t.settings.profileInfo, route: '/settings/profile', icon: '👤' },
        { label: t.settings.interests, route: '/settings/profile', icon: '✦' },
        { label: t.settings.paymentMethods, route: '/settings/payment-methods', icon: '💳' },
      ],
    },
    {
      title: t.settings.creator,
      items: [
        { label: t.common.notifications, route: '/settings/notifications', icon: '🔔' },
        { label: t.dashboard.revenue, route: '/dashboard', icon: '📊' },
      ],
    },
    {
      title: t.settings.support,
      items: [
        { label: t.settings.about, route: '/settings/about', icon: 'ℹ' },
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
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.language}</Text>
          <View style={styles.langRow}>
            {(['en', 'sk'] as Lang[]).map(l => (
              <TouchableOpacity
                key={l}
                style={[styles.langChip, lang === l && styles.langChipActive]}
                onPress={() => setLang(l)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langChipText, lang === l && styles.langChipTextActive]}>{t.languages[l]}</Text>
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
                  activeOpacity={0.6}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIconWrap}>
                      <Text style={styles.rowIcon}>{item.icon}</Text>
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                  </View>
                  <ChevronIcon />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Danger zone */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <View style={styles.list}>
            <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.6}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, styles.rowIconWrapRed]}>
                  <Text style={styles.rowIcon}>↩</Text>
                </View>
                <Text style={[styles.rowLabel, styles.rowLabelRed]}>{t.settings.signOut}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/settings/delete-account')} activeOpacity={0.6}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, styles.rowIconWrapRed]}>
                  <Text style={styles.rowIcon}>🗑</Text>
                </View>
                <Text style={[styles.rowLabel, styles.rowLabelRed]}>{t.settings.deleteAccount}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },

  scroll: { paddingHorizontal: 20 },

  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: '#ABABAB',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Language chips
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: '#F2F2F2',
  },
  langChipActive: { backgroundColor: Colors.black },
  langChipText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.black },
  langChipTextActive: { color: Colors.lime, fontFamily: Fonts.bold },

  // List (no border, just separators)
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconWrapRed: { backgroundColor: '#FFF0F0' },
  rowIcon: { fontSize: 15 },
  rowLabel: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.black },
  rowLabelRed: { color: Colors.error },
});
