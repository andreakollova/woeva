import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { BackButton } from '@/components/ui/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.toggle, value && styles.toggleOn]}
      activeOpacity={0.8}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </TouchableOpacity>
  );
}

function NotifRow({
  label,
  sub,
  value,
  onToggle,
  last,
  star,
}: {
  label: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
  last?: boolean;
  star?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.rowText}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          {star && <Text style={{ fontSize: 14 }}>⭐</Text>}
        </View>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Toggle value={value} onToggle={onToggle} />
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, refetchProfile } = useAuth();
  const { t } = useTranslations();

  const [enabled, setEnabled] = useState(profile?.notifications_enabled ?? true);
  const [myTags, setMyTags] = useState(profile?.notif_new_event_my_tags ?? true);
  const [allEvents, setAllEvents] = useState(profile?.notif_new_event_all ?? false);
  const [clubEvents, setClubEvents] = useState(profile?.notif_club_events ?? true);
  const [chat, setChat] = useState(profile?.notif_chat ?? true);
  const [attendees, setAttendees] = useState(profile?.notif_attendees ?? true);

  async function save(patch: Record<string, boolean>) {
    if (!user) return;
    await supabase.from('profiles').update(patch).eq('id', user.id);
    refetchProfile();
  }

  function toggleMaster() {
    const next = !enabled;
    setEnabled(next);
    save({ notifications_enabled: next });
  }

  function toggleMyTags() {
    const next = !myTags;
    setMyTags(next);
    save({ notif_new_event_my_tags: next });
  }

  function toggleAllEvents() {
    const next = !allEvents;
    setAllEvents(next);
    save({ notif_new_event_all: next });
  }

  function toggleClubEvents() {
    const next = !clubEvents;
    setClubEvents(next);
    save({ notif_club_events: next });
  }

  function toggleChat() {
    const next = !chat;
    setChat(next);
    save({ notif_chat: next });
  }

  function toggleAttendees() {
    const next = !attendees;
    setAttendees(next);
    save({ notif_attendees: next });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.common.notifications}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>

        {/* Master toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.pushNotifications}</Text>
          <View style={styles.list}>
            <TouchableOpacity style={styles.row} onPress={toggleMaster} activeOpacity={0.8}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t.settings.eventNotifications}</Text>
                <Text style={styles.rowSub}>{t.settings.eventNotificationsSub}</Text>
              </View>
              <Toggle value={enabled} onToggle={toggleMaster} />
            </TouchableOpacity>
          </View>
        </View>

        {/* My feed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.myFeed}</Text>
          <View style={styles.list}>
            <NotifRow
              label={t.settings.notifMyTags}
              sub={t.settings.notifMyTagsSub}
              value={myTags}
              onToggle={toggleMyTags}
              star
            />
            <NotifRow
              label={t.settings.notifAllEvents}
              sub={t.settings.notifAllEventsSub}
              value={allEvents}
              onToggle={toggleAllEvents}
              last
            />
          </View>
        </View>

        {/* Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.activity}</Text>
          <View style={styles.list}>
            <NotifRow
              label={t.settings.notifClubEvents}
              sub={t.settings.notifClubEventsSub}
              value={clubEvents}
              onToggle={toggleClubEvents}
            />
            <NotifRow
              label={t.settings.notifChat}
              sub={t.settings.notifChatSub}
              value={chat}
              onToggle={toggleChat}
            />
            <NotifRow
              label={t.settings.notifAttendees}
              sub={t.settings.notifAttendeesSub}
              value={attendees}
              onToggle={toggleAttendees}
              last
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  list: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 15, fontFamily: Fonts.medium, fontWeight: '500', color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2, lineHeight: 17 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  thumbOn: { alignSelf: 'flex-end' },
});
