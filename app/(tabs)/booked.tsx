import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { WMark } from '@/components/ui/WMark';
import { useAuth } from '@/hooks/useAuth';

export default function BookedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadEvents(); }, [tab, user]);

  async function loadEvents() {
    if (!user) return;
    const now = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('event_attendees')
      .select('event:events(*)')
      .eq('user_id', user.id);

    const allEvents = (data ?? []).map((r: any) => r.event).filter(Boolean);
    const filtered = tab === 'upcoming'
      ? allEvents.filter((e: Event) => e.date >= now)
      : allEvents.filter((e: Event) => e.date < now);
    setEvents(filtered);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Woeva w logo */}
      <View style={styles.topBar}>
        <WMark size={34} color={Colors.lime} />
      </View>

      <Text style={styles.title}>My events</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
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
            <Text style={styles.emptyTitle}>Nothing planned</Text>
            <Text style={styles.emptyText}>Your calendar is empty. Let's change that.</Text>
            <Button label="Discover events" onPress={() => router.push('/(tabs)/search')} variant="lime" style={styles.cta} />
          </Animated.View>
        ) : (
          events.map((event, i) => (
            <Animated.View key={event.id} entering={FadeInDown.delay(i * 60)}>
              <EventCard event={event} featured />
              <View style={{ height: 12 }} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  topBar: { alignItems: 'center', paddingTop: 8, marginBottom: 4 },
  logoW: { fontSize: 24, fontWeight: '800', color: Colors.lime, letterSpacing: -1 },
  title: { fontSize: 26, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, paddingHorizontal: 20, marginBottom: 16, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight },
  tabBtnActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyDot: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.grayLight, marginBottom: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  emptyText: { fontSize: 15, color: Colors.gray, textAlign: 'center', lineHeight: 22, fontFamily: Fonts.regular },
  cta: { marginTop: 8, width: '100%' },
});
