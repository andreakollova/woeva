import { BackButton } from '@/components/ui/BackButton';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { WMark } from '@/components/ui/WMark';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const LEGAL_ITEMS = [
    { label: 'Terms of service', onPress: () => {} },
    { label: 'Privacy policy', onPress: () => {} },
    { label: 'Licenses', onPress: () => {} },
  ];

  const MORE_ITEMS = [
    { label: 'Rate Woeva', onPress: () => {} },
    { label: 'Follow @woevaapp', onPress: () => Linking.openURL('https://instagram.com/woevaapp').catch(() => {}) },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>About</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {/* App icon */}
        <View style={styles.appCard}>
          <View style={styles.iconBox}>
            <WMark size={40} color={Colors.black} />
          </View>
          <Text style={styles.appName}>Woeva</Text>
          <Text style={styles.appVersion}>Version 1.0.0 · build 1</Text>
          <Text style={styles.appTagline}>Your people are already out.</Text>
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

        <Text style={styles.footer}>Made by people for people.</Text>
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
  iconBox: { width: 72, height: 72, borderRadius: 16, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  appName: { fontSize: 22, fontWeight: '700', color: Colors.black },
  appVersion: { fontSize: 13, color: Colors.gray },
  appTagline: { fontSize: 14, color: Colors.gray, marginTop: 4 },
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: Colors.black },
  rowArrow: { fontSize: 20, color: Colors.gray },
  footer: { textAlign: 'center', fontSize: 13, color: Colors.gray, marginTop: 32 },
});
