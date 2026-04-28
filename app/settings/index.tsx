import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';

const SETTINGS_ITEMS = [
  { label: 'Edit profile', route: '/settings/profile' },
  { label: 'Payment methods', route: '/settings/payment-methods' },
  { label: 'Notifications', route: '/settings/notifications' },
  { label: 'About', route: '/settings/about' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)'); } },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        {/* Profile preview */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.name?.charAt(0).toUpperCase() ?? '?'}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.name ?? 'Your name'}</Text>
            <Text style={styles.profileCity}>{profile?.city ?? ''}</Text>
          </View>
        </View>

        {/* Settings list */}
        <View style={styles.list}>
          {SETTINGS_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.row, i === SETTINGS_ITEMS.length - 1 && styles.rowLast]}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger zone */}
        <View style={[styles.list, { marginTop: 20 }]}>
          <TouchableOpacity style={styles.row} onPress={handleSignOut}>
            <Text style={[styles.rowLabel, { color: Colors.error }]}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => router.push('/settings/delete-account')}>
            <Text style={[styles.rowLabel, { color: Colors.error }]}>Delete account</Text>
          </TouchableOpacity>
        </View>
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
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: Colors.grayLight, borderRadius: 16, marginBottom: 28 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: Colors.black },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.black },
  profileCity: { fontSize: 13, color: Colors.gray },
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: Colors.black },
  rowArrow: { fontSize: 20, color: Colors.gray },
});
