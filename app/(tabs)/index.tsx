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


const FILTER_TAGS = ['My Interests', 'Free', 'Coffee', 'Sport', 'Party', 'Music', 'Art', 'Yoga', 'All Events'];

// Maps UI filter label → DB category values (case-insensitive via multiple values)
const TAG_CATEGORIES: Record<string, string[]> = {
  Coffee: ['coffee'],
  Sport:  ['sport', 'zapasy'],
  Party:  ['party', 'dancing'],
  Music:  ['music', 'umenie'],
  Art:    ['umenie', 'historia'],
  Yoga:   ['sport'],
};

const SK_MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatMonth(dateStr: string, lang: string): string {
  const [year, month] = dateStr.split('-');
  const m = parseInt(month, 10) - 1;
  const name = lang === 'sk' ? SK_MONTHS[m] : EN_MONTHS[m];
  return `${name} ${year}`;
}

const COUNTRY_META: { code: string; flag: string; name: string }[] = [
  { code: 'SK', flag: '🇸🇰', name: 'Slovensko' },
  { code: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
];

const FALLBACK_CITIES: { code: string; flag: string; name: string; cities: string[] }[] = [
  { code: 'SK', flag: '🇸🇰', name: 'Slovensko', cities: ['Bratislava', 'Košice', 'Nitra'] },
  { code: 'AT', flag: '🇦🇹', name: 'Austria', cities: ['Vienna'] },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic', cities: ['Prague'] },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', cities: ['London'] },
];

const COUNTRY_NAMES_SK: Record<string, string> = {
  SK: 'Slovensko', AT: 'Rakúsko', CZ: 'Česká republika', GB: 'Spojené kráľovstvo',
};
const COUNTRY_NAMES_EN: Record<string, string> = {
  SK: 'Slovakia', AT: 'Austria', CZ: 'Czech Republic', GB: 'United Kingdom',
};
const CITY_DISPLAY_SK: Record<string, string> = {
  Vienna: 'Viedeň', Prague: 'Praha', London: 'Londýn',
  Bratislava: 'Bratislava', Košice: 'Košice', Nitra: 'Nitra',
};
const CITY_DISPLAY_EN: Record<string, string> = {
  Vienna: 'Vienna', Prague: 'Prague', London: 'London',
  Bratislava: 'Bratislava', Košice: 'Košice', Nitra: 'Nitra',
};

