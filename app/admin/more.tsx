import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { AdminTabBar } from '@/components/admin/AdminTabBar';
import { useAuth } from '@/context/AuthContext';

const SECTIONS = [
  { route: '/admin/reports',    icon: '🚩', label: 'Hlásenia',    sub: 'Skontrolovať hlásenia' },
  { route: '/admin/events',     icon: '🎉', label: 'Podujatia',   sub: 'Spravovať podujatia' },
  { route: '/admin/clubs',      icon: '🏛',  label: 'Kluby',       sub: 'Spravovať kluby' },
  { route: '/admin/categories', icon: '🏷',  label: 'Kategórie',  sub: 'Upraviť a zoradiť' },
  { route: '/admin/broadcast',  icon: '📣',  label: 'Broadcast',  sub: 'Push a email notifikácie' },
  { route: '/admin/chat',       icon: '💬',  label: 'Chat',       sub: 'Monitorovať chaty' },
];

export default function AdminMoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();

  function handleSignOut() {
    Alert.alert('Odhlásiť sa', 'Naozaj sa chceš odhlásiť?', [
      { text: 'Zrušiť', style: 'cancel' },
      { text: 'Odhlásiť', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <View style={styles.grid}>
          {SECTIONS.map(s => (
            <TouchableOpacity
              key={s.route}
              style={styles.tile}
              onPress={() => router.push(s.route as any)}
              activeOpacity={0.75}
            >
              <Text style={styles.tileIcon}>{s.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileLabel}>{s.label}</Text>
                <Text style={styles.tileSub}>{s.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>ÚČET</Text>
        <TouchableOpacity style={[styles.tile, { backgroundColor: '#1A0A0A' }]} onPress={handleSignOut} activeOpacity={0.75}>
          <Text style={[styles.tileIcon]}>🚪</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tileLabel, { color: '#FF6B6B' }]}>Odhlásiť sa</Text>
            <Text style={styles.tileSub}>Odísť z admin panelu</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <AdminTabBar active="more" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', fontFamily: Fonts.semibold, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 },
  grid: { gap: 10 },
  tile: {
    backgroundColor: '#161616',
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tileIcon: { fontSize: 28, width: 44, textAlign: 'center' },
  tileLabel: { fontSize: 16, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white },
  tileSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular, marginTop: 3 },
});
