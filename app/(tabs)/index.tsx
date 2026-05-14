import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, Modal, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Location from 'expo-location';
import Svg, { Path, Circle } from 'react-native-svg';
import { WMark } from '@/components/ui/WMark';
import { EventCard } from '@/components/ui/EventCard';
import { Tag } from '@/components/ui/Tag';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';


const FILTER_TAGS = ['All', 'Free', 'Coffee', 'Sport', 'Party', 'Music', 'Art', 'Yoga'];

const COUNTRY_CITIES: { code: string; flag: string; name: string; cities: string[] }[] = [
  { code: 'SK', flag: '🇸🇰', name: 'Slovensko', cities: ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica', 'Trnava', 'Trenčín', 'Martin', 'Poprad'] },
  { code: 'AT', flag: '🇦🇹', name: 'Austria', cities: ['Vienna'] },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic', cities: ['Prague'] },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', cities: ['London'] },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user, refetchProfile } = useAuth();
  const { t } = useTranslations();
  const avatarInitial = (profile?.name || (user as any)?.user_metadata?.full_name || '?').charAt(0).toUpperCase();
  const [avatarError, setAvatarError] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const [city, setCity] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(['SK']));
  const [unreadNotifs, setUnreadNotifs] = useState(0);

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

  useFocusEffect(useCallback(() => {
    loadEvents();
    refetchProfile();
    if (user) {
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false)
        .then(({ count }) => setUnreadNotifs(count ?? 0));
    }
  }, [filter, city, user?.id]));

  async function loadEvents() {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('events').select('*, club:clubs(id, name, cover_url), attendees:event_attendees(profile:profiles(id, name, avatar_url))').gte('date', today).order('date', { ascending: true }).limit(50);
    if (filter === 'Free') query = query.eq('is_free', true);
    else if (filter !== 'All') query = query.eq('category', filter);
    if (city && city !== 'Your city' && city !== 'Select city') query = query.eq('city', city);
    const { data } = await query;
    setEvents(((data ?? []) as any).filter((e: any) => e.status !== 'cancelled'));

    if (user) {
      const { data: att } = await supabase.from('event_attendees').select('event_id').eq('user_id', user.id);
      setAttendingIds(new Set((att ?? []).map((a: any) => a.event_id)));
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  async function selectCity(c: string) {
    setCity(c);
    setShowCityPicker(false);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) await supabase.from('profiles').upsert({ id: u.id, city: c });
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
            {user && (
              <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications' as any)}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                {unreadNotifs > 0 && <View style={styles.bellDot} />}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={StyleSheet.absoluteFill}
                    onError={() => {}}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowCityPicker(true)} style={styles.cityRow}>
            <Text style={styles.cityLabel}>{city || t.home.selectCity}</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M6 9l6 6 6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.title}>{t.home.yourCityMoving}</Text>
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
              label={tag === 'All' ? t.home.all : tag === 'Free' ? t.home.free : tag}
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
            <EventCard event={featured} featured attending={attendingIds.has(featured.id)} />
          </Animated.View>
        )}

        {/* Event list */}
        <View style={styles.list}>
          {rest.map((event, i) => (
            <Animated.View key={event.id} entering={FadeInDown.delay(i * 60 + 200).springify()}>
              <EventCard event={event} attending={attendingIds.has(event.id)} />
              {i < rest.length - 1 && <View style={styles.divider} />}
            </Animated.View>
          ))}
          {events.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t.home.noEvents}</Text>
              <Text style={styles.emptyText}>{t.home.noEventsInCity(city)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* City picker modal */}
      <Modal visible={showCityPicker} transparent animationType="slide" onRequestClose={() => setShowCityPicker(false)}>
        <TouchableOpacity style={styles.cityModalBg} activeOpacity={1} onPress={() => setShowCityPicker(false)}>
          <ScrollView
            style={styles.cityModalSheet}
            contentContainerStyle={styles.cityModalContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.cityModalHandle} />
            <Text style={styles.cityModalTitle}>{t.home.selectCity}</Text>
            {COUNTRY_CITIES.map((country) => {
              const isExpanded = expandedCountries.has(country.code);
              return (
                <View key={country.code}>
                  <TouchableOpacity
                    style={styles.countryRow}
                    onPress={() => {
                      setExpandedCountries(prev => {
                        const next = new Set(prev);
                        isExpanded ? next.delete(country.code) : next.add(country.code);
                        return next;
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.countryFlag}>{country.flag}</Text>
                    <Text style={styles.countryName}>{country.name}</Text>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                      <Path d="M6 9l6 6 6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                  {isExpanded && country.cities.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.cityModalRow, city === c && styles.cityModalRowActive]}
                      onPress={() => selectCity(c)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cityModalLabel, city === c && styles.cityModalLabelActive]}>{c}</Text>
                      {city === c && <Text style={styles.cityModalCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingBottom: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  topBarSide: { flex: 1, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  bellBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: Colors.white },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  cityLabel: { fontSize: 18, color: Colors.gray, fontWeight: '500', fontFamily: Fonts.medium },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, letterSpacing: -0.5, fontFamily: Fonts.bold },
  avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 15, fontWeight: '500', color: Colors.black, fontFamily: Fonts.medium },
  filters: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  featured: { marginHorizontal: 20, marginBottom: 20 },
  list: { paddingHorizontal: 20 },
  divider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 2 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  emptyText: { fontSize: 14, color: Colors.gray, textAlign: 'center', fontFamily: Fonts.regular },
  cityModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  cityModalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  cityModalContent: { paddingHorizontal: 24, paddingTop: 16 },
  cityModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 20 },
  cityModalTitle: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 12 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  countryFlag: { fontSize: 20 },
  countryName: { flex: 1, fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  cityModalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingLeft: 36, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  cityModalRowActive: { },
  cityModalLabel: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.black },
  cityModalLabelActive: { fontWeight: '700', fontFamily: Fonts.bold },
  cityModalCheck: { fontSize: 16, color: Colors.lime, fontWeight: '700' },
});
