import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Share, ActivityIndicator, Modal, TextInput } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
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

  const [showAdminSearch, setShowAdminSearch] = useState(false);
  const [adminQuery, setAdminQuery] = useState('');
  const [adminResults, setAdminResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [sendingAdminInvite, setSendingAdminInvite] = useState<string | null>(null);

  const [showCoordSearch, setShowCoordSearch] = useState(false);
  const [coordQuery, setCoordQuery] = useState('');
  const [coordResults, setCoordResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [sendingCoordInvite, setSendingCoordInvite] = useState<string | null>(null);

  useEffect(() => { load(); }, [id, user]);
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));

  // Realtime: refresh when club_members or coordinators change
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`members_${id}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinators', filter: `club_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

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

  async function searchMembers(q: string, excludeIds: Set<string>, setResults: (r: { id: string; name: string; avatar_url: string | null }[]) => void) {
    if (q.trim().length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from('club_members')
      .select('user_id, profile:profiles(id, name, avatar_url)')
      .eq('club_id', id)
      .eq('status', 'approved');
    const filtered = ((data ?? []) as any[])
      .map((m: any) => m.profile)
      .filter((p: any) => p && !excludeIds.has(p.id) && p.name?.toLowerCase().includes(q.trim().toLowerCase()));
    setResults(filtered);
  }

  async function inviteAdminFromSearch(profileId: string, profileName: string) {
    if (!club || !user) return;
    setSendingAdminInvite(profileId);
    try {
      const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data } = await supabase.from('pending_invites').insert({
        club_id: id, role: 'admin', event_id: null,
        invited_by: user.id, club_name: club.name, inviter_name: myProfile?.name ?? '',
      }).select('token').single();
      if (!data?.token) throw new Error('no token');
      const title = `Pozvánka: ${club.name}`;
      const body = `${myProfile?.name ?? 'Niekto'} ťa pozýva spravovať klub ${club.name}.`;
      await supabase.from('notifications').insert({
        user_id: profileId, type: 'admin_invite', title, body,
        data: { token: data.token, club_id: id, action: 'admin_invite' },
      });
      const { data: inviteeProfile } = await supabase.from('profiles').select('push_token')
        .eq('id', profileId).or('notifications_enabled.is.null,notifications_enabled.eq.true').single();
      if (inviteeProfile?.push_token?.startsWith('ExponentPushToken[')) {
        await supabase.functions.invoke('send-push', {
          body: { tokens: [inviteeProfile.push_token], title, body, data: { club_id: id, type: 'admin_invite', action: 'admin_invite' } },
        });
      }
      setShowAdminSearch(false);
      setAdminQuery('');
      setAdminResults([]);
      Alert.alert(lang === 'sk' ? 'Pozvánka odoslaná' : 'Invite sent', `${profileName} ${lang === 'sk' ? 'dostal/a pozvánku správcu.' : 'received an admin invite.'}`);
    } catch {
      Alert.alert(lang === 'sk' ? 'Chyba' : 'Error', lang === 'sk' ? 'Pozvánku sa nepodarilo odoslať.' : 'Failed to send invite.');
    } finally {
      setSendingAdminInvite(null);
    }
  }

  async function inviteCoordFromSearch(profileId: string, profileName: string) {
    if (!club || !user) return;
    setSendingCoordInvite(profileId);
    try {
      const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data } = await supabase.from('pending_invites').insert({
        club_id: id, role: 'coordinator', event_id: null,
        invited_by: user.id, club_name: club.name, inviter_name: myProfile?.name ?? '',
      }).select('token').single();
      if (!data?.token) throw new Error('no token');
      const title = `Pozvánka koordinátora: ${club.name}`;
      const body = `${myProfile?.name ?? 'Niekto'} ťa pozýva ako koordinátora klubu ${club.name}.`;
      await supabase.from('notifications').insert({
        user_id: profileId, type: 'coordinator_invite', title, body,
        data: { token: data.token, club_id: id, action: 'coordinator_invite' },
      });
      const { data: inviteeProfile } = await supabase.from('profiles').select('push_token')
        .eq('id', profileId).or('notifications_enabled.is.null,notifications_enabled.eq.true').single();
      if (inviteeProfile?.push_token?.startsWith('ExponentPushToken[')) {
        await supabase.functions.invoke('send-push', {
          body: { tokens: [inviteeProfile.push_token], title, body, data: { club_id: id, type: 'coordinator_invite', action: 'coordinator_invite' } },
        });
      }
      setShowCoordSearch(false);
      setCoordQuery('');
      setCoordResults([]);
      Alert.alert(lang === 'sk' ? 'Pozvánka odoslaná' : 'Invite sent', `${profileName} ${lang === 'sk' ? 'dostal/a pozvánku koordinátora.' : 'received a coordinator invite.'}`);
    } catch {
      Alert.alert(lang === 'sk' ? 'Chyba' : 'Error', lang === 'sk' ? 'Pozvánku sa nepodarilo odoslať.' : 'Failed to send invite.');
    } finally {
      setSendingCoordInvite(null);
    }
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
    <View style={[st.container, { paddingTop: insets.top + 5 }]}>
      <View style={st.header}>
        <BackButton />
        <Text style={st.title}>{lang === 'sk' ? 'Vedenie klubu a správcovia' : 'Club leadership & admins'}</Text>
        <View style={{ width: 36 }} />
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
        <TouchableOpacity style={st.inviteBtn} onPress={() => Alert.alert(
          lang === 'sk' ? 'Pozvať správcu' : 'Invite admin', '',
          [
            { text: lang === 'sk' ? 'Hľadať v členoch' : 'Search members', onPress: () => setShowAdminSearch(true) },
            { text: lang === 'sk' ? 'Poslať odkaz' : 'Share link', onPress: shareAdminInvite },
            { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
          ]
        )} activeOpacity={0.7}>
          <Text style={st.inviteBtnText}>+ {lang === 'sk' ? 'Pozvať správcu' : 'Invite admin'}</Text>
          <ChevronIcon />
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

        <TouchableOpacity style={st.inviteBtn} onPress={() => Alert.alert(
          lang === 'sk' ? 'Pridať koordinátora' : 'Add coordinator', '',
          [
            { text: lang === 'sk' ? 'Hľadať v členoch' : 'Search members', onPress: () => setShowCoordSearch(true) },
            { text: lang === 'sk' ? 'Poslať odkaz' : 'Share link', onPress: shareCoordInvite },
            { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
          ]
        )} activeOpacity={0.7}>
          <Text style={st.inviteBtnText}>+ {lang === 'sk' ? 'Pridať koordinátora' : 'Add coordinator'}</Text>
          <ChevronIcon />
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

      {/* Admin search modal */}
      <Modal visible={showAdminSearch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowAdminSearch(false); setAdminQuery(''); setAdminResults([]); }}>
        <View style={[st.modal, { paddingTop: insets.top + 16 }]}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>{lang === 'sk' ? 'Hľadať správcu' : 'Search admin'}</Text>
            <TouchableOpacity onPress={() => { setShowAdminSearch(false); setAdminQuery(''); setAdminResults([]); }} hitSlop={12}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={Colors.black} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
          <TextInput
            style={st.searchInput}
            placeholder={lang === 'sk' ? 'Hľadať podľa mena...' : 'Search by name...'}
            placeholderTextColor={Colors.gray}
            value={adminQuery}
            onChangeText={q => { setAdminQuery(q); searchMembers(q, new Set(admins.map(a => a.user_id)), setAdminResults); }}
            autoFocus
            clearButtonMode="while-editing"
          />
          {adminResults.map(r => (
            <View key={r.id} style={st.searchRow}>
              <View style={[st.av, { flexShrink: 0 }]}>
                {r.avatar_url
                  ? <Image source={{ uri: r.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={20} />
                  : <Text style={st.avInitial}>{(r.name || '?').charAt(0).toUpperCase()}</Text>}
              </View>
              <Text style={[st.rowName, { flex: 1 }]}>{r.name}</Text>
              <TouchableOpacity style={st.inviteActionBtn} onPress={() => inviteAdminFromSearch(r.id, r.name)} disabled={sendingAdminInvite === r.id} activeOpacity={0.8}>
                {sendingAdminInvite === r.id
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={st.inviteActionBtnText}>{lang === 'sk' ? 'Pozvať' : 'Invite'}</Text>}
              </TouchableOpacity>
            </View>
          ))}
          {adminQuery.length >= 2 && adminResults.length === 0 && (
            <Text style={st.emptyText}>{lang === 'sk' ? 'Žiadni členovia nenájdení.' : 'No members found.'}</Text>
          )}
        </View>
      </Modal>

      {/* Coordinator search modal */}
      <Modal visible={showCoordSearch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCoordSearch(false); setCoordQuery(''); setCoordResults([]); }}>
        <View style={[st.modal, { paddingTop: insets.top + 16 }]}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>{lang === 'sk' ? 'Hľadať koordinátora' : 'Search coordinator'}</Text>
            <TouchableOpacity onPress={() => { setShowCoordSearch(false); setCoordQuery(''); setCoordResults([]); }} hitSlop={12}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={Colors.black} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
          <TextInput
            style={st.searchInput}
            placeholder={lang === 'sk' ? 'Hľadať podľa mena...' : 'Search by name...'}
            placeholderTextColor={Colors.gray}
            value={coordQuery}
            onChangeText={q => { setCoordQuery(q); searchMembers(q, new Set(coordinators.map(c => c.user_id)), setCoordResults); }}
            autoFocus
            clearButtonMode="while-editing"
          />
          {coordResults.map(r => (
            <View key={r.id} style={st.searchRow}>
              <View style={[st.av, { flexShrink: 0 }]}>
                {r.avatar_url
                  ? <Image source={{ uri: r.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={20} />
                  : <Text style={st.avInitial}>{(r.name || '?').charAt(0).toUpperCase()}</Text>}
              </View>
              <Text style={[st.rowName, { flex: 1 }]}>{r.name}</Text>
              <TouchableOpacity style={st.inviteActionBtn} onPress={() => inviteCoordFromSearch(r.id, r.name)} disabled={sendingCoordInvite === r.id} activeOpacity={0.8}>
                {sendingCoordInvite === r.id
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={st.inviteActionBtnText}>{lang === 'sk' ? 'Pozvať' : 'Invite'}</Text>}
              </TouchableOpacity>
            </View>
          ))}
          {coordQuery.length >= 2 && coordResults.length === 0 && (
            <Text style={st.emptyText}>{lang === 'sk' ? 'Žiadni členovia nenájdení.' : 'No members found.'}</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, position: 'absolute' as const, left: 0, right: 0, textAlign: 'center' as const },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4, fontFamily: Fonts.semibold },
  sectionDesc: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18, marginBottom: 14 },

  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 10 },

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

  modal: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  searchInput: { backgroundColor: Colors.grayLight, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: Colors.black, fontFamily: Fonts.regular, marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  inviteActionBtn: { backgroundColor: Colors.black, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  inviteActionBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },
});
