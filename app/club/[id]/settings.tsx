import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import { notify } from '@/lib/notify';

export default function ClubSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t, lang } = useTranslations();

  const [club, setClub] = useState<{ id: string; name: string; creator_id: string } | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isCoAdmin, setIsCoAdmin] = useState(false);

  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; name: string; avatar_url: string | null; email?: string }[]>([]);
  const [inviting, setInviting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    load();
  }, [id, user]);

  async function load() {
    const [{ data: clubData }, { data: memberData }] = await Promise.all([
      supabase.from('clubs').select('id, name, creator_id').eq('id', id).single(),
      user ? supabase.from('club_members').select('role').eq('club_id', id).eq('user_id', user.id).eq('status', 'approved').maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setClub(clubData ?? null);
    if (user && clubData) {
      setIsCreator(clubData.creator_id === user.id);
      setIsCoAdmin(memberData?.role === 'admin' && clubData.creator_id !== user.id);
    }
  }

  async function searchInvite(q: string) {
    setInviteQuery(q);
    if (q.length < 2) { setInviteResults([]); return; }
    setSearchLoading(true);
    const { data: members } = await supabase.from('club_members').select('user_id').eq('club_id', id).eq('role', 'admin');
    const adminIds = new Set((members ?? []).map((m: any) => m.user_id));
    const { data } = await supabase.from('profiles').select('id, name, avatar_url, email').or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(10);
    setInviteResults(((data ?? []) as any[]).filter(r => !adminIds.has(r.id) && r.id !== user?.id));
    setSearchLoading(false);
  }

  async function handleInvite(profileId: string, profileName: string) {
    if (!club) return;
    Alert.alert(
      t.club.confirmInvite(profileName),
      t.club.confirmInviteMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.club.sendInvite,
          onPress: async () => {
            setInviting(true);
            await supabase.from('club_members').upsert(
              { club_id: id, user_id: profileId, role: 'admin', status: 'pending' },
              { onConflict: 'club_id,user_id' }
            );
            await supabase.from('notifications').insert({
              user_id: profileId, type: 'admin_invite',
              title: `Pozvánka: ${club.name}`,
              body: `Bol/a si pozvaný/á spravovať klub ${club.name}. Klepni pre prijatie alebo odmietnutie.`,
              data: { club_id: id, action: 'admin_invite' },
            });
            notify.adminInvite({
              inviteeId: profileId,
              inviteeName: profileName,
              inviterName: profile?.name ?? user?.email ?? 'Someone',
              clubName: club.name,
              clubId: id,
            });
            setInviting(false);
            setInviteQuery('');
            setInviteResults([]);
            Alert.alert(t.club.inviteSent, t.club.inviteSentMsg(profileName));
          },
        },
      ]
    );
  }

  async function handleLeave() {
    if (!user) return;
    Alert.alert(
      lang === 'sk' ? 'Odísť z klubu?' : 'Leave club?',
      lang === 'sk' ? 'Stratíš admin práva a prestaneš dostávať novinky z tohto klubu.' : 'You will lose admin rights and stop receiving updates.',
      [
        { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
        { text: lang === 'sk' ? 'Odísť' : 'Leave', style: 'destructive', onPress: async () => {
          await supabase.from('club_members').delete().eq('club_id', id).eq('user_id', user.id);
          router.back();
        }},
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.club.clubSettings}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">

        {isCreator && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/club/${id}/edit` as any)} activeOpacity={0.7}>
              <View style={styles.rowIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t.club.editClub}</Text>
                <Text style={styles.rowSub}>{t.club.editClubDetails}</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        )}

        {isCreator && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t.club.inviteAdmin.toUpperCase()}</Text>
            <View style={styles.searchBox}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                <Circle cx="11" cy="11" r="8" stroke={Colors.gray} strokeWidth={1.8} />
                <Path d="M21 21l-4.35-4.35" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
              <TextInput
                style={styles.searchInput}
                value={inviteQuery}
                onChangeText={searchInvite}
                placeholder={t.club.inviteEmailPlaceholder}
                placeholderTextColor={Colors.gray}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {searchLoading && <ActivityIndicator size="small" color={Colors.gray} style={{ marginLeft: 8 }} />}
            </View>

            {inviteResults.map((r, i) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.row, i < inviteResults.length - 1 && styles.rowBorder]}
                onPress={() => handleInvite(r.id, r.name)}
                activeOpacity={0.7}
                disabled={inviting}
              >
                <View style={styles.avatar}>
                  {r.avatar_url
                    ? <Image source={{ uri: r.avatar_url }} style={StyleSheet.absoluteFillObject as any} />
                    : <Text style={styles.avatarInitial}>{r.name.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{r.name.split(' ')[0]}</Text>
                  {r.email && <Text style={styles.rowSub}>{r.email}</Text>}
                </View>
                <Text style={styles.addArrow}>{t.club.addArrow}</Text>
              </TouchableOpacity>
            ))}

            {inviteQuery.length >= 2 && inviteResults.length === 0 && !searchLoading && (
              <Text style={styles.noResults}>{t.club.notFound}</Text>
            )}
          </View>
        )}

        {isCoAdmin && (
          <View style={[styles.section, { marginTop: 24 }]}>
            <TouchableOpacity style={styles.row} onPress={handleLeave} activeOpacity={0.7}>
              <View style={styles.rowIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M16 17l5-5-5-5M21 12H9" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: '#EF4444' }]}>{lang === 'sk' ? 'Odísť z klubu' : 'Leave club'}</Text>
                <Text style={styles.rowSub}>{lang === 'sk' ? 'Vzdáš sa admin práv' : 'You will lose admin rights'}</Text>
              </View>
            </TouchableOpacity>
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

  section: { marginHorizontal: 20, marginTop: 20, borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, fontFamily: Fonts.semibold },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, backgroundColor: Colors.white },
  rowBorder: { borderBottomWidth: 1, borderColor: Colors.grayBorder },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  rowSub: { fontSize: 12, color: Colors.gray, marginTop: 1, fontFamily: Fonts.regular },

  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.black, fontFamily: Fonts.regular },

  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.grayBorder, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: Colors.black },
  addArrow: { fontSize: 14, color: Colors.gray },
  noResults: { fontSize: 14, color: Colors.gray, paddingHorizontal: 16, paddingBottom: 14 },
});
