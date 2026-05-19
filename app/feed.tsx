import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import { expandRecurringEvents } from '@/lib/expandRecurring';

const { width: W, height: H } = Dimensions.get('window');

const SPRING = { damping: 32, stiffness: 280, mass: 0.9 };
const THRESHOLD = H * 0.2;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { lang } = useTranslations();
  const locale = lang === 'sk' ? 'sk-SK' : 'en-US';
  const { startAfterId } = useLocalSearchParams<{ startAfterId?: string }>();

  const [events, setEvents] = useState<Event[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  const translateY = useSharedValue(0);
  const isAnimating = useSharedValue(0);

  useFocusEffect(useCallback(() => {
    load();
  }, [user?.id]));

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('events')
      .select('*, club:clubs(id, name, cover_url)')
      .or(`date.gte.${today},and(is_recurring.eq.true,recurring_end_date.gte.${today})`)
      .neq('status', 'cancelled')
      .not('cover_url', 'is', null)
      .order('date', { ascending: true })
      .limit(60);

    const expanded = expandRecurringEvents((data ?? []) as any);
    setEvents(expanded);

    // Start after the event the user was just viewing
    if (startAfterId) {
      const baseId = startAfterId.split('_')[0];
      const idx = expanded.findIndex(e => e.id === startAfterId || e.id.split('_')[0] === baseId);
      const startIdx = idx >= 0 ? Math.min(idx + 1, expanded.length - 1) : 0;
      setCurrentIndex(startIdx);
      currentIndexRef.current = startIdx;
    }

    if (user) {
      const { data: att } = await supabase
        .from('event_attendees').select('event_id').eq('user_id', user.id);
      setAttendingIds(new Set((att ?? []).map((a: any) => a.event_id)));
    }
  }

  async function handleJoin(event: Event) {
    if (!user) { router.push('/(auth)/login'); return; }
    const isPayAtDoor = !!(event as any).pay_at_door;
    const isFree = !isPayAtDoor && (event.is_free || event.price === 0);
    if (isFree || isPayAtDoor) {
      await supabase.from('event_attendees').insert({ event_id: event.id, user_id: user.id, paid: true });
      await supabase.from('events').update({ going_count: (event.going_count ?? 0) + 1 }).eq('id', event.id);
      setAttendingIds(prev => new Set([...prev, event.id]));
    } else {
      router.push(`/event/${event.id}/payment`);
    }
  }

  function goTo(index: number) {
    currentIndexRef.current = index;
    setCurrentIndex(index);
  }

  const gesture = Gesture.Pan()
    .enabled(true)
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      if (isAnimating.value) return;
      const idx = currentIndexRef.current;
      // Resist at boundaries
      if ((idx === 0 && e.translationY > 0) || (idx >= events.length - 1 && e.translationY < 0)) {
        translateY.value = e.translationY * 0.15;
      } else {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (isAnimating.value) return;
      const idx = currentIndexRef.current;
      const vel = e.velocityY;
      const dist = e.translationY;

      const goNext = (dist < -THRESHOLD || vel < -800) && idx < events.length - 1;
      const goPrev = (dist > THRESHOLD || vel > 800) && idx > 0;

      if (goNext) {
        isAnimating.value = 1;
        translateY.value = withSpring(-H, SPRING, () => {
          translateY.value = 0;
          isAnimating.value = 0;
          runOnJS(goTo)(idx + 1);
        });
      } else if (goPrev) {
        isAnimating.value = 1;
        translateY.value = withSpring(H, SPRING, () => {
          translateY.value = 0;
          isAnimating.value = 0;
          runOnJS(goTo)(idx - 1);
        });
      } else {
        translateY.value = withSpring(0, SPRING);
      }
    });

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  if (events.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()} activeOpacity={0.8}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>
    );
  }

  // Render current card + one ahead + one behind for smooth transition
  const visibleIndices = [currentIndex - 1, currentIndex, currentIndex + 1].filter(i => i >= 0 && i < events.length);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <GestureDetector gesture={gesture}>
        <Animated.View style={StyleSheet.absoluteFill}>
          {visibleIndices.map((idx) => (
            <EventCard
              key={events[idx].id + '_' + idx}
              event={events[idx]}
              cardIndex={idx}
              currentIndex={currentIndex}
              translateY={translateY}
              insets={insets}
              lang={lang}
              locale={locale}
              isAttending={attendingIds.has(events[idx].id.split('_')[0]) || attendingIds.has(events[idx].id)}
              formatDate={formatDate}
              onJoin={() => handleJoin(events[idx])}
              onDetail={() => router.push(`/event/${events[idx].id}`)}
              showSwipeHint={idx === 0 && events.length > 1}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      {/* Progress segments */}
      {events.length > 1 && (
        <View style={[styles.progressBar, { top: insets.top + 10 }]} pointerEvents="none">
          {events.slice(0, Math.min(events.length, 10)).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                i < currentIndex && styles.progressSegDone,
                i === currentIndex && styles.progressSegActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M19 12H5M12 5l-7 7 7 7" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

// ─── Card component ────────────────────────────────────────────────────────────

interface CardProps {
  event: Event;
  cardIndex: number;
  currentIndex: number;
  translateY: Animated.SharedValue<number>;
  insets: { bottom: number; top: number };
  lang: string;
  locale: string;
  isAttending: boolean;
  formatDate: (d: string) => string;
  onJoin: () => void;
  onDetail: () => void;
  showSwipeHint: boolean;
}

function EventCard({
  event, cardIndex, currentIndex, translateY, insets, lang, locale,
  isAttending, formatDate, onJoin, onDetail, showSwipeHint,
}: CardProps) {
  const isPayAtDoor = !!(event as any).pay_at_door;
  const isFree = !isPayAtDoor && (event.is_free || event.price === 0);
  const priceLabel = isFree ? (lang === 'sk' ? 'Zadarmo' : 'Free')
    : isPayAtDoor ? `€${event.price} ${lang === 'sk' ? 'na mieste' : 'at the venue'}`
    : `€${event.price}`;

  // This card's base offset from current: (cardIndex - currentIndex) * H
  const baseOffset = (cardIndex - currentIndex) * H;

  const animStyle = useAnimatedStyle(() => {
    const ty = baseOffset + translateY.value;
    // Scale down cards that are far away slightly
    const scale = interpolate(
      translateY.value,
      cardIndex === currentIndex ? [-H, 0, H] : [-H, 0, H],
      cardIndex === currentIndex ? [0.96, 1, 0.96] : [1, 1, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateY: ty }, { scale }],
    };
  });

  return (
    <Animated.View style={[styles.card, animStyle]}>
      {event.cover_url ? (
        <Image
          source={{ uri: event.cover_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
      )}

      {/* Gradient */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <SvgGrad id={`grad_feed_${cardIndex}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0.45" />
            <Stop offset="0.25" stopColor="#000" stopOpacity="0.05" />
            <Stop offset="0.55" stopColor="#000" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.9" />
          </SvgGrad>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#grad_feed_${cardIndex})`} />
      </Svg>

      {/* Content */}
      <View style={[styles.cardBody, { paddingBottom: insets.bottom + 100 }]}>
        {event.category ? (
          <View style={styles.catPill}>
            <Text style={styles.catText}>{event.category.toUpperCase()}</Text>
          </View>
        ) : null}

        <Text style={styles.cardTitle} numberOfLines={3}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatDate(event.date)}</Text>
          {event.time ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{event.time.slice(0, 5)}</Text>
            </>
          ) : null}
          {event.venue ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText} numberOfLines={1}>{event.venue.split(',')[0]}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.actions}>
          {isAttending ? (
            <View style={[styles.btnJoin, { backgroundColor: Colors.lime }]}>
              <Text style={[styles.btnJoinText, { color: Colors.black }]}>
                {lang === 'sk' ? '✓ Ideš' : '✓ Going'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnJoin, !isFree && { backgroundColor: Colors.white }]}
              onPress={onJoin}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnJoinText, !isFree && { color: Colors.black }]}>
                {isFree
                  ? (lang === 'sk' ? 'Pridať sa — zadarmo' : "Join — it's free")
                  : isPayAtDoor
                    ? `${lang === 'sk' ? 'Pridať sa' : 'Join'} · ${priceLabel}`
                    : (lang === 'sk' ? `Kúpiť lístok · ${priceLabel}` : `Get ticket · ${priceLabel}`)
                }
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnDetail} onPress={onDetail} activeOpacity={0.8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>

      {/* Swipe hint on first card */}
      {showSwipeHint && (
        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>↑</Text>
          <Text style={styles.swipeHintLabel}>SWIPE</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },

  card: {
    position: 'absolute',
    width: W,
    height: H,
    backgroundColor: '#111',
    overflow: 'hidden',
  },

  cardBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 12,
  },

  catPill: {
    backgroundColor: Colors.lime,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  catText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: 1,
  },

  cardTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
    lineHeight: 38,
    fontFamily: Fonts.extrabold,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: Fonts.regular,
    flexShrink: 1,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnJoin: {
    flex: 1,
    height: 54,
    borderRadius: 50,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnJoinText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.black,
    fontFamily: Fonts.semibold,
    letterSpacing: -0.2,
  },
  btnDetail: {
    width: 54,
    height: 54,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  swipeHint: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    opacity: 0.4,
  },
  swipeHintText: { fontSize: 20, color: Colors.white },
  swipeHintLabel: { fontSize: 10, color: Colors.white, fontFamily: Fonts.regular, letterSpacing: 1 },

  progressBar: {
    position: 'absolute',
    left: 60,
    right: 20,
    flexDirection: 'row',
    gap: 4,
    zIndex: 20,
  },
  progressSeg: {
    flex: 1,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressSegDone: { backgroundColor: Colors.white },
  progressSegActive: { backgroundColor: Colors.lime },

  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
