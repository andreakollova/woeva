import { BackButton } from '@/components/ui/BackButton';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';

const SECTIONS = [
  {
    title: 'Account',
    items: [
      { label: 'Profile info', route: '/settings/profile' },
      { label: 'Interests', route: '/settings/profile' },
      { label: 'Payment methods', route: '/settings/payment-methods' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'Notifications', route: '/settings/notifications' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'About', route: '/settings/about' },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)'); } },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
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
              <Text style={[styles.rowLabel, { color: Colors.error }]}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/settings/delete-account')}>
              <Text style={[styles.rowLabel, { color: Colors.error }]}>Delete account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  title: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.3, marginBottom: 8, textTransform: 'uppercase' },
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 16, fontFamily: Fonts.regular, color: Colors.black },
  rowArrow: { fontSize: 20, color: Colors.gray },
});
