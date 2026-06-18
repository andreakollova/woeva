import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking, ActivityIndicator, Image, TextInput } from 'react-native';
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
  const [admins, setAdmins] = useState<{ user_id: string; name: string; avatar_url: string | null }[]>([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [notifChat, setNotifChat] = useState(profile?.notif_chat ?? true);

  useEffect(() => { load(); }, [id, user]);

  async function load() {
    const [{ data: clubData }, { data: memberData }, { data: adminData }] = await Promise.all([
      supabase.from('clubs').select('id, name, creator_id').eq('id', id).single(),
      user
        ? supabase.from('club_members').select('role').eq('club_id', id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('club_members').select('user_id, profile:profiles(name, avatar_url)').eq('club_id', id).eq('role', 'admin').eq('status', 'approved'),
    ]);
    setClub(clubData ?? null);
    setAdmins(((adminData ?? []) as any[]).map(m => ({ user_id: m.user_id, name: m.profile?.name ?? '', avatar_url: m.profile?.avatar_url ?? null })));
    if (user && clubData) {
      setIsCreator(clubData.creator_id === user.id);
      setIsCoAdmin(memberData?.role === 'admin' && clubData.creator_id !== user.id);
    }
  }

  async function searchInvite(q: string) {
    setInviteQuery(q);
    if (q.trim().length < 2) { setInviteResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, name, avatar_url, email').or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`).neq('id', user!.id).limit(6);
    const existingIds = new Set(admins.map(a => a.user_id));
    setInviteResults(((data ?? []) as any[]).filter(r => !existingIds.has(r.id)));
  }

  async function inviteAdmin(profileId: string, profileName: string) {
    if (!club) return;
    await supabase.from('club_members').upsert({ club_id: id, user_id: profileId, role: 'admin', status: 'pending' }, { onConflict: 'club_id,user_id' });
    await supabase.from('notifications').insert({ user_id: profileId, type: 'admin_invite', title: `Pozvánka: ${club.name}`, body: `Bol/a si pozvaný/á spravovať klub ${club.name}.`, data: { club_id: id, action: 'admin_invite' } });
    setShowInvite(false);
    setInviteQuery('');
    setInviteResults([]);
    Alert.alert(lang === 'sk' ? 'Pozvánka odoslaná' : 'Invite sent', `${profileName}`);
  }

  async function removeAdmin(adminUserId: string) {
    Alert.alert(lang === 'sk' ? 'Odstrániť správcu?' : 'Remove admin?', '', [
      { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
      { text: lang === 'sk' ? 'Odstrániť' : 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('club_members').update({ role: 'member' }).eq('club_id', id).eq('user_id', adminUserId);
        setAdmins(prev => prev.filter(a => a.user_id !== adminUserId));
      }},
    ]);
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
    (isCreator || isCoAdmin) && {
      icon: 'edit',
      label: lang === 'sk' ? 'Upraviť profil klubu' : 'Edit club profile',
      sub: lang === 'sk' ? 'Názov, popis, fotky' : 'Name, description, photos',
      onPress: () => router.push(`/club/${id}/edit` as any),
    },
    (isCreator || isCoAdmin) && {
      icon: 'users',
      label: lang === 'sk' ? 'Správca klubu' : 'Club admins',
      sub: lang === 'sk' ? 'Spravovať správcov' : 'Manage admins',
      onPress: () => router.push(`/club/${id}/members` as any),
    },
    {
      icon: 'bell',
      label: lang === 'sk' ? 'Všetky notifikácie' : 'All notifications',
      sub: lang === 'sk' ? 'Nastavenia push notifikácií' : 'Push notification settings',
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
        {/* Admins section */}
        {(isCreator || isCoAdmin) && (
          <View style={[styles.section, { marginBottom: 16 }]}>
            <Text style={styles.sectionLabel}>{lang === 'sk' ? 'SPRÁVCOVIA' : 'ADMINS'}</Text>
            <View style={styles.list}>
              {admins.map((a, i) => (
                <View key={a.user_id} style={[styles.adminRow, i < admins.length - 1 && styles.rowBorder]}>
                  <View style={styles.adminAvatar}>
                    {a.avatar_url ? <Image source={{ uri: a.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={20} /> : null}
                    {!a.avatar_url && <Text style={styles.adminInitial}>{(a.name || '?').charAt(0).toUpperCase()}</Text>}
                  </View>
                  <Text style={[styles.rowLabel, { flex: 1 }]}>{a.name.split(' ')[0]}</Text>
                  {a.user_id === club?.creator_id
                    ? <Text style={styles.ownerBadge}>{lang === 'sk' ? 'Vlastník' : 'Owner'}</Text>
                    : <TouchableOpacity onPress={() => removeAdmin(a.user_id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.removeText}>{lang === 'sk' ? 'Odstrániť' : 'Remove'}</Text>
                      </TouchableOpacity>
                  }
                </View>
              ))}
              <TouchableOpacity style={[styles.row, admins.length > 0 && styles.rowBorder]} onPress={() => setShowInvite(v => !v)} activeOpacity={0.7}>
                <Text style={[styles.rowLabel, { color: Colors.black }]}>+ {lang === 'sk' ? 'Pozvať správcu' : 'Invite admin'}</Text>
              </TouchableOpacity>
              {showInvite && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <TextInput
                    style={styles.inviteInput}
                    value={inviteQuery}
                    onChangeText={searchInvite}
                    placeholder={lang === 'sk' ? 'Hľadaj podľa mena...' : 'Search by name...'}
                    placeholderTextColor={Colors.gray}
                    autoFocus
                  />
                  {inviteResults.map(r => (
                    <TouchableOpacity key={r.id} style={styles.inviteResult} onPress={() => inviteAdmin(r.id, r.name)}>
                      <Text style={styles.rowLabel}>{r.name}</Text>
                      <Text style={styles.rowSub}>+ {lang === 'sk' ? 'Pozvať' : 'Invite'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <Text style={styles.ownerNote}>{lang === 'sk' ? 'Zmena vlastníka klubu nie je možná. Chceš nový klub? Založ si ho.' : 'Transferring club ownership is not possible. Want a new club? Create one.'}</Text>
          </View>
        )}

        {/* Notification toggles */}
        <View style={[styles.section, { marginBottom: 16 }]}>
          <Text style={styles.sectionLabel}>{lang === 'sk' ? 'MOJE NOTIFIKÁCIE' : 'MY NOTIFICATIONS'}</Text>
          <View style={styles.list}>
            <View style={[styles.toggleRow, styles.rowBorder]}>
              <Text style={styles.rowLabel}>{lang === 'sk' ? 'Nové správy v chate' : 'New chat messages'}</Text>
              <TouchableOpacity
                style={[styles.toggle, notifChat && styles.toggleOn]}
                onPress={() => {
                  const next = !notifChat;
                  setNotifChat(next);
                  if (user) supabase.from('profiles').update({ notif_chat: next }).eq('id', user.id);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, notifChat && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.rowLabel}>{lang === 'sk' ? 'Notifikácie' : 'All notifications'}</Text>
              <ChevronIcon />
            </View>
          </View>
        </View>

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

        {(isCreator || isCoAdmin) && (
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

  sectionLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, letterSpacing: 0.5, marginBottom: 8, fontFamily: Fonts.semibold },
  adminRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: Colors.white },
  adminAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  adminInitial: { fontSize: 14, fontWeight: '600', color: Colors.gray },
  ownerBadge: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  removeText: { fontSize: 13, color: '#FF3B30', fontFamily: Fonts.regular },
  inviteInput: { height: 40, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: Colors.black, marginBottom: 8 },
  inviteResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderColor: Colors.grayBorder },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
  ownerNote: { fontSize: 12, color: Colors.gray, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
});