// city → country mapping for grouping
const CITY_COUNTRY: Record<string, string> = {
  Bratislava: 'SK', Košice: 'SK', Prešov: 'SK', Žilina: 'SK', Nitra: 'SK',
  'Banská Bystrica': 'SK', Trnava: 'SK', Trenčín: 'SK', Martin: 'SK', Poprad: 'SK',
  Vienna: 'AT', Wien: 'AT',
  Prague: 'CZ', Praha: 'CZ',
  London: 'GB',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user, refetchProfile } = useAuth();
  const { t, lang } = useTranslations();
  const countryNames = lang === 'sk' ? COUNTRY_NAMES_SK : COUNTRY_NAMES_EN;
  const cityDisplay = lang === 'sk' ? CITY_DISPLAY_SK : CITY_DISPLAY_EN;
  const avatarInitial = (profile?.name || (user as any)?.user_metadata?.full_name || '?').charAt(0).toUpperCase();
  const [avatarError, setAvatarError] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('My Interests');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [city, setCity] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(['SK']));
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [availableCities, setAvailableCities] = useState<{ code: string; flag: string; name: string; cities: string[] }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: cityRows } = await supabase
          .from('events')
          .select('city, country')
          .neq('status', 'cancelled')
          .gte('date', today)
          .not('city', 'is', null);

        const citySet = new Set<string>((cityRows ?? []).map((r: any) => r.city).filter(Boolean));
        const grouped = COUNTRY_META.map(c => ({
          ...c,
          cities: [...citySet].filter(city => (CITY_COUNTRY[city] ?? 'SK') === c.code).sort(),
        })).filter(c => c.cities.length > 0);
        setAvailableCities(grouped);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
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
      } catch (_) { setCity('Your city'); }
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
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    let query = supabase.from('events').select('*, club:clubs(id, name, cover_url), creator:profiles!creator_id(id, name, avatar_url), attendees:event_attendees(profile:profiles(id, name, avatar_url))').or(`date.gte.${today},and(is_recurring.eq.true,recurring_end_date.gte.${today})`).order('date', { ascending: true }).limit(50);
    if (filter === 'Free') query = query.eq('is_free', true);
    else if (filter !== 'My Interests' && filter !== 'All Events') {
      const cats = TAG_CATEGORIES[filter];
      if (cats) {
        if (cats.length === 1) query = query.eq('category', cats[0]);
        else query = query.or(cats.map(c => `category.eq.${c}`).join(','));
      }
    }
    // All filters (including All Events) filter by city
    if (city && city !== 'Your city' && city !== 'Select city') query = query.eq('city', city);
    const { data } = await query;
    const now = new Date();
    setEvents(((data ?? []) as any).filter((e: any) => {
      if (e.status === 'cancelled') return false;
      if (!e.date || !e.time) return true;
      const start = new Date(`${e.date}T${e.time}`);
      const durationH = e.duration ?? 3;
      const hideAfter = new Date(start.getTime() + (durationH + 3) * 60 * 60 * 1000);
      return now < hideAfter;
    }));

    if (user) {
      const { data: att } = await supabase.from('event_attendees').select('event_id').eq('user_id', user.id);
      setAttendingIds(new Set((att ?? []).map((a: any) => a.event_id)));
    }
    setLoading(false);
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
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
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
              label={tag === 'My Interests' ? 'My Interests' : tag === 'All Events' ? 'All Events' : tag === 'Free' ? t.home.free : tag}
              selected={filter === tag}
              onPress={() => setFilter(tag)}
              small
              floatDelay={-1}
            />
          ))}
        </ScrollView>

        {/* Featured event */}
        {loading ? (
          <View style={[styles.featured, styles.skeletonFeatured]} />
        ) : featured ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.featured}>
            <EventCard event={featured} featured attending={attendingIds.has(featured.id)} />
          </Animated.View>
        ) : null}

        {/* Event list */}
        <View style={styles.list}>
        {loading && [0,1,2,3].map(i => (
          <View key={i} style={styles.skeletonRow}>
            <View style={styles.skeletonDate} />
            <View style={styles.skeletonInfo}>
              <View style={[styles.skeletonLine, { width: '70%' }]} />
              <View style={[styles.skeletonLine, { width: '45%', marginTop: 6 }]} />
            </View>
            <View style={styles.skeletonThumb} />
          </View>
        ))}
          {rest.map((event, i) => {
            const prevEvent = i === 0 ? featured : rest[i - 1];
            const curMonth = event.date?.slice(0, 7);
            const prevMonth = prevEvent?.date?.slice(0, 7);
            const showMonthDivider = curMonth && curMonth !== prevMonth;
            return (
              <React.Fragment key={event.id}>
                {showMonthDivider && (
                  <View style={styles.monthDivider}>
                    <View style={styles.monthDividerAccent} />
                    <Text style={styles.monthDividerText}>{formatMonth(event.date!, lang)}</Text>
                    <View style={styles.monthDividerLine} />
                  </View>
                )}
                <View>
                  <EventCard event={event} attending={attendingIds.has(event.id)} />
                  {i < rest.length - 1 && !(() => {
                    const next = rest[i + 1];
                    return next?.date?.slice(0, 7) !== event.date?.slice(0, 7);
                  })() && <View style={styles.divider} />}
                </View>
              </React.Fragment>
            );
          })}
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
            {(availableCities.length > 0 ? availableCities : FALLBACK_CITIES).map((country) => {
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
                    <Text style={styles.countryName}>{countryNames[country.code] ?? country.name}</Text>
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
                      <Text style={[styles.cityModalLabel, city === c && styles.cityModalLabelActive]}>{cityDisplay[c] ?? c}</Text>
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
  scroll: { paddingBottom: 20 }, // overridden inline with insets
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
  monthDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8, gap: 8 },
  monthDividerAccent: { width: 18, height: 2, borderRadius: 2, backgroundColor: Colors.lime },
  monthDividerLine: { flex: 1, height: 2, borderRadius: 2, backgroundColor: Colors.lime },
  monthDividerText: { fontSize: 11, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, letterSpacing: 1, textTransform: 'uppercase' },
  skeletonFeatured: { height: 240, backgroundColor: Colors.grayLight, borderRadius: 20, marginHorizontal: 20, marginBottom: 20 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  skeletonDate: { width: 52, height: 64, borderRadius: 12, backgroundColor: Colors.grayLight },
  skeletonInfo: { flex: 1, gap: 0 },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: Colors.grayLight },
  skeletonThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: Colors.grayLight },
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
