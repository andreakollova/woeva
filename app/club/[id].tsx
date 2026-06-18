import React, { useEffect, useState, useRef } from 'react';
import { setStatusBarStyle } from 'expo-status-bar';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, FlatList, Pressable, Share, TextInput, Animated as RNAnimated, PanResponder } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
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
import { notify } from '@/lib/notify';

const COVER_HEIGHT = 260;
const AVATAR_SIZE = 30;
const AVATAR_OVERLAP = 10;

function detectLangFromCity(city: string | null | undefined): string {
  if (!city) return 'en';
  const c = city.toLowerCase();
  if (['bratislava','košice','kosice','prešov','presov','žilina','zilina','nitra','trnava','trenčín','trencin','banská bystrica','banska bystrica'].some(x => c.includes(x))) return 'sk';
  if (['praha','brno','ostrava','plzeň','plzen','olomouc','liberec','české budějovice','ceske budejovice','hradec'].some(x => c.includes(x))) return 'cs';
  if (['wien','vienna','graz','linz','salzburg','innsbruck','klagenfurt','wels'].some(x => c.includes(x))) return 'de';
  return 'en';
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t, lang } = useTranslations();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showJoinCelebration, setShowJoinCelebration] = useState(false);

  const sheetY = useRef(new RNAnimated.Value(800)).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) sheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 120 || vy > 0.8) {
        RNAnimated.timing(sheetY, { toValue: 800, duration: 220, useNativeDriver: true }).start(() => {
          setShowMembersModal(false);
          sheetY.setValue(800);
        });
      } else {
        RNAnimated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  useEffect(() => {
    if (showMembersModal) {
      sheetY.setValue(800);
      RNAnimated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 } as any).start();
    }
  }, [showMembersModal]);

  function closeSheet() {
    RNAnimated.timing(sheetY, { toValue: 800, duration: 220, useNativeDriver: true }).start(() => {
      setShowMembersModal(false);
      sheetY.setValue(800);
    });
  }

  useFocusEffect(
    React.useCallback(() => { setStatusBarStyle('light'); loadAll(); }, [id, user, profile?.city])
  );

  async function loadAll() {
    const [{ data: clubData }, { data: membersData }] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', id).single(),
      supabase.from('club_members').select('*, profile:profiles(name, avatar_url)').eq('club_id', id).eq('status', 'approved'),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const clubCity = clubData?.city;
    const base = supabase.from('events').select('*, club:clubs(id, name, cover_url), attendees:event_attendees(profile:profiles(id, name, avatar_url))')
      .eq('club_id', id).gte('date', today);
    const { data: eventsData } = await (clubCity ? base.ilike('city', `%${clubCity}%`) : base)
      .order('date', { ascending: true }).limit(100);

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
    await supabase.from('club_members').insert({ club_id: id, user_id: user.id, role: 'member', status: 'approved', city: profile?.city ?? null });
    await supabase.from('clubs').update({ member_count: (club?.member_count ?? 0) + 1 }).eq('id', id);
    // Notify all club admins via server-side edge function (service role bypasses RLS)
    supabase.functions.invoke('notify-creator', {
      body: { type: 'club_join', clubId: id, attendeeName: profile?.name?.split(' ')[0] ?? 'Niekto' },
    }).catch(() => {});
    setIsMember(true);
    setLoading(false);
    setShowJoinCelebration(true);
    setTimeout(() => setShowJoinCelebration(false), 2800);
    loadAll();
  }

  async function handleLeave() {
    if (!user) return;
    Alert.alert(
      lang === 'sk' ? 'Odsledovať klub?' : 'Unfollow club?',
      lang === 'sk' ? 'Prestaneš dostávať novinky z tohto klubu.' : 'You will stop receiving updates from this club.',
      [
        { text: lang === 'sk' ? 'Zrušiť' : 'Cancel', style: 'cancel' },
        { text: lang === 'sk' ? 'Odsledovať' : 'Unfollow', style: 'destructive', onPress: async () => {
          await supabase.from('club_members').delete().eq('club_id', id).eq('user_id', user.id);
          await supabase.from('clubs').update({ member_count: Math.max((club?.member_count ?? 1) - 1, 0) }).eq('id', id);
          setIsMember(false);
          loadAll();
        }},
      ]
    );
  }

  if (!club) return <View style={{ flex: 1, backgroundColor: Colors.white }} />;

  const initial = club.name.charAt(0).toUpperCase();
  const visibleMembers = members.slice(0, 4);
  const memberCount = members.length || club.member_count || 0;

  return (
    <View style={styles.container}>
      <Toast visible={toast} title={t.club.youreIn} subtitle={t.club.welcomeTo(club.name)} onHide={() => setToast(false)} />

      {/* Members modal */}
      <Modal visible={showMembersModal} animationType="none" transparent onRequestClose={closeSheet}>
        <View style={styles.modalOverlay}>
          <RNAnimated.View style={[styles.membersSheet, { transform: [{ translateY: sheetY }] }]}>
            {/* Handle — drag zone only */}
            <View {...panResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <View style={styles.membersSheetHandle} />
            </View>
            {/* Header — not in drag zone so ✕ button works */}
            <View style={styles.membersSheetHeader}>
              <Text style={styles.membersSheetTitle}>{t.club.membersCount(memberCount)}</Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                    {user && m.user_id !== user.id && (club?.creator_id === user.id || (isAdmin && m.role !== 'admin')) && (
                      <TouchableOpacity onPress={() => { closeSheet(); handleRemoveMember(m); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.removeText}>{t.club.remove}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </RNAnimated.View>
        </View>
      </Modal>

      {/* Join celebration overlay */}
      <Modal visible={showJoinCelebration} transparent animationType="none" statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(400)} style={styles.celebrationOverlay}>
          <Animated.View entering={ZoomIn.delay(100).springify()} style={styles.celebrationContent}>
            {club.logo_url ? (
              <Image source={{ uri: club.logo_url }} style={styles.celebrationLogo} />
            ) : (
              <View style={[styles.celebrationLogo, styles.celebrationLogoFallback]}>
                <Text style={styles.celebrationLogoInitial}>{initial}</Text>
              </View>
            )}
            <Text style={styles.celebrationEmoji}>✓</Text>
            <Text style={styles.celebrationTitle}>{t.club.youreIn}</Text>
            <Text style={styles.celebrationSub}>{t.club.welcomeTo(club.name)}</Text>
          </Animated.View>
        </Animated.View>
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
              onPress={() => router.push(`/club/${id}/settings` as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.adminText}>{t.club.clubSettings.toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.card}>

          {/* Logo - floats up over cover boundary */}
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
          <View style={styles.clubNameRow}>
            <Text style={styles.clubName}>{club.name}</Text>
            <TouchableOpacity
              style={styles.clubShareBtn}
              onPress={() => Share.share({ url: `https://woeva.com/share-club?id=${id}` })}
              activeOpacity={0.8}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={Colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.clubShareText}>Zdieľať</Text>
            </TouchableOpacity>
          </View>
          {club.tagline ? (
            <Text style={styles.clubTagline}>
              {(() => {
                const i18n = (club as any).tagline_i18n;
                if (i18n) {
                  const lang = detectLangFromCity(profile?.city);
                  return i18n[lang] ?? i18n['en'] ?? club.tagline;
                }
                return club.tagline;
              })()}
            </Text>
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
              <Text style={styles.statLabel}>{memberCount === 1 ? 'člen' : (memberCount >= 2 && memberCount <= 4) ? 'členovia' : 'členov'}</Text>
            </View>
          </View>

          {/* About */}
          {club.description ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>{t.club.aboutTitle}</Text>
              <Text style={styles.aboutText}>
                {(() => {
                  const i18n = (club as any).description_i18n;
                  if (i18n) {
                    const lang = detectLangFromCity(profile?.city);
                    return i18n[lang] ?? i18n['en'] ?? club.description;
                  }
                  return club.description;
                })()}
              </Text>
            </>
          ) : null}

          {/* Members bubbles */}
          <View style={styles.divider} />
          <View style={styles.membersBubbleRow}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, flexWrap: 'nowrap', overflow: 'hidden' }} onPress={() => setShowMembersModal(true)} activeOpacity={0.8}>
              {members.slice(0, 4).map((m, i) => {
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
              {memberCount > 4 && (
                <View style={[styles.memberBubble, styles.memberBubbleMore, { marginLeft: -10, zIndex: 0 }]}>
                  <Text style={styles.memberBubbleMoreText}>+{memberCount - 4}</Text>
                </View>
              )}
              <Text style={styles.membersClickLabel}>{t.club.memberCount(memberCount)}</Text>
            </TouchableOpacity>
            {!isAdmin && isMember && (
              <TouchableOpacity style={styles.memberStatusBadge} onPress={handleLeave} activeOpacity={0.8}>
                <Text style={styles.memberStatusText}>✓ {lang === 'sk' ? 'Sledované' : 'Following'}</Text>
              </TouchableOpacity>
            )}
            {!isAdmin && !isMember && user && (
              <TouchableOpacity style={styles.memberJoinBtn} onPress={handleJoin} activeOpacity={0.8}>
                <Text style={styles.memberJoinText}>+ Sledovať</Text>
              </TouchableOpacity>
            )}
          </View>

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
                    {i < events.length - 1 && <View style={{ height: 4 }} />}
                  </Animated.View>
                ))}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

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
  backCircle: { backgroundColor: Colors.black, borderRadius: 20 },
  shareBtn: {
    position: 'absolute', right: 60,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
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

  // Logo + members top row - logo sticks out above card edge
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
  membersBubbleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  memberStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: Colors.black },
  memberStatusText: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  memberJoinBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, backgroundColor: Colors.black },
  memberJoinText: { fontSize: 13, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
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
  clubNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  clubName: { fontSize: 24, fontWeight: '700', color: Colors.black, letterSpacing: -0.5, fontFamily: Fonts.bold, flex: 1 },
  clubShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.black },
  clubShareText: { fontSize: 13, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },
  clubTagline: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 20, marginBottom: 10 },

  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 18 },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 2 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.grayBorder },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold },
  statLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  memberBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  memberBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.black },

  // Section
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },
  eventsList: {},

  // About
  aboutText: { fontSize: 14, color: '#555', fontFamily: Fonts.regular, lineHeight: 21, marginBottom: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight },
  tagText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.black, fontWeight: '500' },
  coverTags: { position: 'absolute', bottom: 40, right: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' },
  coverTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.5)' },
  coverTagText: { fontSize: 10, fontFamily: Fonts.medium, color: Colors.white, fontWeight: '600' },

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

  // Club settings sheet options
  settingsOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  settingsOptionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  settingsOptionLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  settingsOptionSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },

  // Invite admin modal
  inviteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  inviteSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16 },
  inviteHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 16 },
  inviteTitle: { fontSize: 18, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, marginBottom: 4 },
  inviteSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 14 },
  inviteInput: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: Colors.black, fontFamily: Fonts.regular, marginBottom: 12 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  inviteAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inviteAvatarInitial: { fontSize: 16, fontWeight: '700', color: Colors.black },
  inviteRowName: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  inviteRowEmail: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  inviteRowAction: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  inviteEmpty: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 12, textAlign: 'center' },

  // Join celebration
  celebrationOverlay: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  celebrationContent: { alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  celebrationLogo: { width: 100, height: 100, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)' },
  celebrationLogoFallback: { backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  celebrationLogoInitial: { fontSize: 44, fontWeight: '800', color: Colors.white, fontFamily: Fonts.extrabold },
  celebrationEmoji: { fontSize: 52, marginTop: 4 },
  celebrationTitle: { fontSize: 32, fontWeight: '800', color: Colors.white, fontFamily: Fonts.bold, textAlign: 'center', letterSpacing: -0.5 },
  celebrationSub: { fontSize: 16, color: 'rgba(255,255,255,0.55)', fontFamily: Fonts.regular, textAlign: 'center' },
});
