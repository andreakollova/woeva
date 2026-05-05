import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Notification } from '@/types';
import { BackButton } from '@/components/ui/BackButton';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifications((data ?? []) as Notification[]);
        // Mark all as read
        supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false).then(() => {});
      });
  }, [user]));

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function iconForType(type: Notification['type']) {
    if (type === 'event_cancelled') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke="#FF6B6B" strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    );
    if (type === 'new_event') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={Colors.black} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    );
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  function iconBgForType(type: Notification['type']) {
    if (type === 'event_cancelled') return '#FFF0F0';
    if (type === 'new_event') return Colors.lime;
    return Colors.grayLight;
  }

  function handleTap(n: Notification) {
    const eventId = n.data?.event_id;
    if (eventId) router.push(`/event/${eventId}` as any);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.grayBorder} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        )}

        {notifications.map((n, i) => (
          <TouchableOpacity
            key={n.id}
            style={[styles.row, !n.read && styles.rowUnread]}
            onPress={() => handleTap(n)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: iconBgForType(n.type) }]}>
              {iconForType(n.type)}
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{n.title}</Text>
              {n.body ? <Text style={styles.rowBody}>{n.body}</Text> : null}
              <Text style={styles.rowTime}>{timeAgo(n.created_at)}</Text>
            </View>
            {!n.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowUnread: { backgroundColor: '#FAFFF0' },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowContent: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, lineHeight: 20 },
  rowBody: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  rowTime: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lime, marginTop: 6, flexShrink: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
});
