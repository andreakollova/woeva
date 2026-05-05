import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { WMark } from '@/components/ui/WMark';
import { Fonts } from '@/constants/fonts';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Event[]>([]);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [mapEvents, setMapEvents] = useState<Event[]>([]);

  useEffect(() => {
    loadMapEvents();
  }, []);

  async function loadMapEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .limit(50);
    setMapEvents(data ?? []);
  }

  async function handleSearch() {
    if (!query.trim()) return;
    const { data } = await supabase
      .from('events')
      .select('*')
      .or(`title.ilike.%${query}%,category.ilike.%${query}%,venue.ilike.%${query}%`)
      .limit(20);
    setResults(data ?? []);
    setSearched(true);
    setMode('list');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
          <WMark size={34} color={Colors.lime} />
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Yoga, run, club, event"
            placeholderTextColor={Colors.gray}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {mode === 'map' && (
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 48.1486,
            longitude: 17.1077,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          customMapStyle={mapStyle}
        >
          {mapEvents.map((event, i) => (
            <Marker
              key={event.id}
              coordinate={{
                latitude: event.lat ?? (48.1486 + (i % 5) * 0.003 - 0.006),
                longitude: event.lng ?? (17.1077 + (i % 3) * 0.004 - 0.004),
              }}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              <View style={styles.pin}>
                <Text style={styles.pinIcon}>◎</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {mode === 'list' && searched && (
        <ScrollView contentContainerStyle={styles.results}>
          {results.length === 0 ? (
            <Animated.View entering={FadeInDown} style={styles.empty}>
              <View style={styles.emptyDot} />
              <Text style={styles.emptyTitle}>Nothing matches</Text>
              <Text style={styles.emptyText}>
                No {query} yet in your city. Want to start it?
              </Text>
              <View style={styles.emptyActions}>
                <Button
                  label={`Start a ${query} club`}
                  onPress={() => router.push('/club/create/index')}
                  variant="lime"
                />
                <Button
                  label="Browse popular"
                  onPress={() => { setMode('map'); setSearched(false); setQuery(''); }}
                  variant="ghost"
                />
              </View>
            </Animated.View>
          ) : (
            results.map((event, i) => (
              <Animated.View key={event.id} entering={FadeInDown.delay(i * 50)}>
                <EventCard event={event} />
                {i < results.length - 1 && <View style={styles.divider} />}
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const mapStyle = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8FF00' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F0F0F0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  topBar: { alignItems: 'center', paddingVertical: 10 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 12, letterSpacing: -0.5 },
  searchBar: {
    backgroundColor: Colors.grayLight,
    borderRadius: 50,
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
  },
  searchInput: { fontSize: 15, color: Colors.black },
  map: { flex: 1 },
  pin: {
    backgroundColor: Colors.lime,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  pinIcon: { fontSize: 16, color: Colors.black },
  results: { padding: 20, paddingBottom: 40 },
  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 4 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.grayLight, marginBottom: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.black },
  emptyText: { fontSize: 15, color: Colors.gray, textAlign: 'center', lineHeight: 22 },
  emptyActions: { width: '100%', gap: 10, marginTop: 16 },
});
