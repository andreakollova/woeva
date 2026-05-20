import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Svg, { Path, Line } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Event, Club } from '@/types';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { Fonts } from '@/constants/fonts';
import { useTranslations } from '@/context/LanguageContext';
import { expandRecurringEvents } from '@/lib/expandRecurring';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/context/AuthContext';

type Tab = 'events' | 'clubs';
type PriceFilter = 'all' | 'paid' | 'free';

type ClubWithLocation = Club & { lat?: number | null; lng?: number | null; address?: string | null };

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslations();
  const { categories } = useCategories();
  const { profile } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Event[]>([]);
  const [clubResults, setClubResults] = useState<ClubWithLocation[]>([]);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [tab, setTab] = useState<Tab>('events');
  const [mapEvents, setMapEvents] = useState<Event[]>([]);
  const [mapClubs, setMapClubs] = useState<ClubWithLocation[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [headerHeight, setHeaderHeight] = useState(insets.top + 220);
  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
  const pendingFitRef = useRef<{ latitude: number; longitude: number }[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilter = selectedTags.length > 0 || priceFilter !== 'all';

  function fitMarkersToView(coords: { latitude: number; longitude: number }[]) {
    if (coords.length === 0) return;
    const lats = coords.map(c => c.latitude);
    const lngs = coords.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.min(Math.max((maxLat - minLat) * 1.6, 0.06), 0.45);
    const lngDelta = Math.min(Math.max((maxLng - minLng) * 1.6, 0.06), 0.45);
    const region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
    if (mapReadyRef.current) {
      mapRef.current?.animateToRegion(region, 600);
    } else {
      pendingFitRef.current = coords;
    }
  }

  function onMapReady() {
    mapReadyRef.current = true;
    if (pendingFitRef.current) {
      fitMarkersToView(pendingFitRef.current);
      pendingFitRef.current = null;
    }
  }

  useFocusEffect(useCallback(() => {
    loadMapEvents();
    loadMapClubs();
  }, [profile?.city]));

  async function loadMapEvents() {
    const today = new Date().toISOString().split('T')[0];
    const userCity = profile?.city;
    let q = supabase
      .from('events')
      .select('*')
      .neq('status', 'cancelled')
      .gte('date', today)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('date', { ascending: true })
      .limit(200);
    if (userCity) q = q.ilike('city', `%${userCity}%`);
    const { data } = await q;

    const seen = new Map<string, any>();
    for (const e of (data ?? [])) {
      const key = `${(e.lat as number).toFixed(4)}_${(e.lng as number).toFixed(4)}`;
      if (!seen.has(key)) seen.set(key, e);
    }
    const events = Array.from(seen.values());
    setMapEvents(events);
    if (events.length > 0) {
      fitMarkersToView(events.map(e => ({ latitude: e.lat!, longitude: e.lng! })));
    }
  }

  async function loadMapClubs() {
    const userCity = profile?.city;
    let q = supabase
      .from('clubs')
      .select('id, name, tagline, lat, lng, cover_url, logo_url, member_count, category')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(200);
    if (userCity) q = q.ilike('city', `%${userCity}%`);
    const { data } = await q;
    const clubs = (data ?? []) as ClubWithLocation[];
    setMapClubs(clubs);
    if (clubs.length > 0) {
      fitMarkersToView(clubs.map(c => ({ latitude: c.lat!, longitude: c.lng! })));
    }
  }

  const filteredMapEvents = useCallback(() => {
    return mapEvents.filter(e => {
      if (selectedTags.length > 0 && !selectedTags.some(tag => e.tags?.includes(tag) || e.category === tag)) return false;
      if (priceFilter === 'paid' && e.is_free) return false;
      if (priceFilter === 'free' && !e.is_free) return false;
      return true;
    });
  }, [mapEvents, selectedTags, priceFilter]);

  const filteredMapClubs = useCallback(() => {
    return mapClubs.filter(c => {
      if (selectedTags.length > 0 && !selectedTags.some(tag => c.tags?.includes(tag) || c.category === tag)) return false;
      return true;
    });
  }, [mapClubs, selectedTags]);

  async function handleSearch(searchQuery?: string) {
    const q = (searchQuery ?? query).trim();
    if (!q) return;
    if (tab === 'events') {
      const { data } = await supabase
        .from('events')
        .select('*, attendees:event_attendees(profile:profiles(id, name, avatar_url))')
        .or(`title.ilike.%${q}%,category.ilike.%${q}%,venue.ilike.%${q}%`)
        .limit(20);
      let filtered = expandRecurringEvents(((data ?? []) as any).filter((e: any) => e.status !== 'cancelled'));
      if (selectedTags.length > 0) filtered = filtered.filter((e: Event) => selectedTags.some(tag => e.tags?.includes(tag) || e.category === tag));
      if (priceFilter === 'paid') filtered = filtered.filter((e: Event) => !e.is_free);
      if (priceFilter === 'free') filtered = filtered.filter((e: Event) => e.is_free);
      setResults(filtered);
    } else {
      const { data } = await supabase
        .from('clubs')
        .select('*')
        .or(`name.ilike.%${q}%,tagline.ilike.%${q}%,category.ilike.%${q}%`)
        .limit(20);
      let filtered = (data ?? []) as ClubWithLocation[];
      if (selectedTags.length > 0) filtered = filtered.filter(c => selectedTags.some(tag => c.tags?.includes(tag) || c.category === tag));
      setClubResults(filtered);
    }
    setSearched(true);
    setMode('list');
  }

  function onSearchChange(text: string) {
    setQuery(text);
    if (!text.trim()) {
      setMode('map');
      setSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(text), 350);
  }

  function clearFilter() {
    setSelectedTags([]);
    setPriceFilter('all');
    setShowFilter(false);
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }


  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Map — full screen */}
      {mode === 'map' && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 48.1486,
            longitude: 17.1077,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          customMapStyle={mapStyle}
          legalLabelInsets={{ bottom: -9999, left: -9999, top: 0, right: 0 }}
          onMapReady={onMapReady}
        >
          {tab === 'events' && filteredMapEvents().map((event) => (
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
          {tab === 'clubs' && filteredMapClubs().map((club) => (
            <Marker
              key={club.id}
              coordinate={{ latitude: club.lat!, longitude: club.lng! }}
              onPress={() => router.push(`/club/${club.id}`)}
            >
              <View style={styles.clubPin}>
                <Text style={styles.clubPinText}>●</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Floating header */}
      <View
        style={[styles.floatingHeader, { paddingTop: insets.top }]}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.header}>
          {/* Top row: title + filter */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t.search.discover}</Text>
            <TouchableOpacity
              style={[styles.filterBtn, hasActiveFilter && styles.filterBtnActive]}
              onPress={() => setShowFilter(true)}
              activeOpacity={0.8}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Line x1="3" y1="6" x2="21" y2="6" stroke={hasActiveFilter ? Colors.black : 'rgba(255,255,255,0.85)'} strokeWidth={2} strokeLinecap="round" />
                <Line x1="7" y1="12" x2="17" y2="12" stroke={hasActiveFilter ? Colors.black : 'rgba(255,255,255,0.85)'} strokeWidth={2} strokeLinecap="round" />
                <Line x1="10" y1="18" x2="14" y2="18" stroke={hasActiveFilter ? Colors.black : 'rgba(255,255,255,0.85)'} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              {hasActiveFilter && <View style={styles.filterDot} />}
            </TouchableOpacity>
          </View>

          {/* Toggle */}
          <View style={styles.togglePill}>
            <TouchableOpacity
              style={[styles.toggleBtn, tab === 'events' && styles.toggleBtnActive]}
              onPress={() => { setTab('events'); setSearched(false); setMode('map'); setTimeout(() => fitMarkersToView(mapEvents.filter(e => e.lat && e.lng).map(e => ({ latitude: e.lat!, longitude: e.lng! }))), 50); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, tab === 'events' && styles.toggleTextActive]}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, tab === 'clubs' && styles.toggleBtnActive]}
              onPress={() => { setTab('clubs'); setSearched(false); setMode('map'); loadMapClubs(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, tab === 'clubs' && styles.toggleTextActive]}>Clubs</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
              <Path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder={tab === 'events' ? t.search.searchBarPlaceholder : 'Search clubs...'}
              placeholderTextColor="rgba(255,255,255,0.38)"
              value={query}
              onChangeText={onSearchChange}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setMode('map'); setSearched(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* List results */}
      {mode === 'list' && searched && (
        <View style={[styles.listContainer, { paddingTop: headerHeight }]}>
          <TouchableOpacity
            style={styles.backToMap}
            onPress={() => { setMode('map'); setSearched(false); setQuery(''); }}
            activeOpacity={0.8}
          >
            <Text style={styles.backToMapText}>← Map</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 80 }]}>
            {tab === 'events' && (
              results.length === 0 ? (
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
              )
            )}
            {tab === 'clubs' && (
              clubResults.length === 0 ? (
                <Animated.View entering={FadeInDown} style={styles.empty}>
                  <Text style={styles.emptyTitle}>No clubs found</Text>
                  <Text style={styles.emptyText}>Try a different search or create your own club.</Text>
                  <View style={styles.emptyActions}>
                    <Button label="Create a club" onPress={() => router.push('/club/create')} variant="lime" />
                  </View>
                </Animated.View>
              ) : (
                clubResults.map((club, i) => (
                  <Animated.View key={club.id} entering={FadeInDown.delay(i * 50)}>
                    <TouchableOpacity style={styles.clubRow} onPress={() => router.push(`/club/${club.id}`)} activeOpacity={0.8}>
                      <View style={styles.clubRowDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clubRowName}>{club.name}</Text>
                        {club.tagline ? <Text style={styles.clubRowTagline}>{club.tagline}</Text> : null}
                      </View>
                      <Text style={styles.clubRowMembers}>{club.member_count} members</Text>
                    </TouchableOpacity>
                    {i < clubResults.length - 1 && <View style={styles.divider} />}
                  </Animated.View>
                ))
              )
            )}
          </ScrollView>
        </View>
      )}

      {/* Filter modal */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilter(false)} />
        <Animated.View entering={FadeIn.duration(180)} style={[styles.filterSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.filterHandle} />

          <Text style={styles.filterTitle}>Filter</Text>

          {/* Paid/Free — only for events */}
          {tab === 'events' && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Price</Text>
              <View style={styles.filterRow}>
                {(['all', 'free', 'paid'] as PriceFilter[]).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.filterChip, priceFilter === opt && styles.filterChipActive]}
                    onPress={() => setPriceFilter(opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, priceFilter === opt && styles.filterChipTextActive]}>
                      {opt === 'all' ? 'All' : opt === 'free' ? 'Free' : 'Paid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tags */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Categories</Text>
            <View style={styles.filterChipsWrap}>
              {categories.map(cat => {
                const active = selectedTags.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => toggleTag(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity onPress={clearFilter} style={styles.clearBtn} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFilter(false)} style={styles.applyBtn} activeOpacity={0.8}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
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
  container: { flex: 1, backgroundColor: Colors.black },
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(8,8,8,0.96)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  header: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 34, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white, letterSpacing: -1 },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50,
    padding: 4,
    marginBottom: 12,
  },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 50, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.lime },
  toggleText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)', fontFamily: Fonts.semibold },
  toggleTextActive: { color: Colors.black, fontWeight: '700', fontFamily: Fonts.bold },
  filterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.lime },
  filterDot: {
    position: 'absolute', top: 7, right: 7,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.black,
  },
  searchBar: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.white, fontFamily: Fonts.regular },
  searchClear: { fontSize: 13, color: 'rgba(255,255,255,0.4)', paddingLeft: 8 },
  listContainer: { flex: 1, backgroundColor: Colors.white },
  pin: {
    backgroundColor: Colors.lime,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  pinIcon: { fontSize: 16, color: Colors.black },
  clubPin: {
    backgroundColor: Colors.black,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  clubPinText: { fontSize: 12, color: Colors.white },
  backToMap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 8, alignSelf: 'flex-start',
    backgroundColor: Colors.black, borderRadius: 50,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  backToMapText: { fontSize: 13, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  results: { padding: 20, paddingBottom: 40 },
  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 4 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: Colors.black },
  emptyText: { fontSize: 15, color: Colors.gray, textAlign: 'center', lineHeight: 22 },
  emptyActions: { width: '100%', gap: 10, marginTop: 16 },
  clubRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  clubRowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.black },
  clubRowName: { fontSize: 16, fontWeight: '700', color: Colors.black },
  clubRowTagline: { fontSize: 13, color: Colors.gray, marginTop: 2 },
  clubRowMembers: { fontSize: 12, color: Colors.gray },
  // Filter sheet
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  filterSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12,
    maxHeight: '80%',
  },
  filterHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 20 },
  filterTitle: { fontSize: 20, fontWeight: '700', color: Colors.black, marginBottom: 20 },
  filterSection: { marginBottom: 24 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: Colors.grayLight,
    borderWidth: 1.5, borderColor: Colors.grayBorder,
  },
  filterChipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  filterChipText: { fontSize: 13, color: Colors.gray, fontWeight: '500' },
  filterChipTextActive: { color: Colors.white, fontWeight: '700' },
  filterActions: { flexDirection: 'row', gap: 12, paddingTop: 8 },
  clearBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 50,
    borderWidth: 1.5, borderColor: Colors.grayBorder,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: 15, fontWeight: '600', color: Colors.gray },
  applyBtn: { flex: 1, paddingVertical: 14, borderRadius: 50, backgroundColor: Colors.black, alignItems: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
