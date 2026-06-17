import { BackButton } from '@/components/ui/BackButton';
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
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

function Icon({ name, color = '#0A0A0A' }: { name: string; color?: string }) {
  const s = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'user': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...s}/><Circle cx="12" cy="7" r="4" {...s}/></Svg>;
    case 'star': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" {...s}/></Svg>;
    case 'card': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Rect x="1" y="4" width="22" height="16" rx="2" {...s}/><Line x1="1" y1="10" x2="23" y2="10" {...s}/></Svg>;
    case 'bell': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...s}/><Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/></Svg>;
    case 'chart': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Line x1="18" y1="20" x2="18" y2="10" {...s}/><Line x1="12" y1="20" x2="12" y2="4" {...s}/><Line x1="6" y1="20" x2="6" y2="14" {...s}/></Svg>;
    case 'info': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="10" {...s}/><Line x1="12" y1="8" x2="12" y2="8" strokeWidth={2.5} stroke={color}/><Path d="M12 12v4" {...s}/></Svg>;
    case 'mail': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" {...s}/><Path d="M22 6l-10 7L2 6" {...s}/></Svg>;
    case 'logout': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...s}/><Path d="M16 17l5-5-5-5" {...s}/><Path d="M21 12H9" {...s}/></Svg>;
    case 'trash': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" {...s}/></Svg>;
    default: return null;
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { t, lang, setLang } = useTranslations();
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));

  const SECTIONS = [
    {
      title: t.settings.account,
      items: [
        { label: t.settings.profileInfo, route: '/settings/profile', icon: 'user' },
        { label: t.settings.interests, route: '/settings/profile', icon: 'star' },
      ],
    },
    {
      title: t.settings.creator,
      items: [
        { label: t.common.notifications, route: '/settings/notifications', icon: 'bell' },
        { label: t.dashboard.revenue, route: '/dashboard?tab=payouts', icon: 'chart' },
      ],
    },
    {
      title: t.settings.support,
      items: [
        { label: t.settings.about, route: '/settings/about', icon: 'info' },
        { label: lang === 'sk' ? 'Kontaktovať podporu' : 'Contact support', route: 'mailto:admin@woeva.com', icon: 'mail' },
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

        {SECTIONS.map((section, si) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.list}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, i === section.items.length - 1 && si !== 0 && styles.rowLast]}
                  onPress={() => item.route.startsWith('mailto:') ? Linking.openURL(item.route) : router.push(item.route as any)}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIconWrap}>
                      <Icon name={item.icon} />
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                  </View>
                  <ChevronIcon />
                </TouchableOpacity>
              ))}
              {/* Language picker — shown at end of Account section */}
              {si === 0 && (
                <View style={[styles.row, styles.rowLast, { justifyContent: 'space-between' }]}>
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIconWrap}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#0A0A0A" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#0A0A0A" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <Text style={styles.rowLabel}>{t.settings.language}</Text>
                  </View>
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
              )}
            </View>
          </View>
        ))}

        {/* Danger zone */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <View style={styles.list}>
            <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.6}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="logout" color={Colors.black} />
                </View>
                <Text style={styles.rowLabel}>{t.settings.signOut}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/settings/delete-account')} activeOpacity={0.6}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, { backgroundColor: '#F2F2F2', width: 28, height: 28, borderRadius: 8, transform: [{ scale: 0.85 }] }]}>
                  <Icon name="trash" color="#999999" />
                </View>
                <Text style={[styles.rowLabel, { fontSize: 12, color: '#999999' }]}>{t.settings.deleteAccount}</Text>
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
