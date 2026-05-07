import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Club, ClubMember, Event } from '@/types';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/ui/EventCard';
import { Toast } from '@/components/ui/Toast';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

const COVER_HEIGHT = 260;
const AVATAR_SIZE = 30;
const AVATAR_OVERLAP = 10;

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslations();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => { loadAll(); }, [id, user])
  );

  async function loadAll() {
    const [{ data: clubData }, { data: membersData }, { data: eventsData }] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', id).single(),
      supabase.from('club_members').select('*, profile:profiles(name, avatar_url)').eq('club_id', id).eq('status', 'approved'),
      supabase.from('events').select('*, club:clubs(id, name, cover_url)').eq('club_id', id).order('date', { ascending: true }).limit(5),
    ]);
    setClub(clubData);
    setMembers(membersData ?? []);
    setEvents(eventsData ?? []);

    if (user) {
      const me = (membersData ?? []).find((m: ClubMember) => m.user_id === user.id);
      setIsMember(!!me);
      setIsAdmin(me?.role === 'admin');
    }
  }

  async function handleRemoveMember(m: ClubMember) {
    const name = (m as any).profile?.name ?? 'this member';
    Alert.alert(t.club.removeMember, t.club.removeMemberMsg(name, club?.name ?? ''), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.club.remove, style: 'destructive', onPress: async () => {
        await supabase.from('club_members').delete().eq('id', m.id);
        await supabase.from('clubs').update({ member_count: Math.max((club?.member_count ?? 1) - 1, 0) }).eq('id', id);
        setMembers(prev => prev.filter(x => x.id !== m.id));
        setClub(prev => prev ? { ...prev, member_count: Math.max((prev.member_count ?? 1) - 1, 0) } : prev);
      }},
    ]);
  }

  async function handleJoin() {
    if (!user) { router.push('/(auth)/login'); return; }
    setLoading(true);
    await supabase.from('club_members').insert({ club_id: id, user_id: user.id, role: 'member', status: 'approved' });
    await supabase.from('clubs').update({ member_count: (club?.member_count ?? 0) + 1 }).eq('id', id);
    setIsMember(true);
    setLoading(false);
    setToast(true);
    setTimeout(() => router.back(), 1400);
  }

  if (!club) return <View style={{ flex: 1, backgroundColor: Colors.white }} />;

  const initial = club.name.charAt(0).toUpperCase();
  const visibleMembers = members.slice(0, 4);
  const memberCount = members.length || club.member_count || 0;

  return (
    <View style={styles.container}>
      <Toast visible={toast} title={t.club.youreIn} subtitle={t.club.welcomeTo(club.name)} onHide={() => setToast(false)} />

      {/* Members modal */}
      <Modal visible={showMembersModal} animationType="slide" transparent onRequestClose={() => setShowMembersModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.membersSheet}>
            <View style={styles.membersSheetHandle} />
            <View style={styles.membersSheetHeader}>
              <Text style={styles.membersSheetTitle}>{t.club.membersCount(memberCount)}</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.membersSheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={members}
              keyExtractor={m => m.id}
              contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
              renderItem={({ item: m }) => {
                const prof = (m as any)?.profile;
                const firstName = (prof?.name ?? 'Member').split(' ')[0];
                const mi = firstName.charAt(0).toUpperCase();
                return (
                  <View style={styles.memberModalRow}>
                    <View style={styles.memberModalAv}>
                      {prof?.avatar_url
                        ? <Image source={{ uri: prof.avatar_url }} style={styles.memberModalAvImg} />
                        : <Text style={styles.memberModalAvInitial}>{mi}</Text>
                      }
                    </View>
                    <Text style={styles.memberModalName}>{firstName}</Text>
                    {m.role === 'admin' && (
                      <View style={styles.adminTag}><Text style={styles.adminTagText}>{t.club.adminRole}</Text></View>
                    )}
                    {isAdmin && m.user_id !== user?.id && (
                      <TouchableOpacity onPress={() => { setShowMembersModal(false); handleRemoveMember(m); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.removeText}>{t.club.remove}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover */}
        <View style={styles.cover}>
          {club.cover_url ? (
            <Image source={{ uri: club.cover_url }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImage, styles.coverFallback]} />
          )}
          <View style={styles.coverScrim} />

          <View style={[styles.backWrap, { top: insets.top + 8 }]}>
            <BackButton color={Colors.white} style={styles.backCircle} />
          </View>

          {isAdmin && (
            <TouchableOpacity
              style={[styles.adminBadge, { top: insets.top + 14 }]}
              onPress={() => router.push(`/club/${id}/edit` as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.adminText}>{t.club.editBadge}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.card}>

          {/* Logo — floats up over cover boundary */}
          <View style={styles.topRow}>
            <View style={styles.logoWrap}>
              {club.logo_url ? (
                <Image source={{ uri: club.logo_url }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Text style={styles.logoInitial}>{initial}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Club name + tagline + tags */}
          <Text style={styles.clubName}>{club.name}</Text>
          {club.tagline ? <Text style={styles.clubTagline}>{club.tagline}</Text> : null}
          {(club.category || club.city) ? (
            <View style={styles.tags}>
              {club.category ? <View style={styles.tag}><Text style={styles.tagText}>{club.category}</Text></View> : null}
              {club.city ? <View style={styles.tag}><Text style={styles.tagText}>{club.city}</Text></View> : null}
            </View>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{events.length}</Text>
              <Text style={styles.statLabel}>{t.club.events}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{memberCount}</Text>
              <Text style={styles.statLabel}>{t.club.members}</Text>
            </View>
            {(club.rating ?? 0) > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{club.rating?.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>{t.club.ratingLabel}</Text>
                </View>
              </>
            )}
          </View>

          {/* About */}
          {club.description ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t.club.aboutTitle}</Text>
              <Text style={styles.aboutText}>{club.description}</Text>
            </>
          ) : null}

          {/* Members bubbles */}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.membersBubbleRow} onPress={() => setShowMembersModal(true)} activeOpacity={0.8}>
            {members.slice(0, 6).map((m, i) => {
              const prof = (m as any)?.profile;
              const firstName = (prof?.name ?? '?').split(' ')[0];
              const mi = firstName.charAt(0).toUpperCase();
              return (
                <View key={m.id} style={[styles.memberBubble, { marginLeft: i === 0 ? 0 : -10, zIndex: 6 - i }]}>
                  {prof?.avatar_url
                    ? <Image source={{ uri: prof.avatar_url }} style={styles.memberBubbleImg} />
                    : <Text style={styles.memberBubbleInitial}>{mi}</Text>
                  }
                </View>
              );
            })}
            {memberCount > 6 && (
              <View style={[styles.memberBubble, styles.memberBubbleMore, { marginLeft: -10, zIndex: 0 }]}>
                <Text style={styles.memberBubbleMoreText}>+{memberCount - 6}</Text>
              </View>
            )}
            <Text style={styles.membersClickLabel}>{t.club.memberCount(memberCount)}</Text>
          </TouchableOpacity>

          {/* Admin: create event */}
          {isAdmin && (
            <>
              <View style={styles.divider} />
              <ManageRow
                icon="plus"
                label={t.club.createEventForClub}
                onPress={() => router.push('/event/create/step2')}
                last
              />
            </>
          )}

          {/* Events */}
          {events.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t.club.upcomingEvents}</Text>
              <View style={styles.eventsList}>
                {events.map((event, i) => (
                  <Animated.View key={event.id} entering={FadeInDown.delay(i * 60)}>
                    <EventCard event={event} />
                    {i < events.length - 1 && <View style={{ height: 10 }} />}
                  </Animated.View>
                ))}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {!isAdmin && !isMember && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={t.club.joinClub} onPress={handleJoin} loading={loading} variant="lime" />
        </View>
      )}
      {isMember && !isAdmin && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            label={t.club.joined}
            variant="lime"
            onPress={() => {
              Alert.alert(t.club.leaveClub, t.club.leaveClubMsg(club?.name ?? ''), [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.club.leaveBtn, style: 'destructive', onPress: async () => {
                  await supabase.from('club_members').delete().eq('club_id', id).eq('user_id', user!.id);
                  await supabase.from('clubs').update({ member_count: Math.max((club?.member_count ?? 1) - 1, 0) }).eq('id', id);
                  setIsMember(false);
                  router.back();
                }},
              ]);
            }}
          />
        </View>
      )}
    </View>
  );
}

function ManageRow({ icon, label, value, highlight, onPress, last }: {
  icon: 'users' | 'plus';
  label: string;
  value?: string;
  highlight?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[manageStyles.row, !last && manageStyles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={manageStyles.iconWrap}>
        {icon === 'users' && (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={9} cy={7} r={4} stroke={Colors.gray} strokeWidth={2} />
            <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
        {icon === 'plus' && (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        )}
      </View>
      <Text style={manageStyles.label}>{label}</Text>
      {value ? (
        <View style={[manageStyles.valuePill, highlight && manageStyles.valuePillHighlight]}>
          <Text style={[manageStyles.valueText, highlight && manageStyles.valueTextHighlight]}>{value}</Text>
        </View>
      ) : (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

const manageStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderColor: Colors.grayBorder },
  iconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.black, fontFamily: Fonts.medium },
  valuePill: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  valuePillHighlight: { backgroundColor: Colors.lime },
  valueText: { fontSize: 12, fontWeight: '600', color: Colors.gray },
  valueTextHighlight: { color: Colors.black },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Cover
  cover: { height: COVER_HEIGHT, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverFallback: { backgroundColor: '#000' },
  coverScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  backWrap: { position: 'absolute', left: 16 },
  backCircle: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20 },
  adminBadge: {
    position: 'absolute', right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  adminText: { fontSize: 12, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
  },

  // Logo + members top row — logo sticks out above card edge
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -40,
    marginBottom: 14,
  },
  logoWrap: {},
  logo: {
    width: 80,
    height: 80,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: Colors.white,
    overflow: 'hidden',
  },
  logoFallback: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 32, fontWeight: '800', color: Colors.white, fontFamily: Fonts.extrabold },

  // Members bubbles row
  membersBubbleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  memberBubble: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: Colors.white,
    backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  memberBubbleImg: { width: 36, height: 36, borderRadius: 18 },
  memberBubbleInitial: { fontSize: 13, fontWeight: '700', color: Colors.black },
  memberBubbleMore: { backgroundColor: Colors.grayLight },
  memberBubbleMoreText: { fontSize: 11, fontWeight: '700', color: Colors.gray },
  membersClickLabel: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, marginLeft: 12 },

  // Name + tagline below logo
  clubName: { fontSize: 24, fontWeight: '800', color: Colors.black, letterSpacing: -0.5, fontFamily: Fonts.extrabold, marginBottom: 4 },
  clubTagline: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 20, marginBottom: 10 },

  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 18 },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 2 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.grayBorder },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold },
  statLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },

  // Section
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },
  eventsList: {},

  // About
  aboutText: { fontSize: 14, color: '#555', fontFamily: Fonts.regular, lineHeight: 21, marginBottom: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight },
  tagText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.black, fontWeight: '500' },

  // Members modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  membersSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  membersSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  membersSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  membersSheetTitle: { fontSize: 17, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  membersSheetClose: { fontSize: 16, color: Colors.gray },
  memberModalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  memberModalAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberModalAvImg: { width: 44, height: 44, borderRadius: 22 },
  memberModalAvInitial: { fontSize: 17, fontWeight: '700', color: Colors.black },
  memberModalName: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.black, fontFamily: Fonts.medium },
  adminTag: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  adminTagText: { fontSize: 11, fontWeight: '700', color: Colors.black },
  removeText: { fontSize: 13, color: '#FF4444', fontWeight: '600', fontFamily: Fonts.semibold },

  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, backgroundColor: Colors.white },
});
