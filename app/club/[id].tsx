import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
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

const COVER_HEIGHT = 340;
const AVATAR_SIZE = 32;
const AVATAR_OVERLAP = 10;

const SAMPLE_AVATARS = [
  require('@/assets/images/sample_av1.jpg'),
  require('@/assets/images/sample_av2.jpg'),
  require('@/assets/images/sample_av3.jpg'),
  require('@/assets/images/sample_av4.jpg'),
];

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [joinRequests, setJoinRequests] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);

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
      const admin = me?.role === 'admin';
      setIsAdmin(admin);

      if (admin) {
        const { count } = await supabase
          .from('club_members')
          .select('*', { count: 'exact' })
          .eq('club_id', id)
          .eq('status', 'pending');
        setJoinRequests(count ?? 0);
      }
    }
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

  const visibleMembers = members.slice(0, 4);
  const overflowMembers = (club.member_count ?? members.length) - visibleMembers.length;

  return (
    <View style={styles.container}>
      <Toast visible={toast} title="You're in!" subtitle={`Welcome to ${club.name}`} onHide={() => setToast(false)} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover ── */}
        <View style={styles.cover}>
          {club.cover_url ? (
            <Image source={{ uri: club.cover_url }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: '#111' }]} />
          )}

          {/* Dark scrim */}
          <View style={styles.coverScrim} />

          <View style={[styles.backWrap, { top: insets.top + 8 }]}>
            <BackButton color={Colors.white} style={styles.backCircle} />
          </View>

          {isAdmin && (
            <View style={[styles.adminBadge, { top: insets.top + 14 }]}>
              <Text style={styles.adminText}>ADMIN</Text>
            </View>
          )}

          <View style={styles.coverContent}>
            <Animated.View entering={FadeInUp.delay(80).springify()}>
              {club.category ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>{club.category.toUpperCase()}</Text>
                </View>
              ) : null}
              <Text style={styles.coverTitle}>{club.name}</Text>
              {club.tagline ? (
                <Text style={styles.coverTagline} numberOfLines={2}>{club.tagline}</Text>
              ) : null}
            </Animated.View>
          </View>
        </View>

        {/* ── White card ── */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.card}>

          {/* Members row */}
          <View style={styles.membersRow}>
            <View style={styles.avatarStack}>
              {Array.from({ length: 3 }).map((_, i) => {
                const m = visibleMembers[i];
                const profile = (m as any)?.profile;
                return (
                  <View key={i} style={[styles.memberAvatar, { marginLeft: i === 0 ? 0 : -AVATAR_OVERLAP, zIndex: 3 - i }]}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.memberAvatarImg} />
                    ) : (
                      <Image source={SAMPLE_AVATARS[i % SAMPLE_AVATARS.length]} style={styles.memberAvatarImg} />
                    )}
                  </View>
                );
              })}
              {overflowMembers > 0 && (
                <View style={[styles.memberAvatar, styles.memberAvatarOverflow, { marginLeft: -AVATAR_OVERLAP }]}>
                  <Text style={styles.memberAvatarOverflowText}>+{overflowMembers}</Text>
                </View>
              )}
            </View>
            <Text style={styles.membersLabel}><Text style={styles.membersCount}>{members.length || club.member_count || 0}</Text> members</Text>
            {(club.rating ?? 0) > 0 && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>★ {club.rating?.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{events.length}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{members.length || club.member_count || 0}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{(club.rating ?? 0) > 0 ? club.rating?.toFixed(1) : '—'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>

          {/* Admin manage */}
          {isAdmin && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Manage</Text>
              <View style={styles.manageList}>
                <ManageRow
                  icon="users"
                  label="Members"
                  value={`${club.member_count}`}
                  onPress={() => router.push(`/club/${id}/members` as any)}
                />
                <ManageRow
                  icon="inbox"
                  label="Join requests"
                  value={joinRequests > 0 ? `${joinRequests} new` : undefined}
                  highlight={joinRequests > 0}
                  onPress={() => router.push(`/club/${id}/members` as any)}
                />
                <ManageRow
                  icon="plus"
                  label="Create event"
                  onPress={() => router.push('/event/create/step1')}
                  last
                />
              </View>
            </>
          )}

          {/* Member: notifications toggle */}
          {isMember && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.notifRow}
                activeOpacity={0.8}
                onPress={() => setNotificationsOn(v => !v)}
              >
                <View style={styles.notifIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View style={styles.notifText}>
                  <Text style={styles.notifLabel}>Event notifications</Text>
                  <Text style={styles.notifSub}>Get notified when this club posts a new event</Text>
                </View>
                <View style={[styles.toggle, notificationsOn && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, notificationsOn && styles.toggleThumbOn]} />
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Events */}
          {events.length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Upcoming events</Text>
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
          <Button label="Join club" onPress={handleJoin} loading={loading} variant="lime" />
        </View>
      )}
      {isMember && !isAdmin && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            label="You're a member ✓"
            variant="lime"
            onPress={() => {
              Alert.alert('Leave club', `Leave ${club?.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: async () => {
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
  icon: 'users' | 'inbox' | 'plus';
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
        {icon === 'inbox' && (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path d="M22 12h-6l-2 3h-4l-2-3H2" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

  cover: { height: COVER_HEIGHT, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  backWrap: { position: 'absolute', left: 16 },
  backCircle: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20 },
  adminBadge: {
    position: 'absolute', right: 16,
    backgroundColor: Colors.black, borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  adminText: { fontSize: 11, fontWeight: '700', color: Colors.white, letterSpacing: 0.8 },

  coverContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 60,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  categoryPill: {
    alignSelf: 'flex-start', backgroundColor: Colors.lime,
    borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  categoryPillText: { fontSize: 10, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  coverTitle: { fontSize: 30, fontWeight: '800', color: Colors.white, letterSpacing: -0.5, marginBottom: 6, fontFamily: Fonts.extrabold },
  coverTagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontFamily: Fonts.regular, lineHeight: 20 },

  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },

  // Members row
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 2, borderColor: Colors.white },
  memberAvatarImg: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  memberAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  memberAvatarInitial: { fontSize: 12, fontWeight: '700', color: Colors.black },
  memberAvatarOverflow: { backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  memberAvatarOverflowText: { fontSize: 10, fontWeight: '700', color: Colors.gray },
  membersLabel: { flex: 1, fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  membersCount: { fontSize: 14, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  ratingBadge: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5 },
  ratingText: { fontSize: 13, fontWeight: '700', color: Colors.black },

  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 20 },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.grayBorder },
  statNum: { fontSize: 22, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold },
  statLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },

  // Section title
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  manageList: {},
  eventsList: {},

  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, backgroundColor: Colors.white },

  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.grayLight, borderRadius: 16, padding: 14,
  },
  notifIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  notifText: { flex: 1 },
  notifLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  notifSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
