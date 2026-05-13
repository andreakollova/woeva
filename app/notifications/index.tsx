import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Notification } from '@/types';
import { BackButton } from '@/components/ui/BackButton';
import { useTranslations } from '@/context/LanguageContext';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslations();
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
    if (mins < 60) return t.notif.minutesAgo(mins);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t.notif.hoursAgo(hours);
    const days = Math.floor(hours / 24);
    return t.notif.daysAgo(days);
  }

  function iconForType(type: Notification['type']) {
    if (type === 'event_cancelled') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke="#FF6B6B" strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    );
    if (type === 'new_event' || type === 'club_event') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={Colors.black} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
    );
    if (type === 'admin_invite') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 11h6m-3-3v6" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" />
        <Path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={Colors.black} strokeWidth={2} />
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
    if (type === 'new_event' || type === 'club_event') return Colors.lime;
    if (type === 'admin_invite') return '#E8F4FF';
    return Colors.grayLight;
  }

  async function handleAdminInvite(n: Notification, accept: boolean) {
    const clubId = n.data?.club_id;
    if (!clubId || !user) return;
    if (accept) {
      await supabase.from('club_members')
        .update({ status: 'approved' })
        .eq('club_id', clubId).eq('user_id', user.id).eq('role', 'admin');
      Alert.alert(t.notif.welcomeAboard, t.notif.welcomeAboardMsg);
    } else {
      await supabase.from('club_members')
        .delete()
        .eq('club_id', clubId).eq('user_id', user.id).eq('role', 'admin').eq('status', 'pending');
    }
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
  }

  function handleTap(n: Notification) {
    if (n.type === 'admin_invite' && n.data?.action === 'admin_invite') {
      Alert.alert(n.title, n.body ?? '', [
        { text: t.common.decline, style: 'destructive', onPress: () => handleAdminInvite(n, false) },
        { text: t.common.accept, onPress: () => handleAdminInvite(n, true) },
      ]);
      return;
    }
    const eventId = n.data?.event_id;
    if (eventId) router.push(`/event/${eventId}` as any);
    const clubId = n.data?.club_id;
    if (clubId && !eventId) router.push(`/club/${clubId}` as any);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.title}>{t.notif.notifications}</Text>
        <TouchableOpacity onPress={() => router.push('/settings/notifications' as any)} hitSlop={8} style={styles.settingsBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.grayBorder} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyText}>{t.notif.noNotifications}</Text>
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
              {n.type === 'admin_invite' && !n.read && (
                <Text style={styles.rowAction}>{t.notif.tapToAcceptDecline}</Text>
              )}
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
  settingsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowUnread: { backgroundColor: '#FAFFF0' },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowContent: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, lineHeight: 20 },
  rowBody: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  rowTime: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  rowAction: { fontSize: 12, color: Colors.black, fontFamily: Fonts.medium, fontWeight: '600', marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lime, marginTop: 6, flexShrink: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
});
