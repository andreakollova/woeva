import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
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
    if (type === 'admin_invite' || type === 'coordinator_invite') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16 11h6m-3-3v6" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" />
        <Path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={Colors.black} strokeWidth={2} />
      </Svg>
    );
    if (type === 'join') return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={Colors.black} strokeWidth={2} />
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
    if (type === 'admin_invite' || type === 'coordinator_invite') return '#E8F4FF';
    if (type === 'join') return Colors.lime;
    return Colors.grayLight;
  }

  async function deleteNotification(id: string) {
    setNotifications(prev => prev.filter(x => x.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }

  async function handleInvite(n: Notification, accept: boolean) {
    const clubId = n.data?.club_id;
    const token = n.data?.token;
    const isCoord = n.type === 'coordinator_invite';
    if (!clubId || !user) return;

    if (accept) {
      if (token) {
        const { data: invite } = await supabase
          .from('pending_invites').select('*')
          .eq('token', token).eq('status', 'pending').single();
        if (!invite || new Date(invite.expires_at) < new Date()) {
          Alert.alert('Chyba', 'Pozvánka vypršala alebo už bola použitá.');
          return;
        }
        if (isCoord) {
          await supabase.from('coordinators').upsert(
            { club_id: clubId, event_id: invite.event_id ?? null, user_id: user.id, invited_by: invite.invited_by, status: 'active' },
            { onConflict: 'club_id,event_id,user_id' }
          );
        } else {
          await supabase.from('club_members').upsert(
            { club_id: clubId, user_id: user.id, role: 'admin', status: 'approved' },
            { onConflict: 'club_id,user_id' }
          );
        }
        await supabase.from('pending_invites').update({ status: 'accepted', accepted_by: user.id }).eq('token', token);
        if (invite.invited_by) {
          const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
          const notifTitle = isCoord ? 'Koordinátor sa pripojil' : 'Pozvánka prijatá';
          const notifBody = `${myProfile?.name ?? 'Niekto'} prijal/a pozvánku do klubu ${invite.club_name}.`;
          await supabase.from('notifications').insert({
            user_id: invite.invited_by,
            type: isCoord ? 'coordinator_accepted' : 'admin_accepted',
            title: notifTitle, body: notifBody, data: { club_id: clubId },
          });
          const { data: inviterProfile } = await supabase.from('profiles').select('push_token')
            .eq('id', invite.invited_by).or('notifications_enabled.is.null,notifications_enabled.eq.true').single();
          if (inviterProfile?.push_token?.startsWith('ExponentPushToken[')) {
            await supabase.functions.invoke('send-push', {
              body: { tokens: [inviterProfile.push_token], title: notifTitle, body: notifBody, data: { club_id: clubId } },
            });
          }
        }
      } else {
        // Legacy: direct club_members pending flow (from old dashboard invite)
        await supabase.from('club_members').update({ status: 'approved' })
          .eq('club_id', clubId).eq('user_id', user.id).eq('role', 'admin');
      }
      if (isCoord) {
        const eventId = invite?.event_id;
        router.replace({ pathname: '/dashboard', params: eventId ? { openEvent: eventId } : {} } as any);
      } else {
        Alert.alert(t.notif.welcomeAboard, t.notif.welcomeAboardMsg);
      }
    } else {
      if (token) {
        await supabase.from('pending_invites').update({ status: 'declined' }).eq('token', token);
      } else {
        await supabase.from('club_members').delete()
          .eq('club_id', clubId).eq('user_id', user.id).eq('role', 'admin').eq('status', 'pending');
      }
    }
    await supabase.from('notifications').delete().eq('id', n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  }

  function handleTap(n: Notification) {
    if ((n.type === 'admin_invite' || n.type === 'coordinator_invite') && n.data?.action) {
      handleInvite(n, true);
      return;
    }
    const eventId = n.data?.event_id;
    const isChat = n.type === 'chat' || n.data?.type === 'chat';
    if (isChat && eventId) { router.push(`/chat/${eventId}` as any); return; }
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

      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.grayBorder} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.emptyText}>{t.notif.noNotifications}</Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <Swipeable
            renderRightActions={(progress, drag) => {
              const scale = drag.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.8], extrapolate: 'clamp' });
              return (
                <TouchableOpacity style={styles.deleteAction} onPress={() => deleteNotification(n.id)} activeOpacity={0.8}>
                  <Animated.View style={{ transform: [{ scale }] }}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Animated.View>
                </TouchableOpacity>
              );
            }}
            overshootRight={false}
          >
            <TouchableOpacity
              style={[styles.row, !n.read && styles.rowUnread]}
              onPress={() => handleTap(n)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: iconBgForType(n.type) }]}>
                {iconForType(n.type)}
              </View>
              <View style={styles.rowContent}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.rowTime}>{timeAgo(n.created_at)}</Text>
                </View>
                {n.body ? <Text style={styles.rowBody}>{n.body}</Text> : null}
                {(n.type === 'admin_invite' || n.type === 'coordinator_invite') && !n.read && (
                  <View style={styles.inviteActions}>
                    <TouchableOpacity style={styles.declineInviteBtn} onPress={() => Alert.alert(lang === 'sk' ? 'Odmietnuť pozvánku?' : 'Decline invite?', lang === 'sk' ? 'Si si istý/á?' : 'Are you sure?', [{ text: lang === 'sk' ? 'Späť' : 'Back', style: 'cancel' }, { text: lang === 'sk' ? 'Odmietnuť' : 'Decline', style: 'destructive', onPress: () => handleInvite(n, false) }])} activeOpacity={0.7}>
                      <Text style={styles.declineInviteBtnText}>{t.common.decline}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptInviteBtn} onPress={() => handleInvite(n, true)} activeOpacity={0.7}>
                      <Text style={styles.acceptInviteBtnText}>{t.common.accept}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          </Swipeable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 },
  settingsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, position: 'absolute' as const, left: 0, right: 0, textAlign: 'center' as const },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowUnread: { backgroundColor: '#FAFFF0' },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowContent: { flex: 1, gap: 3 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, lineHeight: 20, flex: 1 },
  rowBody: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  rowTime: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, flexShrink: 0 },
  rowAction: { fontSize: 12, color: Colors.black, fontFamily: Fonts.medium, fontWeight: '600', marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lime, marginTop: 6, flexShrink: 0 },
  deleteAction: { width: 72, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptInviteBtn: { backgroundColor: Colors.lime, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  acceptInviteBtnText: { fontSize: 12, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  declineInviteBtn: { backgroundColor: Colors.black, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  declineInviteBtnText: { fontSize: 12, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
});
