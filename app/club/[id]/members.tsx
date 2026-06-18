import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { ClubMember } from '@/types';
import { useTranslations } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type AdminRow = { user_id: string; name: string; avatar_url: string | null };
type CoordRow = { id: string; user_id: string; event_id: string | null; name: string; avatar_url: string | null; event_title: string | null };

export default function ClubMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, lang } = useTranslations();

  const [club, setClub] = useState<{ id: string; name: string; creator_id: string } | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [coordinators, setCoordinators] = useState<CoordRow[]>([]);
  const [approved, setApproved] = useState<ClubMember[]>([]);
  const [pending, setPending] = useState<ClubMember[]>([]);
  const [tab, setTab] = useState<'members' | 'requests'>('members');
  const [sharingAdmin, setSharingAdmin] = useState(false);
  const [sharingCoord, setSharingCoord] = useState(false);

  useEffect(() => { load(); }, [id, user]);

  async function load() {
    const [{ data: clubData }, { data: adminData }, { data: coordData }, { data: allMembers }] = await Promise.all([
      supabase.from('clubs').select('id, name, creator_id').eq('id', id).single(),
      supabase.from('club_members').select('user_id, profile:profiles(name, avatar_url)').eq('club_id', id).eq('role', 'admin').eq('status', 'approved'),
      supabase.from('coordinators').select('id, user_id, event_id, profile:profiles(name, avatar_url), event:events(title)').eq('club_id', id).eq('status', 'active'),
      supabase.from('club_members').select('*, profile:profiles(*)').eq('club_id', id).order('joined_at', { ascending: false }),
    ]);

    setClub(clubData ?? null);
    setAdmins(((adminData ?? []) as any[]).map(m => ({ user_id: m.user_id, name: m.profile?.name ?? '', avatar_url: m.profile?.avatar_url ?? null })));
    setCoordinators(((coordData ?? []) as any[]).map(c => ({ id: c.id, user_id: c.user_id, event_id: c.event_id ?? null, name: c.profile?.name ?? '', avatar_url: c.profile?.avatar_url ?? null, event_title: c.event?.title ?? null })));
    const all = (allMembers ?? []) as ClubMember[];
    setApproved(all.filter(m => m.status === 'approved'));
    setPending(all.filter(m => m.status === 'pending'));
  }

  async function shareAdminInvite() {
    if (!club || !user) return;
    setSharingAdmin(true);
    try {
      const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data } = await supabase.from('pending_invites').insert({
        club_id: id, role: 'admin', event_id: null,
        invited_by: user.id, club_name: club.name, inviter_name: myProfile?.name ?? '',
      }).select('token').single();
      if (!data?.token) throw new Error('no token');
      const url = `https://woeva.com/invite?token=${data.token}`;
      await Share.share({
        message: lang === 'sk'
          ? `${myProfile?.name ?? 'Niekto'} ťa pozýva spravovať klub "${club.name}" vo Woeva. Prijmi pozvánku: ${url}`
          : `${myProfile?.name ?? 'Someone'} invited you to manage club "${club.name}" on Woeva: ${url}`,
        url,
      });
    } catch {
      Alert.alert(lang === 'sk' ? 'Chyba' : 'Error', lang === 'sk' ? 'Nepodarilo sa vytvoriť pozvánku.' : 'Failed to create invite.');
    } finally { setSharingAdmin(false); }
  }

  async function shareCoordInvite() {
    if (!club || !user) return;
    setSharingCoord(true);
    try {
      const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data } = await supabase.from('pending_invites').insert({
        club_id: id, role: 'coordinator', event_id: null,
        invited_by: user.id, club_name: club.name, inviter_name: myProfile?.name ?? '',
      }).select('token').single();
      if (!data?.token) throw new Error('no token');
      const url = `https://woeva.com/invite?token=${data.token}`;
      await Share.share({
        message: lang === 'sk'
          ? `${myProfile?.name ?? 'Niekto'} ťa pozýva ako koordinátora pre klub "${club.name}" vo Woeva. Prijmi pozvánku: ${url}`
          : `${myProfile?.name ?? 'Someone'} invited you as a coordinator for "${club.name}" on Woeva: ${url}`,
        url,
      });
    } catch {
      Alert.alert(lang === 'sk' ? 'Chyba' : 'Error', lang === 'sk' ? 'Nepodarilo sa vytvoriť pozvánku.' : 'Failed to create invite.');
    } finally { setSharingCoord(false); }
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

  async function removeCoordinator(coordId: string) {
    Alert.alert(lang === 'sk' ? 'Odstrániť koordinátora?' : 'Remove coordinator?', '', [
      { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
      { text: lang === 'sk' ? 'Odstrániť' : 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('coordinators').update({ status: 'removed' }).eq('id', coordId);
        setCoordinators(prev => prev.filter(c => c.id !== coordId));
      }},
    ]);
  }

  async function approveMember(memberId: string) {
    await supabase.from('club_members').update({ status: 'approved' }).eq('id', memberId);
    load();
  }

  async function rejectMember(memberId: string) {
    Alert.alert(t.club.removeRequest, t.club.declineRequest, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.club.decline, style: 'destructive', onPress: async () => {
        await supabase.from('club_members').delete().eq('id', memberId);
        load();
      }},
    ]);
  }

  async function removeMember(memberId: string, name: string) {
    Alert.alert(t.club.removeMember, t.club.removeMemberSimple(name), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.club.remove, style: 'destructive', onPress: async () => {
        await supabase.from('club_members').delete().eq('id', memberId);
        load();
      }},
    ]);
  }

  const list = tab === 'members' ? approved : pending;
  const isCreator = !!user && club?.creator_id === user.id;

  function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
    const initial = (name || '?').charAt(0).toUpperCase();
    return (
      <View style={st.av}>
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill as any} borderRadius={20} />
          : <Text style={st.avInitial}>{initial}</Text>}
      </View>
    );
  }

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <BackButton />
        <Text style={st.title}>{lang === 'sk' ? 'Vedenie klubu a správcovia' : 'Club leadership & admins'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── SPRÁVCOVIA ── */}
        <Text style={st.sectionLabel}>{lang === 'sk' ? 'SPRÁVCOVIA' : 'ADMINS'}</Text>
        <Text style={st.sectionDesc}>
          {lang === 'sk'
            ? 'Správcovia môžu vytvárať eventy, spravovať členov a meniť nastavenia klubu.'
            : 'Admins can create events, manage members and change club settings.'}
        </Text>

        {/* Owner row */}
        {admins.filter(a => a.user_id === club?.creator_id).map(a => (
          <View key={a.user_id} style={[st.row, { marginBottom: 2 }]}>
            <Avatar name={a.name} avatarUrl={a.avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={st.rowName}>{a.name.split(' ')[0]}{a.user_id === user?.id ? (lang === 'sk' ? ' (ty)' : ' (you)') : ''}</Text>
            </View>
            <View style={st.ownerPill}><Text style={st.ownerPillText}>{lang === 'sk' ? 'Vlastník' : 'Owner'}</Text></View>
          </View>
        ))}

        {/* Co-admins */}
        {admins.filter(a => a.user_id !== club?.creator_id).map(a => (
          <View key={a.user_id} style={[st.row, { marginBottom: 2 }]}>
            <Avatar name={a.name} avatarUrl={a.avatar_url} />
            <Text style={[st.rowName, { flex: 1 }]}>{a.name.split(' ')[0]}</Text>
            {isCreator && (
              <TouchableOpacity onPress={() => removeAdmin(a.user_id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={st.removeText}>{lang === 'sk' ? 'Odstrániť' : 'Remove'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Invite admin button */}
        <TouchableOpacity style={st.inviteBtn} onPress={shareAdminInvite} disabled={sharingAdmin} activeOpacity={0.7}>
          {sharingAdmin
            ? <ActivityIndicator size="small" color={Colors.gray} />
            : <>
                <Text style={st.inviteBtnText}>+ {lang === 'sk' ? 'Pozvať správcu' : 'Invite admin'}</Text>
                <ChevronIcon />
              </>
          }
        </TouchableOpacity>

        <View style={st.divider} />

        {/* ── KOORDINÁTORI ── */}
        <Text style={st.sectionLabel}>{lang === 'sk' ? 'KOORDINÁTORI' : 'COORDINATORS'}</Text>
        <Text style={st.sectionDesc}>
          {lang === 'sk'
            ? 'Koordinátori môžu iba skenovať QR kódy a potvrdzovať vstupy na eventy.'
            : 'Coordinators can only scan QR codes and confirm entry at events.'}
        </Text>

        {coordinators.length === 0 && (
          <Text style={st.emptyText}>{lang === 'sk' ? 'Zatiaľ žiadni koordinátori.' : 'No coordinators yet.'}</Text>
        )}
        {coordinators.map(c => (
          <View key={c.id} style={[st.row, { marginBottom: 2 }]}>
            <Avatar name={c.name} avatarUrl={c.avatar_url} />
            <View style={{ flex: 1 }}>
              <Text style={st.rowName}>{c.name.split(' ')[0]}</Text>
              <Text style={st.rowSub}>{c.event_title ?? (lang === 'sk' ? 'Všetky eventy' : 'All events')}</Text>
            </View>
            <TouchableOpacity onPress={() => removeCoordinator(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={st.removeText}>{lang === 'sk' ? 'Odstrániť' : 'Remove'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={st.inviteBtn} onPress={shareCoordInvite} disabled={sharingCoord} activeOpacity={0.7}>
          {sharingCoord
            ? <ActivityIndicator size="small" color={Colors.gray} />
            : <>
                <Text style={st.inviteBtnText}>+ {lang === 'sk' ? 'Pridať koordinátora' : 'Add coordinator'}</Text>
                <ChevronIcon />
              </>
          }
        </TouchableOpacity>

        <View style={st.divider} />

        {/* ── ČLENOVIA ── */}
        <Text style={st.sectionLabel}>{lang === 'sk' ? 'ČLENOVIA' : 'MEMBERS'}</Text>

        <View style={st.tabs}>
          <TouchableOpacity style={[st.tabBtn, tab === 'members' && st.tabActive]} onPress={() => setTab('members')}>
            <Text style={[st.tabText, tab === 'members' && st.tabTextActive]}>{t.club.membersTab(approved.length)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.tabBtn, tab === 'requests' && st.tabActive]} onPress={() => setTab('requests')}>
            <Text style={[st.tabText, tab === 'requests' && st.tabTextActive]}>
              {pending.length > 0 ? t.club.requestsTabCount(pending.length) : t.club.requestsTab}
            </Text>
            {pending.length > 0 && <View style={st.badge} />}
          </TouchableOpacity>
        </View>

        {list.length === 0 && (
          <Text style={st.emptyText}>{tab === 'members' ? t.club.noMembersYet : t.club.noPendingRequests}</Text>
        )}
        {list.map(member => {
          const profile = member.profile as any;
          const name = (profile?.name ?? 'Unknown').split(' ')[0];
          const initial = name.charAt(0).toUpperCase();
          return (
            <View key={member.id} style={[st.row, { marginBottom: 2 }]}>
              <View style={[st.av, { backgroundColor: Colors.lime }]}>
                {profile?.avatar_url
                  ? <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={20} />
                  : <Text style={st.avInitial}>{initial}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.rowName}>{name}</Text>
                {member.role === 'admin' && <Text style={st.rowSub}>{t.club.adminRole}</Text>}
              </View>
              {tab === 'requests' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={st.approveBtn} onPress={() => approveMember(member.id)}>
                    <Text style={st.approveBtnText}>{t.club.accept}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.rejectBtn} onPress={() => rejectMember(member.id)}>
                    <Text style={st.rejectBtnText}>{t.club.decline}</Text>
                  </TouchableOpacity>
                </View>
              ) : member.role !== 'admin' ? (
                <TouchableOpacity onPress={() => removeMember(member.id, name)}>
                  <Text style={st.removeText}>{t.club.remove}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, flex: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4, fontFamily: Fonts.semibold },
  sectionDesc: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18, marginBottom: 14 },

  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 20 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avInitial: { fontSize: 15, fontWeight: '600', color: Colors.gray },
  rowName: { fontSize: 15, fontWeight: '500', color: Colors.black, fontFamily: Fonts.medium },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  removeText: { fontSize: 13, color: '#FF3B30', fontFamily: Fonts.regular },
  ownerPill: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  ownerPillText: { fontSize: 11, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },

  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderColor: Colors.grayBorder, marginTop: 6 },
  inviteBtnText: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },

  emptyText: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, paddingVertical: 8 },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, backgroundColor: Colors.grayLight, gap: 5 },
  tabActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 13, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.white },
  badge: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.lime },

  approveBtn: { backgroundColor: Colors.lime, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  approveBtnText: { fontSize: 12, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rejectBtn: { backgroundColor: Colors.grayLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  rejectBtnText: { fontSize: 12, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
});
