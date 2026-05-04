import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState({
    newEvents: true,
    eventReminders: true,
    chatMessages: true,
    clubUpdates: false,
    promotions: false,
  });

  const ITEMS: Array<{ key: keyof typeof notifs; label: string; sub: string }> = [
    { key: 'newEvents', label: 'New events', sub: 'Events matching your interests' },
    { key: 'eventReminders', label: 'Event reminders', sub: "You're going — we'll remind you" },
    { key: 'chatMessages', label: 'Chat messages', sub: 'Group chat activity' },
    { key: 'clubUpdates', label: 'Club updates', sub: 'New members and requests' },
    { key: 'promotions', label: 'Promotions', sub: 'Offers and featured events' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.list}>
          {ITEMS.map((item, i) => (
            <View key={item.key} style={[styles.row, i === ITEMS.length - 1 && styles.rowLast]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>{item.sub}</Text>
              </View>
              <Switch
                value={notifs[item.key]}
                onValueChange={val => setNotifs(n => ({ ...n, [item.key]: val }))}
                trackColor={{ false: Colors.grayBorder, true: Colors.lime }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
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
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: Colors.grayBorder, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: Colors.black },
  rowSub: { fontSize: 13, color: Colors.gray },
});
