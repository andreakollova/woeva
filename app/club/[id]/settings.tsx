import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

const s = { stroke: '#0A0A0A', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function RowIcon({ name }: { name: string }) {
  switch (name) {
    case 'edit': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" {...s}/><Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" {...s}/></Svg>;
    case 'users': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...s}/><Circle cx="9" cy="7" r="4" {...s}/><Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" {...s}/></Svg>;
    case 'bell': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...s}/><Path d="M13.73 21a2 2 0 0 1-3.46 0" {...s}/></Svg>;
    case 'info': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="10" {...s}/><Path d="M12 12v4" {...s}/><Path d="M12 8h.01" strokeWidth={2.5} stroke="#0A0A0A" strokeLinecap="round"/></Svg>;
    case 'mail': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Rect x="2" y="4" width="20" height="16" rx="2" {...s}/><Path d="M22 6l-10 7L2 6" {...s}/></Svg>;
    case 'leave': return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/><Path d="M16 17l5-5-5-5M21 12H9" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    default: return null;
  }
}

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ClubSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lang } = useTranslations();

  const [club, setClub] = useState<{ id: string; name: string; creator_id: string } | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isCoAdmin, setIsCoAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, [id, user]);

  async function load() {
    const [{ data: clubData }, { data: memberData }] = await Promise.all([
      supabase.from('clubs').select('id, name, creator_id').eq('id', id).single(),
      user
        ? supabase.from('club_members').select('role').eq('club_id', id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setClub(clubData ?? null);
    if (user && clubData) {
      setIsCreator(clubData.creator_id === user.id);
      setIsCoAdmin(memberData?.role === 'admin' && clubData.creator_id !== user.id);
    }
  }

  async function handleLeave() {
    if (!user) return;
    Alert.alert(
      lang === 'sk' ? 'Odísť z klubu?' : 'Leave club?',
      lang === 'sk' ? 'Stratíš admin práva a prestaneš dostávať novinky z tohto klubu.' : 'You will lose admin rights and stop receiving updates.',
      [
        { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'sk' ? 'Odísť' : 'Leave', style: 'destructive',
          onPress: async () => {
            await supabase.from('club_members').delete().eq('club_id', id).eq('user_id', user.id);
            router.back();
          },
        },
      ]
    );
  }

  async function handleDelete() {
    if (!club) return;
    Alert.alert(
      lang === 'sk' ? `Vymazať klub?` : 'Delete club?',
      lang === 'sk'
        ? `Táto akcia je nevratná. Všetky eventy a rezervácie budú vymazané.`
        : 'This is irreversible. All events and bookings will be deleted.',
      [
        { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
        { text: lang === 'sk' ? 'Vymazať' : 'Delete', style: 'destructive', onPress: confirmDelete },
      ]
    );
  }

  async function confirmDelete() {
    if (!club) return;
    setDeleting(true);

    const { data: allEvents } = await supabase.from('events').select('id, title, date').eq('club_id', id);
    const allEventIds = (allEvents ?? []).map(e => e.id);

    if (allEventIds.length > 0) {
      const now = new Date().toISOString().slice(0, 10);
      const upcomingEvents = (allEvents ?? []).filter(e => e.date >= now);
      const upcomingIds = upcomingEvents.map(e => e.id);

      if (upcomingIds.length > 0) {
        const { data: attendees } = await supabase.from('event_attendees').select('user_id, event_id').in('event_id', upcomingIds);
        if (attendees && attendees.length > 0) {
          const eventTitles: Record<string, string> = {};
          upcomingEvents.forEach(e => { eventTitles[e.id] = e.title; });
          await supabase.from('notifications').insert(
            attendees.map(a => ({
              user_id: a.user_id,
              type: 'event_cancelled',
              title: `Klub bol vymazaný: ${club.name}`,
              body: `Tvoja rezervácia na "${eventTitles[a.event_id] ?? 'event'}" bola zrušená.`,
              data: { event_id: a.event_id },
              read: false,
            }))
          );
        }
      }

      await supabase.from('event_attendees').delete().in('event_id', allEventIds);
      await supabase.from('messages').delete().in('room_id', allEventIds);
      await supabase.from('events').delete().eq('club_id', id);
    }

    await supabase.from('club_members').delete().eq('club_id', id);
    await supabase.from('clubs').delete().eq('id', id);

    setDeleting(false);
    navigation.dispatch(StackActions.pop(2));
  }

  const ROWS = [
    isCreator && {
      icon: 'edit',
      label: lang === 'sk' ? 'Upraviť profil klubu' : 'Edit club profile',
      sub: lang === 'sk' ? 'Názov, popis, fotky' : 'Name, description, photos',
      onPress: () => router.push(`/club/${id}/edit` as any),
    },
    isCreator && {
      icon: 'users',
      label: lang === 'sk' ? 'Správca klubu' : 'Club admins',
      sub: lang === 'sk' ? 'Spravovať správcov' : 'Manage admins',
      onPress: () => router.push(`/club/${id}/members` as any),
    },
    {
      icon: 'bell',
      label: lang === 'sk' ? 'Notifikácie' : 'Notifications',
      sub: null,
      onPress: () => router.push('/settings/notifications' as any),
    },
    {
      icon: 'info',
      label: lang === 'sk' ? 'O aplikácii' : 'About',
      sub: null,
      onPress: () => router.push('/settings/about' as any),
    },
    {
      icon: 'mail',
      label: lang === 'sk' ? 'Kontaktovať podporu' : 'Contact support',
      sub: null,
      onPress: () => Linking.openURL('mailto:admin@woeva.com'),
    },
  ].filter(Boolean) as { icon: string; label: string; sub: string | null; onPress: () => void }[];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{lang === 'sk' ? 'Nastavenia klubu' : 'Club settings'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.list}>
            {ROWS.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}
                onPress={item.onPress}
                activeOpacity={0.6}
              >
                <View style={styles.rowIconWrap}>
                  <RowIcon name={item.icon} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                </View>
                <ChevronIcon />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isCoAdmin && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <View style={styles.list}>
              <TouchableOpacity style={styles.row} onPress={handleLeave} activeOpacity={0.6}>
                <View style={styles.rowIconWrap}>
                  <RowIcon name="leave" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: Colors.gray }]}>{lang === 'sk' ? 'Odísť z klubu' : 'Leave club'}</Text>
                  <Text style={styles.rowSub}>{lang === 'sk' ? 'Vzdáš sa admin práv' : 'You will lose admin rights'}</Text>
                </View>
                <ChevronIcon />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isCreator && (
          <View style={styles.deleteWrap}>
            {deleting
              ? <ActivityIndicator size="small" color={Colors.gray} />
              : (
                <TouchableOpacity onPress={handleDelete} activeOpacity={0.6}>
                  <Text style={styles.deleteText}>{lang === 'sk' ? 'Vymazať účet klubu' : 'Delete club'}</Text>
                </TouchableOpacity>
              )
            }
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  section: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  list: {},

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, backgroundColor: Colors.white },
  rowBorder: { borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  rowSub: { fontSize: 12, color: Colors.gray, marginTop: 1, fontFamily: Fonts.regular },

  deleteWrap: { marginTop: 32, alignItems: 'center' },
  deleteText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
});
