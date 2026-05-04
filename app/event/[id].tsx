import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedScrollHandler,
  useAnimatedStyle, interpolate, Extrapolation,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event, Profile } from '@/types';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';

const { height: SCREEN_H } = Dimensions.get('window');
const COVER_HEIGHT = Math.round(SCREEN_H * 0.48);
const AV = 32;

const SAMPLE_AVATARS = [
  require('@/assets/images/sample_av1.jpg'),
  require('@/assets/images/sample_av2.jpg'),
  require('@/assets/images/sample_av3.jpg'),
  require('@/assets/images/sample_av4.jpg'),
];

type Attendee = { id: string; profile: { name: string | null; avatar_url: string | null } | null };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [isAttending, setIsAttending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isMember, setIsMember] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [0, COVER_HEIGHT], [0, -COVER_HEIGHT * 0.28], Extrapolation.CLAMP),
    }],
  }));

  useFocusEffect(
    React.useCallback(() => { load(); }, [id, user])
  );

  async function load() {
    const { data } = await supabase
      .from('events')
      .select('*, club:clubs(id, name, cover_url)')
      .eq('id', id).single();
    setEvent(data as any);

    if (data?.creator_id && !data?.club_id) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.creator_id).single();
      setCreator(p);
    }
    const { data: attData } = await supabase
      .from('event_attendees')
      .select('id, profile:profiles(name, avatar_url)')
      .eq('event_id', id).limit(5);
    setAttendees((attData ?? []) as any);

    if (user) {
      const { data: att } = await supabase.from('event_attendees').select('id').eq('event_id', id).eq('user_id', user.id).single();
      setIsAttending(!!att);
      if (data?.club_id) {
        const { data: mem } = await supabase.from('club_members').select('id').eq('club_id', data.club_id).eq('user_id', user.id).single();
        setIsMember(!!mem);
      }
    }
  }

  async function handleJoin() {
    if (!user) { router.push('/(auth)/login'); return; }
    if (event?.is_free || event?.price === 0) {
      setLoading(true);
      await supabase.from('event_attendees').insert({ event_id: id, user_id: user.id, paid: true });
      await supabase.from('events').update({ going_count: (event?.going_count ?? 0) + 1 }).eq('id', id);
      setIsAttending(true); setLoading(false); setToast(true); load();
    } else {
      router.push(`/event/${id}/payment`);
    }
  }

  async function handleDelete() {
    Alert.alert('Delete event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('event_attendees').delete().eq('event_id', id);
        await supabase.from('events').delete().eq('id', id);
        router.replace('/(tabs)');
      }},
    ]);
  }

  if (!event) return <View style={{ flex: 1, backgroundColor: Colors.white }} />;

  const isCreator = !!user && event.creator_id === user.id;
  const isFree = event.is_free || event.price === 0;
  const priceLabel = isFree ? 'Free' : `€${event.price}`;
  const hostName = event.club?.name ?? creator?.name ?? '';
  const hostInitial = hostName.charAt(0).toUpperCase();
  const goingCount = event.going_count ?? 0;
  const visibleAtt = attendees.slice(0, 4);
  const overflow = Math.max(0, goingCount - visibleAtt.length);

  const d = new Date(event.date + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = d.getDate();
  const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const isToday = new Date().toDateString() === d.toDateString();

  return (
    <View style={s.container}>
      <Toast visible={toast} title="You're in" subtitle="See you out there." onHide={() => setToast(false)} />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover with parallax ── */}
        <View style={[s.coverWrap, { height: COVER_HEIGHT }]}>
          <Animated.View style={[s.coverInner, parallaxStyle]}>
            {event.cover_url
              ? <Image source={{ uri: event.cover_url }} style={s.coverImg} resizeMode="cover" />
              : <View style={[s.coverImg, { backgroundColor: '#111' }]} />
            }
          </Animated.View>

          {/* SVG gradient: transparent → black */}
          <Svg style={s.coverGradient} preserveAspectRatio="none">
            <Defs>
              <SvgGrad id="fadeBlack" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#000" stopOpacity="0.15" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
              </SvgGrad>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fadeBlack)" />
          </Svg>

          {/* Controls */}
          <View style={[s.topLeft, { top: insets.top + 10 }]}>
            <BackButton color={Colors.white} style={s.backBtn} />
          </View>
          {isCreator && (
            <View style={[s.topRight, { top: insets.top + 10 }]}>
              <TouchableOpacity style={s.ctrlPill} onPress={() => router.push(`/event/${id}/edit` as any)}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={s.ctrlPillText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.ctrlPill} onPress={handleDelete}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[s.ctrlPillText, s.ctrlPillDanger]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Title + price + category on cover bottom */}
          <View style={s.coverBottom}>
            {event.category && (
              <View style={s.catPill}>
                <Text style={s.catText}>{event.category.toUpperCase()}</Text>
              </View>
            )}
            <View style={s.coverTitleRow}>
              <Text style={s.coverTitle} numberOfLines={2}>{event.title}</Text>
              <View style={[s.priceBadge, isFree && s.priceBadgeFree]}>
                <Text style={[s.priceText, isFree && s.priceTextFree]}>{priceLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Main content — white rounded card ── */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={s.body}>

          {/* ── Info card ── */}
          <View style={s.infoCard}>
            <View style={s.infoRows}>
              <View style={s.infoRow}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="4" width="18" height="18" rx="3" stroke={Colors.gray} strokeWidth={2} />
                  <Path d="M16 2v4M8 2v4M3 10h18" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" />
                </Rect>
                </Svg>
                <Text style={s.infoText}>
                  {isToday ? 'Today' : `${dayName}, ${dayNum} ${monthName}`}
                </Text>
              </View>
              {event.time ? (
                <View style={s.infoRow}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={12} r={9} stroke={Colors.gray} strokeWidth={2} />
                    <Path d="M12 7v5l3 2" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                  <Text style={s.infoText}>{event.time}{event.duration ? `  ·  ${event.duration}h` : ''}</Text>
                </View>
              ) : null}
              {event.venue ? (
                <View style={s.infoRow}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0 1 18 0z" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={10} r={3} stroke={Colors.gray} strokeWidth={2} />
                  </Svg>
                  <Text style={s.infoText} numberOfLines={2}>{event.venue}</Text>
                </View>
              ) : null}
              {event.is_recurring && (
                <View style={s.infoRow}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={s.infoText}>Every {d.toLocaleDateString('en-US', { weekday: 'long' })}</Text>
                </View>
              )}
            </View>

            {/* Small QR — only when attending */}
            {isAttending && user && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/booked')} activeOpacity={0.75} style={s.qrCorner}>
                <QRCode value={`woeva:event:${id}:${user.id}`} size={48} color={Colors.black} backgroundColor="transparent" />
                <Text style={s.qrCornerLabel}>ticket</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Going ── */}
          {goingCount > 0 && (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>Who's going</Text>
              <View style={s.goingRow}>
                <View style={s.avatarStack}>
                  {Array.from({ length: Math.min(goingCount, 4) }).map((_, i) => {
                    const att = visibleAtt[i];
                    const ml = i === 0 ? 0 : -10;
                    const src = att?.profile?.avatar_url
                      ? { uri: att.profile.avatar_url }
                      : SAMPLE_AVATARS[i % SAMPLE_AVATARS.length];
                    return (
                      <View key={i} style={[s.av, { marginLeft: ml, zIndex: 10 - i }]}>
                        <Image source={src} style={s.avImg} />
                      </View>
                    );
                  })}
                  {overflow > 0 && (
                    <View style={[s.av, s.avOverflow, { marginLeft: -4 }]}>
                      <Text style={s.avOverflowText}>+{overflow}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.goingText}>
                  <Text style={s.goingNum}>{goingCount}</Text>{' people going'}
                </Text>
              </View>
            </>
          )}

          {/* ── About ── */}
          {event.tagline ? (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>About</Text>
              <Text style={s.aboutText}>{event.tagline}</Text>
            </>
          ) : null}

          {/* ── Hosted by ── */}
          {hostName ? (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>Hosted by</Text>
              <TouchableOpacity
                style={s.hostCard}
                onPress={() => event.club ? router.push(`/club/${event.club!.id}`) : null}
                activeOpacity={event.club ? 0.75 : 1}
              >
                {event.club?.cover_url
                  ? <Image source={{ uri: event.club.cover_url }} style={s.hostImg} />
                  : <View style={[s.hostImg, s.hostImgFallback]}><Text style={s.hostInitial}>{hostInitial}</Text></View>
                }
                <View style={s.hostInfo}>
                  <Text style={s.hostName}>{hostName}</Text>
                  {event.club && <Text style={s.hostSub}>Tap to view club →</Text>}
                </View>
              </TouchableOpacity>

              {user && isAttending && event.club && !isMember && (
                <TouchableOpacity style={s.joinClubBtn} activeOpacity={0.8}
                  onPress={async () => {
                    await supabase.from('club_members').insert({ club_id: event.club!.id, user_id: user.id, role: 'member', status: 'approved' });
                    setIsMember(true);
                  }}
                >
                  <Text style={s.joinClubBtnText}>+ Join {hostName}</Text>
                </TouchableOpacity>
              )}
              {user && isAttending && event.club && isMember && (
                <View style={s.memberBadge}>
                  <Text style={s.memberBadgeText}>✓  You're a member</Text>
                </View>
              )}
            </>
          ) : null}

          {/* ── Group chat ── */}
          <View style={s.divider} />
          <Text style={s.sectionLabel}>Group chat</Text>
          {isAttending ? (
            <TouchableOpacity style={s.chatCard} onPress={() => router.push(`/chat/${id}`)} activeOpacity={0.8}>
              <View style={s.chatIconWrap}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={s.chatInfo}>
                <Text style={s.chatTitle}>Event group chat</Text>
                <Text style={s.chatSub}>Chat with everyone going</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          ) : (
            <View style={s.chatCardLocked}>
              <View style={s.chatIconWrap}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" stroke={Colors.gray} strokeWidth={2} />
                  <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={s.chatInfo}>
                <Text style={s.chatTitleLocked}>Event group chat</Text>
                <Text style={s.chatSub}>Join the event to unlock</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* ── CTA ── */}
      <View style={[s.cta, { paddingBottom: insets.bottom + 12 }]}>
        {!authLoading && !user && (
          <View style={s.guestRow}>
            <Text style={s.guestText}>Join to attend events</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={s.guestLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        )}
        {user && isAttending
          ? (
            <View style={s.attendingRow}>
              <Button label="✓  You're going" onPress={() => {}} variant="lime" disabled style={s.attendingBtn} />
              <TouchableOpacity style={s.ticketBtn} onPress={() => router.push('/(tabs)/booked')} activeOpacity={0.8}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M2 9a1 1 0 0 1 0-2V5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a1 1 0 0 1 0 2v2a1 1 0 0 1 0 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 0-2V9z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M9 4v16M9 9h6M9 15h6" stroke={Colors.black} strokeWidth={1.5} strokeLinecap="round" />
                </Svg>
                <Text style={s.ticketBtnText}>My ticket</Text>
              </TouchableOpacity>
            </View>
          )
          : <Button
              label={user ? (isFree ? 'Join — it\'s free' : `Buy ticket  ·  ${priceLabel}`) : 'Get Woeva — Join free'}
              onPress={handleJoin}
              loading={loading}
              variant="lime"
            />
        }
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Cover
  coverWrap: { overflow: 'hidden', backgroundColor: '#111' },
  coverInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -60 },
  coverImg: { width: '100%', height: '100%' },
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topLeft: { position: 'absolute', left: 16 },
  topRight: { position: 'absolute', right: 16, flexDirection: 'row', gap: 8 },
  backBtn: { backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 20 },
  ctrlPill: { backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ctrlPillText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  ctrlPillDanger: { color: '#FF6B6B' },

  // Cover bottom overlay (title + price on image)
  coverBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, gap: 8 },
  catPill: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  catText: { fontSize: 9, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  coverTitleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  coverTitle: { flex: 1, fontSize: 26, fontWeight: '800', color: Colors.white, letterSpacing: -0.5, lineHeight: 32, fontFamily: Fonts.extrabold },
  priceBadge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 2 },
  priceBadgeFree: { backgroundColor: Colors.lime },
  priceText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  priceTextFree: { color: Colors.black },

  // Body — white rounded card overlapping cover bottom
  body: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },

  // Info card
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.grayLight, borderRadius: 18, padding: 18, gap: 12 },
  infoRows: { flex: 1, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: Colors.black, fontFamily: Fonts.medium, flex: 1, lineHeight: 18 },
  qrCorner: { alignItems: 'center', gap: 4 },
  qrCornerLabel: { fontSize: 9, fontWeight: '700', color: Colors.gray, letterSpacing: 0.5, textTransform: 'uppercase' },

  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 20 },

  // Going
  goingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarStack: { flexDirection: 'row' },
  av: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, borderColor: Colors.white },
  avImg: { width: AV, height: AV, borderRadius: AV / 2 },
  avFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avInit: { fontSize: 12, fontWeight: '700', color: Colors.black },
  avOverflow: { backgroundColor: '#888', alignItems: 'center', justifyContent: 'center' },
  avOverflowText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  goingText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  goingNum: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },

  // About
  aboutText: { fontSize: 15, color: Colors.black, lineHeight: 24, fontFamily: Fonts.regular },

  // Host
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.grayLight, borderRadius: 16, padding: 14 },
  hostImg: { width: 44, height: 44, borderRadius: 10 },
  hostImgFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  hostInitial: { fontSize: 18, fontWeight: '800', color: Colors.black },
  hostInfo: { flex: 1 },
  hostName: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  hostSub: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },

  joinClubBtn: { marginTop: 10, backgroundColor: Colors.black, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  joinClubBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  memberBadge: { marginTop: 10, backgroundColor: Colors.grayLight, borderRadius: 50, paddingVertical: 12, alignItems: 'center' },
  memberBadgeText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },

  // Chat
  chatCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.grayLight, borderRadius: 16, padding: 14 },
  chatCardLocked: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.grayLight, borderRadius: 16, padding: 14, opacity: 0.55 },
  chatIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  chatInfo: { flex: 1 },
  chatTitle: { fontSize: 14, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  chatTitleLocked: { fontSize: 14, fontWeight: '700', color: Colors.gray, fontFamily: Fonts.semibold },
  chatSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },

  // CTA
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: Colors.white, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 10 },
  attendingRow: { flexDirection: 'row', gap: 10 },
  attendingBtn: { flex: 1 },
  ticketBtn: { height: 56, borderRadius: 50, borderWidth: 1.5, borderColor: Colors.black, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  ticketBtnText: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  guestRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 4 },
  guestText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  guestLink: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
});
