import { BackButton } from '@/components/ui/BackButton';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useTranslations } from '@/context/LanguageContext';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();

  const LEGAL_ITEMS = [
    { label: t.about.privacyPolicy, onPress: () => Linking.openURL('https://woeva.com/privacy').catch(() => {}) },
    { label: t.about.termsOfService, onPress: () => router.push('/settings/legal?type=terms' as any) },
    { label: t.about.contactUs, onPress: () => Linking.openURL('mailto:admin@woeva.com').catch(() => {}) },
  ];

  const MORE_ITEMS = [
    { label: t.about.followInstagram, onPress: () => Linking.openURL('https://www.instagram.com/letsdowoeva/').catch(() => {}) },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.about.about}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {/* App icon */}
        <View style={styles.appCard}>
          <Image source={require('../../assets/app-icon-logo.png')} style={styles.iconBox} />
          <Text style={styles.appName}>Woeva</Text>
          <Text style={styles.appVersion}>Version 1.3.0 · build 72</Text>
          <Text style={styles.appTagline}>{t.about.appTagline}</Text>
        </View>

        {/* Legal */}
        <View style={styles.list}>
          {LEGAL_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.row, i === LEGAL_ITEMS.length - 1 && styles.rowLast]}
              onPress={item.onPress}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* More */}
        <View style={[styles.list, { marginTop: 16 }]}>
          {MORE_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.row, i === MORE_ITEMS.length - 1 && styles.rowLast]}
              onPress={item.onPress}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Refund policy */}
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>{t.about.cancellationPolicy}</Text>
          <Text style={styles.policyText}>{t.about.cancellationText}</Text>
        </View>

        <Text style={styles.footer}>{t.about.madeBy}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  title: { fontSize: 20, fontWeight: '700', color: Colors.black },
  scroll: { paddingHorizontal: 20 },
  appCard: { alignItems: 'center', paddingVertical: 24, gap: 6, marginBottom: 24 },
  iconBox: { width: 72, height: 72, borderRadius: 16, marginBottom: 8 },
  appName: { fontSize: 22, fontWeight: '700', color: Colors.black },
  appVersion: { fontSize: 13, color: Colors.gray },
  appTagline: { fontSize: 14, color: Colors.gray, marginTop: 4 },
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: Colors.black },
  rowArrow: { fontSize: 20, color: Colors.gray },
  policyCard: { marginTop: 16, borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, padding: 16, gap: 8 },
  policyTitle: { fontSize: 14, fontWeight: '700', color: Colors.black },
  policyText: { fontSize: 13, color: Colors.gray, lineHeight: 20 },
  policyBold: { fontWeight: '700', color: Colors.black },
  footer: { textAlign: 'center', fontSize: 13, color: Colors.gray, marginTop: 32 },
});
