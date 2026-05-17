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
import { useTranslations } from '@/context/LanguageContext';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslations();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Event[]>([]);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [mapEvents, setMapEvents] = useState<Event[]>([]);

  useEffect(() => {
    loadMapEvents();
  }, []);

  async function loadMapEvents() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('events')
      .select('*')
      .neq('status', 'cancelled')
      .gte('date', today)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('date', { ascending: true })
      .limit(200);

    // Pre každú unikátnu lokáciu ukáž iba najbližší event
    const seen = new Map<string, any>();
    for (const e of (data ?? [])) {
      const key = `${(e.lat as number).toFixed(4)}_${(e.lng as number).toFixed(4)}`;
      if (!seen.has(key)) seen.set(key, e);
    }
    setMapEvents(Array.from(seen.values()));
  }

  async function handleSearch() {
    if (!query.trim()) return;
    const { data } = await supabase
      .from('events')
      .select('*, attendees:event_attendees(profile:profiles(id, name, avatar_url))')
      .or(`title.ilike.%${query}%,category.ilike.%${query}%,venue.ilike.%${query}%`)
      .limit(20);
    setResults(((data ?? []) as any).filter((e: any) => e.status !== 'cancelled'));
    setSearched(true);
    setMode('list');
  }

  const headerHeight = insets.top + 120;

  return (
    <View style={styles.container}>
      {/* Map — full screen */}
      {mode === 'map' && (
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 48.1486,
            longitude: 17.1077,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          customMapStyle={mapStyle}
          legalLabelInsets={{ bottom: -999, left: 0, top: 0, right: 0 }}
        >
          {mapEvents.map((event) => (
            <Marker
              key={event.id}
              coordinate={{ latitude: event.lat!, longitude: event.lng! }}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              <View style={styles.pin}>
                <Text style={styles.pinIcon}>◎</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Floating header */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <WMark size={34} color={Colors.lime} />
          </TouchableOpacity>
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>{t.search.discover}</Text>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder={t.search.searchBarPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        </View>
      </View>

      {/* List results */}
      {mode === 'list' && searched && (
        <View style={[styles.listContainer, { paddingTop: headerHeight }]}>
          <TouchableOpacity style={styles.backToMap} onPress={() => { setMode('map'); setSearched(false); setQuery(''); }} activeOpacity={0.8}>
            <Text style={styles.backToMapText}>← Mapa</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 80 }]}>
            {results.length === 0 ? (
              <Animated.View entering={FadeInDown} style={styles.empty}>
                <Text style={styles.emptyTitle}>{t.search.nothingMatches}</Text>
                <Text style={styles.emptyText}>{t.search.nothingMatchesFor(query)}</Text>
                <View style={styles.emptyActions}>
                  <Button label={t.search.startClub(query)} onPress={() => router.push('/club/create')} variant="lime" />
                  <Button label={t.search.browsePopular} onPress={() => { setMode('map'); setSearched(false); setQuery(''); }} variant="ghost" />
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
        </View>
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
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  topBar: { alignItems: 'center', paddingVertical: 10 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white, marginBottom: 12, letterSpacing: -0.5 },
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 50,
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchInput: { fontSize: 15, color: Colors.white },
  listContainer: { flex: 1, backgroundColor: Colors.white },
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
  backToMap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, alignSelf: 'flex-start', backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 8 },
  backToMapText: { fontSize: 13, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  results: { padding: 20, paddingBottom: 40 },
  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 4 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.black },
  emptyText: { fontSize: 15, color: Colors.gray, textAlign: 'center', lineHeight: 22 },
  emptyActions: { width: '100%', gap: 10, marginTop: 16 },
});
