import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { WMark } from '@/components/ui/WMark';
import { EventCard } from '@/components/ui/EventCard';
import { Tag } from '@/components/ui/Tag';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { useAuth } from '@/hooks/useAuth';


const FILTER_TAGS = ['All', 'Coffee', 'Sport', 'Party', 'Music', 'Art', 'Yoga'];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const [city, setCity] = useState('');

  useEffect(() => {
    (async () => {
      // Try profile city first
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        const { data } = await supabase.from('profiles').select('city').eq('id', u.id).single();
        if (data?.city) { setCity(data.city); return; }
      }
      // Fallback to GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setCity('Your city'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      setCity(geo?.city ?? geo?.region ?? 'Your city');
    })();
  }, []);

  useEffect(() => { loadEvents(); }, [filter]);

  async function loadEvents() {
    let query = supabase.from('events').select('*').order('date', { ascending: true }).limit(30);
    if (filter !== 'All') query = query.eq('category', filter);
    const { data } = await query;
    setEvents(data ?? []);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  const featured = events[0];
  const rest = events.slice(1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar: W logo centered, avatar right */}
        <View style={styles.topBar}>
          <View style={styles.topBarSide} />
          <WMark size={34} color={Colors.lime} />
          <View style={styles.topBarSide}>
            <TouchableOpacity style={styles.avatar} onPress={() => router.push('/settings/index')}>
              <View style={styles.avatarCircle} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {}}>
            <Text style={styles.cityLabel}>▾  {city}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Your city is moving</Text>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTER_TAGS.map(tag => (
            <Tag
              key={tag}
              label={tag}
              selected={filter === tag}
              onPress={() => setFilter(tag)}
              small
              floatDelay={-1}
            />
          ))}
        </ScrollView>

        {/* Featured event */}
        {featured && (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.featured}>
            <EventCard event={featured} featured />
          </Animated.View>
        )}

        {/* Event list */}
        <View style={styles.list}>
          {rest.map((event, i) => (
            <Animated.View key={event.id} entering={FadeInDown.delay(i * 60 + 200).springify()}>
              <EventCard event={event} />
              {i < rest.length - 1 && <View style={styles.divider} />}
            </Animated.View>
          ))}
          {events.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>Be the first to create an event in {city}.</Text>
            </View>
          )}
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingBottom: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  topBarSide: { flex: 1, alignItems: 'flex-end' },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  cityLabel: { fontSize: 18, color: Colors.gray, fontWeight: '500', fontFamily: Fonts.medium, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, letterSpacing: -0.5, fontFamily: Fonts.bold },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.lime },
  filters: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  featured: { marginHorizontal: 20, marginBottom: 20 },
  list: { paddingHorizontal: 20 },
  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 2 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  emptyText: { fontSize: 14, color: Colors.gray, textAlign: 'center', fontFamily: Fonts.regular },
});
