import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Event, Profile } from '@/types';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [isAttending, setIsAttending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  const coverStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [0, 200], [0, -60], Extrapolation.CLAMP),
    }],
    opacity: interpolate(scrollY.value, [0, 200], [1, 0.6], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    const { data } = await supabase.from('events').select('*').eq('id', id).single();
    setEvent(data);
    if (data?.creator_id) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.creator_id).single();
      setCreator(profile);
    }
    if (user) {
      const { data: att } = await supabase.from('event_attendees').select('id').eq('event_id', id).eq('user_id', user.id).single();
      setIsAttending(!!att);
    }
  }

  async function handleJoin() {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    if (event?.is_free || event?.price === 0) {
      setLoading(true);
      await supabase.from('event_attendees').insert({ event_id: id, user_id: user.id, paid: true });
      await supabase.from('events').update({ going_count: (event?.going_count ?? 0) + 1 }).eq('id', id);
      setIsAttending(true);
      setLoading(false);
      setToast(true);
    } else {
      router.push(`/event/${id}/payment`);
    }
  }

  if (!event) return <View style={[styles.container, { paddingTop: insets.top }]} />;

  const priceLabel = event.is_free ? 'Free' : `€${event.price}`;
  const timeLabel = formatDate(event.date) + ' · ' + event.time;

  return (
    <View style={styles.container}>
      <Toast
        visible={toast}
        title="You're in"
        subtitle="See you out there."
        onHide={() => setToast(false)}
      />

      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover */}
        <Animated.View style={[styles.cover, coverStyle]}>
          {event.cover_url ? (
            <Image source={{ uri: event.cover_url }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: Colors.lime }]} />
          )}
          {/* Time badge */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{timeLabel.toUpperCase()}</Text>
          </View>
          {/* Back button */}
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 12 }]} onPress={() => router.back()}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Content */}
        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.price}>{priceLabel}</Text>
            </View>
            <Text style={styles.meta}>{event.venue}  {event.going_count} going  {priceLabel !== 'Free' ? priceLabel : ''}</Text>

            <View style={styles.tags}>
              {event.category && <Tag label={event.category} small />}
            </View>

            {event.tagline && (
              <View style={styles.aboutSection}>
                <Text style={styles.aboutTitle}>About</Text>
                <Text style={styles.aboutText}>{event.tagline}</Text>
              </View>
            )}

            {/* Creator */}
            {creator && (
              <View style={styles.creatorRow}>
                <View style={styles.creatorAvatar}>
                  <Text style={styles.creatorInitial}>{creator.name?.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.creatorLabel}>Hosted by</Text>
                  <Text style={styles.creatorName}>{creator.name}</Text>
                </View>
              </View>
            )}

            {/* Chat button */}
            {isAttending && (
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => router.push(`/chat/${id}`)}
              >
                <Text style={styles.chatBtnText}>💬  Event group chat</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </AnimatedScrollView>

      {/* Fixed bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + 16 }]}>
        {!user ? (
          <View style={styles.loggedOutBox}>
            <Text style={styles.loggedOutTitle}>Log in to join event</Text>
            <Text style={styles.loggedOutSub}>Your kind of people are already out. Create account to join them.</Text>
          </View>
        ) : null}

        {user && isAttending ? (
          <Button label="You're going ✓" onPress={() => {}} variant="lime" disabled />
        ) : (
          <Button
            label={user ? `Join them${event.is_free ? '' : ` · ${priceLabel}`}` : 'Get Woeva'}
            onPress={handleJoin}
            loading={loading}
            variant={user ? 'lime' : 'lime'}
          />
        )}

        {!user && (
          <Button label="I have an account" onPress={() => router.push('/(auth)/login')} variant="ghost" />
        )}
      </View>
    </View>
  );
}

function formatDate(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'TONIGHT';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  cover: { height: 280, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  timeBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: Colors.black,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  timeBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: Colors.black, fontWeight: '600' },
  content: { padding: 20, gap: 0 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.black, letterSpacing: -0.5, flex: 1 },
  price: { fontSize: 22, fontWeight: '700', color: Colors.black, marginLeft: 12 },
  meta: { fontSize: 13, color: Colors.gray, marginBottom: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  aboutSection: { marginBottom: 20 },
  aboutTitle: { fontSize: 18, fontWeight: '700', color: Colors.black, marginBottom: 8 },
  aboutText: { fontSize: 15, color: Colors.gray, lineHeight: 22 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.grayLight, borderRadius: 12, marginBottom: 16 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 18, fontWeight: '700', color: Colors.black },
  creatorLabel: { fontSize: 11, color: Colors.gray, fontWeight: '500' },
  creatorName: { fontSize: 15, fontWeight: '600', color: Colors.black },
  chatBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.black, borderRadius: 14, justifyContent: 'center' },
  chatBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  bottomCta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8 },
  loggedOutBox: { backgroundColor: Colors.black, borderRadius: 14, padding: 14, marginBottom: 8 },
  loggedOutTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, textAlign: 'center' },
  loggedOutSub: { fontSize: 12, color: Colors.gray, textAlign: 'center', marginTop: 4 },
});
