import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
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

export default function BookedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
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
      .select('id, event:events(*, club:clubs(id, name, cover_url))')
      .eq('user_id', user.id);

    const allEvents: BookedEvent[] = (data ?? [])
      .map((r: any) => ({ ...r.event, attendee_id: r.id }))
      .filter(Boolean);

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
        <WMark size={34} color={Colors.lime} />
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

function TicketCard({ event, userId, isPast, isRated, onPress, onRate }: {
  event: BookedEvent;
  userId: string;
  isPast: boolean;
  isRated: boolean;
  onPress: () => void;
  onRate: () => void;
}) {
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

        {/* Going count */}
        {(event.going_count ?? 0) > 0 && (
          <View style={styles.ticketGoingRow}>
            <View style={styles.goingDots}>
              {Array.from({ length: Math.min(event.going_count ?? 0, 3) }).map((_, i) => (
                <View key={i} style={[styles.goingDot, { marginLeft: i === 0 ? 0 : -6, backgroundColor: ['#C8FF00','#FFE566','#A8EDFF'][i] }]} />
              ))}
            </View>
            <Text style={styles.goingLabel}>{event.going_count} {event.going_count === 1 ? 'person' : 'people'} going</Text>
            <View style={[styles.pricePill, isFree && styles.pricePillFree]}>
              <Text style={[styles.priceText, isFree && styles.priceTextFree]}>{priceLabel}</Text>
            </View>
          </View>
        )}

        {/* Perforated separator */}
        <View style={styles.perfRow}>
          <View style={styles.perfNub} />
          <View style={styles.perfLine}>
            {Array.from({ length: 22 }).map((_, i) => (
              <View key={i} style={styles.perfDash} />
            ))}
          </View>
          <View style={styles.perfNub} />
        </View>

        {/* QR section */}
        <View style={styles.qrSection}>
          <View style={styles.qrWrap}>
            <QRCode
              value={qrValue}
              size={88}
              color={isPast ? Colors.gray : Colors.black}
              backgroundColor={Colors.white}
            />
          </View>
          <View style={styles.qrInfo}>
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
  title: { fontSize: 26, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black, paddingHorizontal: 20, marginBottom: 16, letterSpacing: -0.5 },
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
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  // Cover
  ticketCover: { height: 140, position: 'relative' },
  ticketCoverImg: { width: '100%', height: '100%' },
  ticketCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  ticketCoverContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, gap: 6 },
  ticketStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  ticketStatusText: { fontSize: 10, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  ticketStatusDot: { width: 6, height: 6, borderRadius: 3 },
  ticketEventTitle: { fontSize: 20, fontWeight: '800', color: Colors.white, letterSpacing: -0.3, fontFamily: Fonts.extrabold },

  // Body
  ticketBody: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },

  ticketInfoGrid: { flexDirection: 'row', marginBottom: 14 },
  ticketInfoCell: { flex: 1, gap: 2 },
  ticketInfoDivider: { width: 1, backgroundColor: Colors.grayBorder, marginHorizontal: 14 },
  ticketInfoLabel: { fontSize: 9, fontWeight: '700', color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  ticketInfoValue: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  ticketInfoSub: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },

  ticketVenueRow: { marginBottom: 14, gap: 2 },
  ticketVenue: { fontSize: 13, fontWeight: '500', color: Colors.black, fontFamily: Fonts.medium },

  ticketGoingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  goingDots: { flexDirection: 'row' },
  goingDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.white },
  goingLabel: { flex: 1, fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  pricePill: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  pricePillFree: { backgroundColor: Colors.lime },
  priceText: { fontSize: 11, fontWeight: '700', color: Colors.gray },
  priceTextFree: { color: Colors.black },

  // Perforated line
  perfRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  perfNub: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#F5F5F5', marginHorizontal: -18 },
  perfLine: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  perfDash: { width: 4, height: 1.5, backgroundColor: Colors.grayBorder, borderRadius: 1 },

  // QR
  qrSection: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  qrWrap: { padding: 8, backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1, borderColor: Colors.grayBorder },
  qrInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  qrTitle: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  qrSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  qrClub: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.medium, marginTop: 2 },
  rateBtn: { marginTop: 8, backgroundColor: Colors.black, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  rateBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  ratedText: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.medium, marginTop: 6 },
});
