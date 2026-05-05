import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, ImageStyle, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { Button } from '@/components/ui/Button';
import { WMark } from '@/components/ui/WMark';
import { useAuth } from '@/context/AuthContext';

type BookedEvent = Event & { attendee_id?: string };

const SAMPLE_AVATARS = [
  require('@/assets/images/sample_av1.jpg'),
  require('@/assets/images/sample_av2.jpg'),
  require('@/assets/images/sample_av3.jpg'),
  require('@/assets/images/sample_av4.jpg'),
];

export default function BookedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<BookedEvent[]>([]);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadEvents(); }, [tab, user]);

  async function loadEvents() {
    if (!user) return;
    const now = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('event_attendees')
      .select('id, event:events(*, club:clubs(id, name, cover_url), attendees:event_attendees(profile:profiles(id, name, avatar_url)))')
      .eq('user_id', user.id);

    const allEvents: BookedEvent[] = (data ?? [])
      .map((r: any) => ({ ...r.event, attendee_id: r.id }))
      .filter((e: any) => e && e.creator_id !== user.id);

    const filtered = tab === 'upcoming'
      ? allEvents.filter(e => e.date >= now)
      : allEvents.filter(e => e.date < now);

    setEvents(filtered.sort((a, b) => a.date.localeCompare(b.date)));

    if (tab === 'past' && filtered.length > 0) {
      const ids = filtered.map(e => e.id);
      const { data: ratings } = await supabase
        .from('event_ratings')
        .select('event_id')
        .eq('user_id', user.id)
        .in('event_id', ids);
      setRatedIds(new Set((ratings ?? []).map((r: any) => r.event_id)));
    } else {
      setRatedIds(new Set());
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
          <WMark size={34} color={Colors.lime} />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>My tickets</Text>

      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {events.length === 0 ? (
          <Animated.View entering={FadeInDown} style={styles.empty}>
            <View style={styles.emptyDot} />
            <Text style={styles.emptyTitle}>
              {tab === 'upcoming' ? 'No tickets yet' : 'No past events'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'upcoming'
                ? 'Find an event and grab your spot.'
                : 'Events you attended will appear here.'}
            </Text>
            {tab === 'upcoming' && (
              <Button label="Discover events" onPress={() => router.push('/(tabs)/search')} variant="lime" style={styles.cta} />
            )}
          </Animated.View>
        ) : (
          events.map((event, i) => (
            <Animated.View key={event.id} entering={FadeInDown.delay(i * 70)}>
              <TicketCard
                event={event}
                userId={user!.id}
                userAvatar={profile?.avatar_url ?? null}
                userName={profile?.name ?? user!.email ?? ''}
                isPast={tab === 'past'}
                isRated={ratedIds.has(event.id)}
                onPress={() => router.push(`/event/${event.id}`)}
                onRate={() => router.push(`/event/${event.id}/rate`)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function TicketCard({ event, userId, userAvatar, userName, isPast, isRated, onPress, onRate }: {
  event: BookedEvent;
  userId: string;
  userAvatar: string | null;
  userName: string;
  isPast: boolean;
  isRated: boolean;
  onPress: () => void;
  onRate: () => void;
}) {
  const [qrModal, setQrModal] = useState(false);
  const [goingCount, setGoingCount] = useState(event.going_count ?? 0);

  useEffect(() => {
    const channel = supabase
      .channel(`event_going_${event.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
        filter: `id=eq.${event.id}`,
      }, payload => {
        if (payload.new?.going_count !== undefined) {
          setGoingCount(payload.new.going_count);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [event.id]);

  const d = new Date(event.date + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  const qrValue = `woeva:event:${event.id}:${userId}`;
  const isFree = event.is_free || event.price === 0;
  const priceLabel = isFree ? 'Free' : `€${event.price}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.ticket}>
      {/* Cover strip */}
      <View style={styles.ticketCover}>
        {event.cover_url
          ? <Image source={{ uri: event.cover_url }} style={styles.ticketCoverImg} />
          : <View style={[styles.ticketCoverImg, { backgroundColor: Colors.black }]} />
        }
        {/* Overlay */}
        <View style={styles.ticketCoverOverlay} />
        <View style={styles.ticketCoverContent}>
          <View style={styles.ticketStatusPill}>
            <Text style={styles.ticketStatusText}>{isPast ? 'USED' : 'VALID'}</Text>
            <View style={[styles.ticketStatusDot, { backgroundColor: isPast ? Colors.gray : Colors.lime }]} />
          </View>
          <Text style={styles.ticketEventTitle} numberOfLines={2}>{event.title}</Text>
        </View>
      </View>

      {/* Info section */}
      <View style={styles.ticketBody}>
        {/* Date + Time row */}
        <View style={styles.ticketInfoGrid}>
          <View style={styles.ticketInfoCell}>
            <Text style={styles.ticketInfoLabel}>DATE</Text>
            <Text style={styles.ticketInfoValue}>{dayName}</Text>
            <Text style={styles.ticketInfoSub}>{dateStr}</Text>
          </View>
          <View style={styles.ticketInfoDivider} />
          <View style={styles.ticketInfoCell}>
            <Text style={styles.ticketInfoLabel}>TIME</Text>
            <Text style={styles.ticketInfoValue}>{event.time || '—'}</Text>
            {event.duration ? <Text style={styles.ticketInfoSub}>{event.duration}h duration</Text> : null}
          </View>
        </View>

        {/* Venue */}
        {event.venue ? (
          <View style={styles.ticketVenueRow}>
            <Text style={styles.ticketInfoLabel}>LOCATION</Text>
            <Text style={styles.ticketVenue}>{event.venue}</Text>
          </View>
        ) : null}

        {/* Going count — always show since user is attending */}
        <View style={styles.ticketGoingRow}>
          <View style={styles.goingAvatars}>
            {/* User's own avatar always first */}
            <View style={[styles.goingAvatar, styles.goingAvatarFallback, { marginLeft: 0 }]}>
              <Text style={styles.goingAvatarInitial}>{(userName || '?').charAt(0).toUpperCase()}</Text>
              {userAvatar ? <Image source={{ uri: userAvatar }} style={[StyleSheet.absoluteFill, { borderRadius: 11 }] as ImageStyle} /> : null}
            </View>
            {/* Other attendees */}
            {Array.from({ length: 2 }).map((_, i) => {
              const others = ((event as any).attendees ?? []).filter((a: any) => a?.profile?.id !== userId);
              const att = others[i];
              const avatarUrl = att?.profile?.avatar_url;
              return avatarUrl
                ? <Image key={i} source={{ uri: avatarUrl }} style={[styles.goingAvatar, { marginLeft: -7 }] as ImageStyle} />
                : <Image key={i} source={SAMPLE_AVATARS[(i + 1) % SAMPLE_AVATARS.length]} style={[styles.goingAvatar, { marginLeft: -7 }] as ImageStyle} />;
            })}
          </View>
          <Text style={styles.goingLabel}>{Math.max(goingCount, 1)} {goingCount === 1 ? 'person' : 'people'} going</Text>
          <View style={[styles.pricePill, isFree && styles.pricePillFree]}>
            <Text style={[styles.priceText, isFree && styles.priceTextFree]}>{priceLabel}</Text>
          </View>
        </View>

        {/* Perforated separator */}
        <View style={styles.perfRow}>
          <View style={styles.perfNub} />
          <View style={styles.perfLine}>
            {Array.from({ length: 16 }).map((_, i) => (
              <View key={i} style={styles.perfDash} />
            ))}
          </View>
          <View style={styles.perfNub} />
        </View>

        {/* QR section */}
        <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
          <TouchableOpacity style={styles.qrModalBg} activeOpacity={1} onPress={() => setQrModal(false)}>
            <View style={styles.qrModalCard}>
              <Text style={styles.qrModalTitle}>{event.title}</Text>
              <Text style={styles.qrModalSub}>{isPast ? 'Event attended' : 'Show at the door'}</Text>
              <View style={styles.qrModalCode}>
                <QRCode value={qrValue} size={220} color={Colors.black} backgroundColor={Colors.white} />
              </View>
              <Text style={styles.qrModalHint}>Tap anywhere to close</Text>
            </View>
          </TouchableOpacity>
        </Modal>
        <View style={styles.qrSection}>
          <TouchableOpacity style={styles.qrWrap} onPress={() => setQrModal(true)} activeOpacity={0.75}>
            <QRCode
              value={qrValue}
              size={88}
              color={isPast ? Colors.gray : Colors.black}
              backgroundColor={Colors.white}
            />
          </TouchableOpacity>
          <View style={styles.qrInfo}>
            <Text style={styles.qrAttendeeName} numberOfLines={1}>{userName}</Text>
            <Text style={styles.qrTitle}>{isPast ? 'Event attended' : 'Your ticket'}</Text>
            <Text style={styles.qrSub}>
              {isPast ? 'Thanks for coming!' : 'Show this QR at the door'}
            </Text>
            {event.club?.name ? (
              <Text style={styles.qrClub}>{event.club.name}</Text>
            ) : null}

            {isPast && !isRated && event.club_id && (
              <TouchableOpacity style={styles.rateBtn} onPress={onRate} activeOpacity={0.8}>
                <Text style={styles.rateBtnText}>Rate event →</Text>
              </TouchableOpacity>
            )}
            {isPast && isRated && (
              <Text style={styles.ratedText}>★ Rated</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  topBar: { alignItems: 'center', paddingTop: 8, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, paddingHorizontal: 20, marginBottom: 16, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.white },
  tabBtnActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyDot: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.white, marginBottom: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.extrabold, color: Colors.black },
  emptyText: { fontSize: 15, color: Colors.gray, textAlign: 'center', lineHeight: 22, fontFamily: Fonts.regular },
  cta: { marginTop: 8, width: '100%' },

  // Ticket
  ticket: {
    backgroundColor: '#111',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },

  // Cover
  ticketCover: { height: 160, position: 'relative' },
  ticketCoverImg: { width: '100%', height: '100%' },
  ticketCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  ticketCoverContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 6 },
  ticketStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5 },
  ticketStatusText: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 1.2 },
  ticketStatusDot: { width: 6, height: 6, borderRadius: 3 },
  ticketEventTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: -0.5, lineHeight: 28, fontFamily: Fonts.extrabold },

  // Body
  ticketBody: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },

  ticketInfoGrid: { flexDirection: 'row', marginBottom: 14 },
  ticketInfoCell: { flex: 1, gap: 2 },
  ticketInfoDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 14 },
  ticketInfoLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  ticketInfoValue: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  ticketInfoSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: Fonts.regular },

  ticketVenueRow: { marginBottom: 14, gap: 2 },
  ticketVenue: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.medium },

  ticketGoingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  goingAvatars: { flexDirection: 'row' },
  goingAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#111' },
  goingAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  goingAvatarInitial: { fontSize: 9, fontWeight: '700', color: Colors.black },

  goingLabel: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: Fonts.regular },
  pricePill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  pricePillFree: { backgroundColor: Colors.lime },
  priceText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  priceTextFree: { color: Colors.black },

  // Perforated line
  perfRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  perfNub: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F5F5F5', marginHorizontal: -18 },
  perfLine: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  perfDash: { width: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2 },

  // QR
  qrSection: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  qrWrap: { padding: 10, backgroundColor: Colors.white, borderRadius: 16 },
  qrInfo: { flex: 1, gap: 5, justifyContent: 'center' },
  qrAttendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  qrAvatar: { width: 28, height: 28, borderRadius: 14 },
  qrAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  qrAvatarInitial: { fontSize: 12, fontWeight: '700', color: Colors.black },

  qrAttendeeName: { fontSize: 13, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold, flex: 1 },
  qrTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.semibold },
  qrSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: Fonts.regular, lineHeight: 16 },
  qrClub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: Fonts.medium, marginTop: 2 },
  rateBtn: { marginTop: 8, backgroundColor: Colors.lime, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  rateBtnText: { fontSize: 12, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  ratedText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.medium, marginTop: 6 },

  // QR modal
  qrModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  qrModalCard: { backgroundColor: Colors.white, borderRadius: 28, padding: 32, alignItems: 'center', gap: 8, marginHorizontal: 32 },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold, textAlign: 'center' },
  qrModalSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 8 },
  qrModalCode: { padding: 12, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.grayBorder },
  qrModalHint: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 8 },
});
