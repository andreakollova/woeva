import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  RefreshControl, Image, Modal, Dimensions, Animated as RNAnimated, PanResponder,
} from 'react-native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { WMark } from '@/components/ui/WMark';
import { EventCard } from '@/components/ui/EventCard';
import { Tag } from '@/components/ui/Tag';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event, CATEGORY_SK } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import { expandRecurringEvents } from '@/lib/expandRecurring';
import { clubDisplayName } from '@/lib/formatVenue';

const { width: SW } = Dimensions.get('window');
const HERO_W = SW - 40;
const CARD_W = SW * 0.68;
const NEARBY_W = SW * 0.44;

const FILTER_TAGS = [
  'My Interests', 'Free',
  'Movement & Sport', 'Wellness & Body', 'Food & Drinks',
  'Art & Creation', 'Music & Nightlife', 'Learning & Mind',
  'Community & Belonging',
];

const SK_MONTHS_FULL = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];
const EN_MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SK_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Máj','Jún','Júl','Aug','Sep','Okt','Nov','Dec'];
const EN_MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SK_DAYS = ['Ne','Po','Ut','St','Št','Pi','So'];
const EN_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatMonth(dateStr: string, lang: string): string {
  const [year, month] = dateStr.split('-');
  const m = parseInt(month, 10) - 1;
  return `${lang === 'sk' ? SK_MONTHS_FULL[m] : EN_MONTHS_FULL[m]} ${year}`;
}

function fmtDate(d: string, lang: string): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  const days = lang === 'sk' ? SK_DAYS : EN_DAYS;
  const months = lang === 'sk' ? SK_MONTHS_SHORT : EN_MONTHS_SHORT;
  return `${days[dt.getDay()]}, ${dt.getDate()}. ${months[dt.getMonth()]}`;
}

function getCanonicalCategory(cat: string): string {
  if (!cat) return '';
  return (cat.split(',').find((c: string) => c.trim().includes('&')) ?? cat.split(',')[0]).trim();
}

const COUNTRY_META = [
  { code: 'SK', flag: '🇸🇰', name: 'Slovensko' },
  { code: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
];
const FALLBACK_CITIES = [
  { code: 'SK', flag: '🇸🇰', name: 'Slovensko', cities: ['Bratislava', 'Košice', 'Nitra'] },
  { code: 'AT', flag: '🇦🇹', name: 'Austria', cities: ['Vienna'] },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic', cities: ['Prague'] },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', cities: ['London'] },
];
const COUNTRY_NAMES_SK: Record<string,string> = { SK:'Slovensko', AT:'Rakúsko', CZ:'Česká republika', GB:'Spojené kráľovstvo' };
const COUNTRY_NAMES_EN: Record<string,string> = { SK:'Slovakia', AT:'Austria', CZ:'Czech Republic', GB:'United Kingdom' };
const CITY_DISPLAY_SK: Record<string,string> = { Vienna:'Viedeň', Prague:'Praha', London:'Londýn', Bratislava:'Bratislava', Košice:'Košice', Nitra:'Nitra' };
const CITY_DISPLAY_EN: Record<string,string> = { Vienna:'Vienna', Prague:'Prague', London:'London', Bratislava:'Bratislava', Košice:'Košice', Nitra:'Nitra' };
const CITY_NORMALIZE: Record<string,string> = { Praha:'Prague', Wien:'Vienna' };
const CITY_DB_ALIASES: Record<string, string[]> = {
  'Vienna': ['Vienna','Wien'],
  'Prague': ['Prague','Praha'],
  'London': ['London'],
};
const CITY_COUNTRY: Record<string,string> = {
  Bratislava:'SK', Košice:'SK', Prešov:'SK', Žilina:'SK', Nitra:'SK',
  'Banská Bystrica':'SK', Trnava:'SK', Trenčín:'SK', Martin:'SK', Poprad:'SK',
  Vienna:'AT', Wien:'AT', Prague:'CZ', Praha:'CZ', London:'GB',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Movement & Sport': ['Movement & Sport','sport','running','run','cycling','bike','fitness','yoga','pilates','barre','climb','hike','swim','tennis','football','futbal','beh','pohyb'],
  'Wellness & Body': ['Wellness & Body','wellness','spa','mental','mindful','meditation','health','body','relax','masaz','zdravi'],
  'Food & Drinks': ['Food & Drinks','food','drink','coffee','wine','beer','gastro','pizza','market','trh','jedlo','kaviaren','aperol','brunch','breakfast','dinner'],
  'Art & Creation': ['Art & Creation','art','design','photo','paint','draw','craft','gallery','umenie','workshop','creation','creative'],
  'Music & Nightlife': ['Music & Nightlife','music','party','club','dj','rave','concert','festival','nightlife','hudba','koncert','disco','night'],
  'Learning & Mind': ['Learning & Mind','learn','talk','lecture','seminar','workshop','discussion','diskusia','education','mind','book','science'],
  'Community & Belonging': ['Community & Belonging','community','social','networking','meetup','volunteering','charity','charita','komunita','zaujimave'],
};

// ─── Hero card (same style as featured EventCard) ─────────────────────────────
function HeroCard({ event, attending }: { event: any; attending: boolean; lang: string; onPress: () => void }) {
  return (
    <View style={{ width: HERO_W, marginRight: 12 }}>
      <EventCard event={event} featured attending={attending} />
    </View>
  );
}

// ─── Carousel card ─────────────────────────────────────────────────────────────
const CAT_SK_MAP: Record<string, string> = {
  'Movement & Sport': 'Pohyb & Šport',
  'Wellness & Body': 'Wellness & Telo',
  'Food & Drinks': 'Jedlo & Nápoje',
  'Art & Creation': 'Umenie & Tvorba',
  'Music & Nightlife': 'Hudba & Nočný život',
  'Learning & Mind': 'Učenie & Myseľ',
  'Community & Belonging': 'Komunita',
};

type SharpCorner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

function sharpCornerStyle(corner?: SharpCorner) {
  if (!corner) return {};
  const map: Record<SharpCorner, object> = {
    topLeft:     { borderTopLeftRadius: 0 },
    topRight:    { borderTopRightRadius: 0 },
    bottomLeft:  { borderBottomLeftRadius: 0 },
    bottomRight: { borderBottomRightRadius: 0 },
  };
  return map[corner];
}

function AvatarCircle({ p, i, total, isMe, circleStyle, imgStyle, initialStyle }: any) {
  const [avatarErr, setAvatarErr] = React.useState(false);
  return (
    <View style={[circleStyle, { marginLeft: i === 0 ? 0 : -6, zIndex: total - i }, isMe && { borderColor: Colors.lime }]}>
      {p.avatar_url && !avatarErr
        ? <Image source={{ uri: p.avatar_url }} style={imgStyle} onError={() => setAvatarErr(true)} />
        : <Text style={initialStyle}>{(p.name ?? '?').charAt(0).toUpperCase()}</Text>}
    </View>
  );
}

function CarouselCard({ event, attending, onPress, lang, userProfile, sharpCorner, forcedTag }: { event: any; attending: boolean; onPress: () => void; lang: string; userProfile?: any; sharpCorner?: SharpCorner; forcedTag?: string }) {
  const [err, setErr] = useState(false);
  const canonical = getCanonicalCategory(event.category ?? '');
  const catLabel = forcedTag ?? (canonical ? (lang === 'sk' ? (CAT_SK_MAP[canonical] ?? canonical) : canonical) : '');
  const showPrice = !event.is_free && event.price > 0;
  const imgTopOverride = sharpCorner === 'topLeft' ? { borderTopLeftRadius: 0 } : sharpCorner === 'topRight' ? { borderTopRightRadius: 0 } : {};

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[cS.card, { width: CARD_W }, sharpCornerStyle(sharpCorner)]}>
      <View style={cS.imgWrap}>
        {event.cover_url && !err
          ? <Image source={{ uri: event.cover_url }} style={[cS.img, imgTopOverride]} onError={() => setErr(true)} />
          : <View style={[cS.img, { backgroundColor: Colors.grayLight }, imgTopOverride]} />}
        {catLabel ? (
          <View style={[cS.catPill, attending && { backgroundColor: Colors.lime }]}>
            <Text style={[cS.catPillText, attending && { color: Colors.black }]}>{catLabel}</Text>
          </View>
        ) : null}
        {attending ? <View style={cS.goingDot}><Text style={cS.goingDotText}>✓</Text></View> : null}
      </View>
      <View style={cS.info}>
        <Text style={cS.title} numberOfLines={2}>{event.title}</Text>
        <View style={cS.timeRow}>
          <Text style={cS.meta} numberOfLines={1}>
            {fmtDate(event.date, lang)}{event.time ? ` · ${event.time}` : ''}
          </Text>
          <View style={cS.rightRow}>
            {(() => {
              const BOT_ID = '00000000-0000-0000-0000-000000000001';
              const allProfiles = (event.attendees ?? []).map((a: any) => a.profile ?? a);
              const others = allProfiles.filter((p: any) => p?.id && p.id !== userProfile?.id && p.id !== BOT_ID);
              const meFromList = allProfiles.find((p: any) => p?.id === userProfile?.id);
              const myProfile = meFromList ?? userProfile;
              const meFirst = attending && myProfile ? [myProfile, ...others] : others;
              const visible = meFirst.slice(0, 3);
              return visible.length > 0 ? (
                <View style={cS.avatarStack}>
                  {visible.map((p: any, i: number) => (
                    <AvatarCircle
                      key={p.id ?? i}
                      p={p} i={i} total={visible.length}
                      isMe={p.id === userProfile?.id}
                      circleStyle={cS.avatarCircle}
                      imgStyle={cS.avatarImg}
                      initialStyle={cS.avatarInitial}
                    />
                  ))}
                </View>
              ) : null;
            })()}
            {(event.is_free || showPrice) && (
              <View style={cS.pricePill}>
                <Text style={cS.pricePillText}>{event.is_free ? 'Zadarmo' : `${event.price}€`}</Text>
              </View>
            )}
          </View>
        </View>
        {event.venue ? <Text style={cS.venue} numberOfLines={1}>{event.venue}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Square card (for nearby section) ─────────────────────────────────────────
function SquareCard({ event, attending, onPress, lang, sharpCorner }: { event: any; attending: boolean; onPress: () => void; lang: string; sharpCorner?: SharpCorner }) {
  const [err, setErr] = useState(false);
  const canonical = getCanonicalCategory(event.category ?? '');
  const catLabel = canonical ? (CAT_SK_MAP[canonical] ?? canonical) : '';
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[sqS.card, { width: NEARBY_W }, sharpCornerStyle(sharpCorner)]}>
      <View style={sqS.imgWrap}>
        {event.cover_url && !err
          ? <Image source={{ uri: event.cover_url }} style={sqS.img} onError={() => setErr(true)} />
          : <View style={sqS.img} />}
        <View style={sqS.overlayGrad}>
          <Text style={sqS.title} numberOfLines={2}>{event.title}</Text>
          <Text style={sqS.meta}>{fmtDate(event.date, lang)}{event.time ? ` · ${event.time}` : ''}</Text>
        </View>
        {catLabel ? (
          <View style={[sqS.catPill, attending && { backgroundColor: Colors.lime }]}>
            <Text style={[sqS.catPillText, attending && { color: Colors.black }]}>{catLabel}</Text>
          </View>
        ) : null}
        {attending ? <View style={sqS.goingDot}><Text style={sqS.goingDotText}>✓</Text></View> : null}
      </View>
    </TouchableOpacity>
  );
}

function NearbyCarousel({ events, attendingIds, onPress, lang }: { events: any[]; attendingIds: Set<string>; onPress: (id: string) => void; lang: string }) {
  if (events.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={NEARBY_W + 10}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 6 }}
      style={{ overflow: 'visible' }}
    >
      {events.map(event => (
        <SquareCard key={event.id} event={event} attending={attendingIds.has(event.id)} onPress={() => onPress(event.id)} lang={lang} sharpCorner="topRight" />
      ))}
    </ScrollView>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAllText}>Zobraziť všetko →</Text></TouchableOpacity>}
    </View>
  );
}

// ─── Horizontal event carousel (ScrollView, avoids FlatList nesting warning) ──
function EventCarousel({ events, attendingIds, onPress, lang, userProfile, sharpCorner, forcedTag }: { events: any[]; attendingIds: Set<string>; onPress: (id: string) => void; lang: string; userProfile?: any; sharpCorner?: SharpCorner; forcedTag?: string }) {
  if (events.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_W + 12}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingRight: 60, paddingBottom: 10 }}
      style={{ overflow: 'visible' }}
    >
      {events.map(event => (
        <CarouselCard key={event.id} event={event} attending={attendingIds.has(event.id)} onPress={() => onPress(event.id)} lang={lang} userProfile={userProfile} sharpCorner={sharpCorner} forcedTag={forcedTag} />
      ))}
    </ScrollView>
  );
}

// ─── Club card ─────────────────────────────────────────────────────────────────
function ClubCard({ club, onPress }: { club: any; onPress: () => void }) {
  const [err, setErr] = useState(false);
  const logo = club.logo_url ?? club.cover_url;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={klS.card}>
      {logo && !err
        ? <Image source={{ uri: logo }} style={klS.logo} onError={() => setErr(true)} />
        : <View style={[klS.logo, { backgroundColor: Colors.lime, alignItems:'center', justifyContent:'center' }]}>
            <Text style={{ fontWeight:'800', fontSize:18, color:Colors.black }}>{(club.name ?? '?').charAt(0)}</Text>
          </View>}
      <Text style={klS.name} numberOfLines={2}>{clubDisplayName(club.name)}</Text>
    </TouchableOpacity>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, user, refetchProfile } = useAuth();
  const { t, lang } = useTranslations();
  const countryNames = lang === 'sk' ? COUNTRY_NAMES_SK : COUNTRY_NAMES_EN;
  const cityDisplay = lang === 'sk' ? CITY_DISPLAY_SK : CITY_DISPLAY_EN;
  const avatarInitial = (profile?.name || (user as any)?.user_metadata?.full_name || '?').charAt(0).toUpperCase();

  const [events, setEvents] = useState<any[]>([]);
  const [nextWeekSeed, setNextWeekSeed] = useState(() => Math.random());
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [trendingEvents, setTrendingEvents] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [attendedKeywords, setAttendedKeywords] = useState<string[]>([]);
  const [filter, setFilter] = useState('My Interests');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withSequence(withTiming(1, { duration: 750 }), withTiming(0, { duration: 750 })), -1, false);
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.4 + shimmer.value * 0.5 }));

  const [city, setCity] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set(['SK']));

  const citySheetY = useRef(new RNAnimated.Value(600)).current;
  const cityPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) citySheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 100 || vy > 0.8) {
        RNAnimated.timing(citySheetY, { toValue: 600, duration: 220, useNativeDriver: true }).start(() => {
          setShowCityPicker(false);
          citySheetY.setValue(600);
        });
      } else {
        RNAnimated.spring(citySheetY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  useEffect(() => {
    if (showCityPicker) {
      citySheetY.setValue(600);
      (RNAnimated.spring(citySheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 } as any) as any).start();
    }
  }, [showCityPicker]);

  function closeCitySheet() {
    RNAnimated.timing(citySheetY, { toValue: 600, duration: 220, useNativeDriver: true }).start(() => {
      setShowCityPicker(false);
      citySheetY.setValue(600);
    });
  }
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [availableCities, setAvailableCities] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: cityRows } = await supabase.from('events').select('city,country').neq('status','cancelled').gte('date', today).not('city','is',null);
        const citySet = new Set<string>((cityRows ?? []).map((r: any) => { const c = r.city; return CITY_NORMALIZE[c] ?? c; }).filter(Boolean));
        const grouped = COUNTRY_META.map(c => ({ ...c, cities: [...citySet].filter(city => (CITY_COUNTRY[city] ?? 'SK') === c.code).sort() })).filter(c => c.cities.length > 0);
        setAvailableCities(grouped);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Always try to get GPS for nearby sorting
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data } = await supabase.from('profiles').select('city').eq('id', u.id).single();
          if (data?.city) { setCity(data.city); return; }
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setCity('Your city'); return; }
        const loc = await Location.getCurrentPositionAsync({});
        const [geo] = await Location.reverseGeocodeAsync(loc.coords);
        setCity(geo?.city ?? geo?.region ?? 'Your city');
      } catch (_) { setCity('Your city'); }
    })();
  }, []);

  useFocusEffect(useCallback(() => {
    setStatusBarStyle('dark');
    setNextWeekSeed(Math.random());
    if (city === null) return;
    loadData();
    refetchProfile();
    if (user) {
      supabase.from('notifications').select('id', { count:'exact', head:true }).eq('user_id', user.id).eq('read', false)
        .then(({ count }) => setUnreadNotifs(count ?? 0));
    }
  }, [filter, city, user?.id]));

  function filterExpired(data: any[]): any[] {
    const now = new Date();
    return data.filter((e: any) => {
      if (e.status === 'cancelled') return false;
      if (!e.date || !e.time) return true;
      const start = new Date(`${e.date}T${e.time}`);
      return now < new Date(start.getTime() + (e.duration ?? 2) * 3600000 + 30 * 60000);
    });
  }

  async function loadData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const sel = '*, club:clubs(id,name,cover_url), creator:profiles!creator_id(id,name,avatar_url), attendees:event_attendees(profile:profiles(id,name,avatar_url))';
    const baseOr = `date.gte.${today},and(is_recurring.eq.true,recurring_end_date.gte.${today})`;
    const cityFilter = city && city !== 'Your city' && city !== 'Select city' ? city : null;

    const nowIso = new Date().toISOString();
    let mainQ = supabase.from('events').select(sel).or(baseOr).or(`publish_at.is.null,publish_at.lte.${nowIso}`).order('date').limit(60);
    if (cityFilter) {
      const aliases = CITY_DB_ALIASES[cityFilter] ?? [cityFilter];
      mainQ = aliases.length > 1
        ? (mainQ as any).or(aliases.map((a: string) => `city.eq.${a}`).join(','))
        : mainQ.eq('city', cityFilter);
    }
    if (filter === 'Free') mainQ = mainQ.eq('is_free', true);
    else if (filter !== 'My Interests') {
      const keywords = CATEGORY_KEYWORDS[filter] ?? [filter];
      mainQ = (mainQ as any).or(keywords.map((k: string) => `category.ilike.%${k}%`).join(','));
    }

    let trendQ = supabase.from('events').select(sel).or(baseOr).neq('status','cancelled').order('going_count', { ascending:false }).limit(12);
    if (cityFilter) {
      const aliases = CITY_DB_ALIASES[cityFilter] ?? [cityFilter];
      trendQ = aliases.length > 1
        ? (trendQ as any).or(aliases.map((a: string) => `city.eq.${a}`).join(','))
        : trendQ.eq('city', cityFilter);
    }

    let clubsQ = supabase.from('clubs').select('id,name,logo_url,cover_url').limit(20);
    if (cityFilter) clubsQ = (clubsQ as any).eq('city', cityFilter);

    const [mainRes, trendRes, clubsRes] = await Promise.all([mainQ, trendQ, clubsQ]);

    const expanded = expandRecurringEvents(filterExpired(mainRes.data ?? []));
    setEvents(expanded);
    setTrendingEvents(filterExpired(trendRes.data ?? []).slice(0, 10));
    const sortedClubs = (clubsRes.data ?? []).sort((a: any, b: any) => {
      const scoreA = (a.member_count ?? 0) + Math.random() * 6;
      const scoreB = (b.member_count ?? 0) + Math.random() * 6;
      return scoreB - scoreA;
    });
    setClubs(sortedClubs);

    if (user) {
      const { data: att } = await supabase
        .from('event_attendees')
        .select('event_id,occurrence_date,event:events(category)')
        .eq('user_id', user.id);
      const ids = new Set<string>();
      const catSet = new Set<string>();
      (att ?? []).forEach((a: any) => {
        if (a.occurrence_date) ids.add(`${a.event_id}_${a.occurrence_date}`);
        else ids.add(a.event_id);
        const canonical = getCanonicalCategory(a.event?.category ?? '');
        if (canonical) catSet.add(canonical);
      });
      setAttendingIds(ids);
      const kws = [...new Set([...catSet].flatMap(c => CATEGORY_KEYWORDS[c] ?? []))];
      setAttendedKeywords(kws);
    }
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await loadData(); setRefreshing(false); }

  async function selectCity(c: string) {
    setCity(c); setShowCityPicker(false);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) await supabase.from('profiles').upsert({ id: u.id, city: c });
    refetchProfile();
  }

  function goToEvent(id: string) { router.push(`/event/${id}` as any); }

  // Derived sections
  const isKino = (e: any) => {
    const titleMatch = e.title?.toLowerCase().includes('letné kino') || e.title?.toLowerCase().includes('letne kino');
    const tagMatch = Array.isArray(e.tags) && e.tags.some((t: string) => t?.toLowerCase().includes('letné kino') || t?.toLowerCase().includes('letne kino'));
    const taglineMatch = e.tagline?.toLowerCase().includes('letné kino') || e.tagline?.toLowerCase().includes('letne kino');
    return titleMatch || tagMatch || taglineMatch;
  };
  const kinoEvents = events.filter(isKino).slice(0, 10);
  const nonKinoEvents = events.filter((e: any) => !isKino(e));
  const heroEvents = nonKinoEvents.slice(0, 5);
  const below3 = nonKinoEvents.slice(1, 4);
  const nearbyEvents = (() => {
    const sorted = (userLocation
      ? [...nonKinoEvents]
          .filter((e: any) => e.lat != null && e.lng != null)
          .sort((a: any, b: any) =>
            haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
            haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
          )
      : [...nonKinoEvents]
    );
    // Deduplicate by title — keep only earliest upcoming date per title
    const seen = new Map<string, any>();
    for (const e of sorted) {
      const key = (e.title ?? '').trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, e);
      } else {
        const existing = seen.get(key);
        if (e.date && existing.date && e.date < existing.date) {
          seen.set(key, e);
        }
      }
    }
    return Array.from(seen.values()).slice(0, 10);
  })();
  const heroIds = new Set(heroEvents.map((e: any) => e.id));
  const activeKeywords = attendedKeywords.length > 0
    ? attendedKeywords
    : (profile?.interests ?? []).flatMap((i: string) => CATEGORY_KEYWORDS[i] ?? []);
  const MIN_SIMILAR = 4;
  const similarEventsMatched = activeKeywords.length > 0
    ? nonKinoEvents
        .filter((e: any) => !attendingIds.has(e.id) && !heroIds.has(e.id))
        .filter((e: any) => activeKeywords.some((k: string) => e.category?.toLowerCase().includes(k.toLowerCase())))
        .slice(0, 10)
    : [];
  const similarMatchedIds = new Set(similarEventsMatched.map((e: any) => e.id));
  const similarPadding = similarEventsMatched.length < MIN_SIMILAR
    ? nonKinoEvents
        .filter((e: any) => !attendingIds.has(e.id) && !heroIds.has(e.id) && !similarMatchedIds.has(e.id))
        .slice(0, MIN_SIMILAR - similarEventsMatched.length)
    : [];
  const similarEvents = [...similarEventsMatched, ...similarPadding];
  const shownIds = new Set([
    ...heroEvents.map((e: any) => e.id),
    ...trendingEvents.map((e: any) => e.id),
    ...similarEvents.map((e: any) => e.id),
    ...nearbyEvents.map((e: any) => e.id),
  ]);
  const discoverEvents = nonKinoEvents
    .filter((e: any) => !shownIds.has(e.id))
    .slice(0, 10);

  // Coffee & brunch events
  const COFFEE_KEYWORDS = ['kav', 'brunch', 'matcha', 'coffee', 'latte', 'cappuccino', 'espresso', 'pekár', 'pekar', 'croissant', 'bagel', 'raňajk', 'ranajk', 'breakfast', 'čajovn', 'kakao', 'wafle', 'pancake', 'palacinky', 'džús', 'smoothie', 'avokádo', 'avokado', 'toast', 'mimosa'];
  const coffeeEvents = events.filter((e: any) => {
    const text = `${e.title ?? ''} ${e.tagline ?? ''} ${e.description ?? ''}`.toLowerCase();
    return COFFEE_KEYWORDS.some(k => text.includes(k));
  }).slice(0, 10);

  // Next week: Monday–Sunday of the upcoming week, reshuffled on every focus
  const nextWeekEvents = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today); nextMonday.setDate(today.getDate() + daysUntilMonday);
    const nextSunday = new Date(nextMonday); nextSunday.setDate(nextMonday.getDate() + 6);
    const filtered = events.filter((e: any) => {
      if (!e.date) return false;
      const d = new Date(e.date + 'T00:00:00');
      return d >= nextMonday && d <= nextSunday;
    });
    // Seeded shuffle so order changes on every focus
    const arr = [...filtered];
    let seed = nextWeekSeed;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 12);
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={[styles.topBarSide, { justifyContent: 'flex-start' }]}>
            <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
                {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} onError={() => {}} /> : null}
              </View>
            </TouchableOpacity>
          </View>
          <WMark size={90} color={Colors.lime} style={{ marginVertical: -10 }} />
          <View style={styles.topBarSide}>
            {user && (
              <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications' as any)}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                {unreadNotifs > 0 && <View style={styles.bellDot} />}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          {loading ? (
            <Animated.View style={[{ gap: 10 }, shimmerStyle]}>
              <View style={{ width:110, height:18, borderRadius:9, backgroundColor:Colors.grayLight }} />
              <View style={{ width:200, height:28, borderRadius:10, backgroundColor:Colors.grayLight }} />
            </Animated.View>
          ) : (
            <>
              <TouchableOpacity onPress={() => setShowCityPicker(true)} style={styles.cityRow}>
                <Text style={styles.cityLabel}>{city ?? t.home.selectCity}</Text>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 9l6 6 6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
              <Text style={styles.title}>{t.home.yourCityMoving}</Text>
            </>
          )}
        </View>

        {/* Filter chips */}
        {loading ? (
          <Animated.View style={[{ flexDirection:'row', gap:8, paddingHorizontal:20, paddingBottom:16 }, shimmerStyle]}>
            {[72,52,90,68,80].map((w,i) => <View key={i} style={[styles.skeletonChip, { width:w }]} />)}
          </Animated.View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTER_TAGS.map(tag => (
              <Tag
                key={tag}
                label={tag === 'My Interests' ? (lang === 'sk' ? 'Moje záujmy' : 'My Interests') : tag === 'All Events' ? (lang === 'sk' ? 'Všetky' : 'All Events') : tag === 'Free' ? t.home.free : (lang === 'sk' ? (CATEGORY_SK[tag] ?? tag) : tag)}
                selected={filter === tag}
                onPress={() => setFilter(tag)}
                small floatDelay={-1}
              />
            ))}
          </ScrollView>
        )}

        {/* ── Hero slider ── */}
        {loading ? (
          <Animated.View style={[{ height:310, backgroundColor:Colors.grayLight, borderRadius:20, marginHorizontal:20, marginBottom:20 }, shimmerStyle]} />
        ) : heroEvents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={HERO_W + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal:20, paddingBottom:4 }}
            style={{ marginBottom: 20 }}
          >
            {heroEvents.map(event => (
              <HeroCard key={event.id} event={event} attending={attendingIds.has(event.id)} onPress={() => goToEvent(event.id)} lang={lang} />
            ))}
          </ScrollView>
        ) : null}

        {/* ── 3 events below hero ── */}
        {!loading && below3.length > 0 && (
          <View style={[styles.list, { marginBottom: 8 }]}>
            {below3.map((event, i) => (
              <React.Fragment key={event.id}>
                <EventCard event={event} attending={attendingIds.has(event.id)} />
                {i < below3.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── See all button ── */}
        {!loading && nonKinoEvents.length > 0 && (
          <View style={styles.seeAllBtnRow}>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push('/events/all' as any)}
              activeOpacity={0.75}
            >
              <Text style={styles.seeAllBtnText}>Zobraziť všetky</Text>
              <View style={styles.seeAllArrow}><Text style={styles.seeAllArrowText}>→</Text></View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Hot & Trending ── */}
        {!loading && trendingEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="🔥 Hot & Trending" />
            <EventCarousel events={trendingEvents} attendingIds={attendingIds} onPress={goToEvent} lang={lang} userProfile={profile} sharpCorner="bottomRight" />
          </View>
        )}

        {/* ── Podobné záujmom ── */}
        {!loading && similarEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="🤩 Podobné tvojim záujmom" />
            <EventCarousel events={similarEvents} attendingIds={attendingIds} onPress={goToEvent} lang={lang} userProfile={profile} sharpCorner="bottomRight" />
          </View>
        )}

        {/* ── Káva & brunch ── */}
        {!loading && coffeeEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="☕ Káva & brunch" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={HERO_W + 12}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
              style={{ marginBottom: 4 }}
            >
              {coffeeEvents.map(event => (
                <HeroCard key={event.id} event={event} attending={attendingIds.has(event.id)} onPress={() => goToEvent(event.id)} lang={lang} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Letné kino ── */}
        {!loading && kinoEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="🎬 Letné kino" />
            <EventCarousel events={kinoEvents} attendingIds={attendingIds} onPress={goToEvent} lang={lang} userProfile={profile} sharpCorner="topLeft" forcedTag="LETNÉ KINO" />
          </View>
        )}

        {/* ── V tvojom okolí ── */}
        {!loading && nearbyEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="📍 V tvojom okolí" />
            <NearbyCarousel events={nearbyEvents} attendingIds={attendingIds} onPress={goToEvent} lang={lang} />
          </View>
        )}

        {/* ── Zaži niečo nové ── */}
        {!loading && discoverEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="🚀 Zaži niečo nové" />
            <EventCarousel events={discoverEvents} attendingIds={attendingIds} onPress={goToEvent} lang={lang} userProfile={profile} sharpCorner="bottomRight" />
          </View>
        )}

        {/* ── Budúci týždeň ── */}
        {!loading && nextWeekEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="🗓️ Budúci týždeň" />
            <EventCarousel events={nextWeekEvents} attendingIds={attendingIds} onPress={goToEvent} lang={lang} userProfile={profile} sharpCorner="topLeft" />
          </View>
        )}

        {/* ── Kluby ── */}
        {!loading && clubs.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Kluby" onSeeAll={() => router.push('/clubs' as any)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:20, gap:12 }}>
              {clubs.map(club => (
                <ClubCard key={club.id} club={club} onPress={() => router.push(`/club/${club.id}` as any)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Najbližšie akcie (full list) ── */}
        {!loading && (
          <View style={{ marginTop: 8 }}>
            <SectionHeader title="Najbližšie akcie" />
            <View style={styles.list}>
              {(showAllNearby ? nonKinoEvents : nonKinoEvents.slice(0, 7)).map((event, i, arr) => {
                const prevEvent = arr[i - 1];
                const curMonth = event.date?.slice(0, 7);
                const prevMonth = prevEvent?.date?.slice(0, 7);
                const showMonthDivider = i > 0 && curMonth && curMonth !== prevMonth;
                return (
                  <React.Fragment key={event.id + '_list'}>
                    {showMonthDivider && (
                      <View style={styles.monthDivider}>
                        <View style={styles.monthDividerAccent} />
                        <Text style={styles.monthDividerText}>{formatMonth(event.date!, lang)}</Text>
                        <View style={styles.monthDividerLine} />
                      </View>
                    )}
                    <View>
                      <EventCard event={event} attending={attendingIds.has(event.id)} />
                      {i < arr.length - 1 && <View style={styles.divider} />}
                    </View>
                  </React.Fragment>
                );
              })}
              {nonKinoEvents.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>{t.home.noEvents}</Text>
                  <Text style={styles.emptyText}>{t.home.noEventsInCity(city ?? '')}</Text>
                </View>
              )}
            </View>
            {!showAllNearby && nonKinoEvents.length > 7 && (
              <View style={styles.seeAllBtnRow}>
                <TouchableOpacity style={styles.seeAllBtn} onPress={() => setShowAllNearby(true)} activeOpacity={0.75}>
                  <Text style={styles.seeAllBtnText}>Zobraziť všetky</Text>
                  <View style={styles.seeAllArrow}><Text style={styles.seeAllArrowText}>→</Text></View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* City picker modal */}
      <Modal visible={showCityPicker} transparent animationType="none" onRequestClose={closeCitySheet}>
        <View style={styles.cityModalBg}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCitySheet} />
          <RNAnimated.View style={[styles.cityModalSheet, { transform: [{ translateY: citySheetY }] }]}>
            {/* Handle — drag zone */}
            <View {...cityPanResponder.panHandlers} style={styles.cityModalHandleZone}>
              <View style={styles.cityModalHandle} />
            </View>
            <ScrollView
              contentContainerStyle={styles.cityModalContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
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
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ transform:[{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                        <Path d="M6 9l6 6 6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </TouchableOpacity>
                    {isExpanded && country.cities.map((c: string) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.cityModalRow, city === c && styles.cityModalRowActive]}
                        onPress={() => selectCity(c)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.cityModalLabel, city === c && styles.cityModalLabelActive]}>{cityDisplay[c] ?? c}</Text>
                        {city === c && <View style={styles.cityModalCheck}><Text style={styles.cityModalCheckText}>✓</Text></View>}
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              <View style={{ height: 20 }} />
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── StyleSheets ───────────────────────────────────────────────────────────────

const hS = StyleSheet.create({
  imgWrap: { borderRadius: 20, overflow: 'hidden', marginBottom: 10 },
  img: { width: HERO_W, height: 200 },
  catPill: { position:'absolute', top:12, left:12, backgroundColor:Colors.lime, borderRadius:50, paddingHorizontal:10, paddingVertical:5 },
  catText: { fontSize:9, fontWeight:'800', color:Colors.black, letterSpacing:1 },
  freePill: { position:'absolute', top:12, right:12, backgroundColor:Colors.lime, borderRadius:50, paddingHorizontal:10, paddingVertical:5 },
  freePillText: { fontSize:11, fontWeight:'700', color:Colors.black },
  goingBadge: { position:'absolute', bottom:12, right:12, backgroundColor:Colors.lime, borderRadius:50, paddingHorizontal:10, paddingVertical:5 },
  goingText: { fontSize:11, fontWeight:'800', color:Colors.black },
  info: { paddingBottom: 4 },
  title: { fontSize:18, fontWeight:'700', color:Colors.black, fontFamily:Fonts.bold, marginBottom:4, letterSpacing:-0.3 },
  meta: { fontSize:13, color:Colors.gray, fontFamily:Fonts.regular, marginBottom:4 },
  bottomRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  organizer: { fontSize:12, color:Colors.gray, fontFamily:Fonts.regular },
  price: { fontSize:13, fontWeight:'700', color:Colors.black, fontFamily:Fonts.bold },
});

const sqS = StyleSheet.create({
  card: { borderRadius: 14, overflow: 'hidden' },
  imgWrap: { position: 'relative' },
  img: { width: '100%', aspectRatio: 1, backgroundColor: Colors.grayLight },
  overlayGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 28, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' },
  title: { fontSize: 12, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold, lineHeight: 16, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  meta: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.regular, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  catPill: { position: 'absolute', top: 7, right: 7, backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 6, paddingVertical: 3 },
  catPillText: { fontSize: 8, fontWeight: '700', color: Colors.white },
  goingDot: { position: 'absolute', top: 7, left: 7, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  goingDotText: { fontSize: 12, fontWeight: '900', color: Colors.black },
});

const cS = StyleSheet.create({
  card: { borderRadius:16, backgroundColor:Colors.white, shadowColor:'#000', shadowOffset:{ width:0, height:2 }, shadowOpacity:0.07, shadowRadius:8, elevation:2 },
  imgWrap: { position:'relative' },
  img: { width:'100%', height:140, borderTopLeftRadius:16, borderTopRightRadius:16 },
  catPill: { position:'absolute', top:8, left:8, backgroundColor:Colors.black, borderRadius:50, paddingHorizontal:7, paddingVertical:3 },
  catPillText: { fontSize:9, fontWeight:'700', color:Colors.white },
  goingDot: { position:'absolute', top:8, right:8, width:26, height:26, borderRadius:13, backgroundColor:Colors.lime, alignItems:'center', justifyContent:'center' },
  goingDotText: { fontSize:13, fontWeight:'900', color:Colors.black },
  info: { padding:10 },
  title: { fontSize:14, fontWeight:'700', color:Colors.black, fontFamily:Fonts.bold, marginBottom:3, letterSpacing:-0.2 },
  timeRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:2 },
  meta: { fontSize:12, color:Colors.gray, fontFamily:Fonts.regular, flexShrink:1 },
  rightRow: { flexDirection:'row', alignItems:'center', gap:5 },
  avatarStack: { flexDirection:'row', alignItems:'center' },
  avatarCircle: { width:18, height:18, borderRadius:9, backgroundColor:Colors.lime, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:Colors.white, overflow:'hidden' },
  avatarImg: { width:18, height:18, borderRadius:9 },
  avatarInitial: { fontSize:8, fontWeight:'700', color:Colors.black },
  pricePill: { backgroundColor:Colors.lime, borderRadius:50, paddingHorizontal:7, paddingVertical:3 },
  pricePillText: { fontSize:10, fontWeight:'700', color:Colors.black },
  venue: { fontSize:11, color:Colors.gray, fontFamily:Fonts.regular, marginBottom:2 },
});

const klS = StyleSheet.create({
  card: { alignItems:'center', width:72, gap:6 },
  logo: { width:60, height:60, borderRadius:16, backgroundColor:Colors.grayLight },
  name: { fontSize:11, color:Colors.black, fontFamily:Fonts.regular, textAlign:'center', fontWeight:'500' },
});

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:Colors.white },
  topBar: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:0 },
  topBarSide: { flex:1, alignItems:'center', flexDirection:'row', justifyContent:'flex-end', gap:10 },
  bellBtn: { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  bellDot: { position:'absolute', top:4, right:4, width:8, height:8, borderRadius:4, backgroundColor:'#FF3B30', borderWidth:1.5, borderColor:Colors.white },
  header: { paddingHorizontal:20, marginBottom:16 },
  cityRow: { flexDirection:'row', alignItems:'center', gap:4, marginBottom:4 },
  cityLabel: { fontSize:18, color:Colors.gray, fontWeight:'500', fontFamily:Fonts.medium },
  title: { fontSize:28, fontWeight:'700', color:Colors.black, letterSpacing:-0.5, fontFamily:Fonts.bold },
  avatar: { width:36, height:36, borderRadius:18, overflow:'hidden' },
  avatarCircle: { width:36, height:36, borderRadius:18, backgroundColor:Colors.lime, alignItems:'center', justifyContent:'center' },
  avatarInitial: { fontSize:15, fontWeight:'500', color:Colors.black, fontFamily:Fonts.medium },
  filters: { paddingHorizontal:20, paddingBottom:16, gap:8 },
  list: { paddingHorizontal:20 },
  divider: { height:1, backgroundColor:Colors.grayBorder, marginVertical:2 },
  monthDivider: { flexDirection:'row', alignItems:'center', marginTop:20, marginBottom:8, gap:8 },
  monthDividerAccent: { width:18, height:2, borderRadius:2, backgroundColor:Colors.lime },
  monthDividerLine: { flex:1, height:2, borderRadius:2, backgroundColor:Colors.lime },
  monthDividerText: { fontSize:11, fontWeight:'700', color:Colors.black, fontFamily:Fonts.bold, letterSpacing:1, textTransform:'uppercase' },
  skeletonChip: { height:32, borderRadius:50, backgroundColor:Colors.grayLight },
  empty: { paddingVertical:60, alignItems:'center', gap:8 },
  emptyTitle: { fontSize:18, fontWeight:'600', color:Colors.black, fontFamily:Fonts.semibold },
  emptyText: { fontSize:14, color:Colors.gray, textAlign:'center', fontFamily:Fonts.regular },
  section: { marginBottom:28 },
  sectionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, marginBottom:12, marginTop:4 },
  sectionTitle: { fontSize:17, fontWeight:'700', color:Colors.black, fontFamily:Fonts.bold },
  seeAllText: { fontSize:10, color:Colors.gray, fontFamily:Fonts.regular },
  seeAllBtnRow: { alignItems:'center', marginBottom:24, marginTop:8 },
  seeAllBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:Colors.black, paddingVertical:10, paddingHorizontal:20, borderRadius:50 },
  seeAllBtnText: { fontSize:13, fontWeight:'600', color:Colors.white, fontFamily:Fonts.semibold },
  seeAllArrow: { width:20, height:20, borderRadius:10, backgroundColor:Colors.lime, alignItems:'center', justifyContent:'center' },
  seeAllArrowText: { fontSize:11, fontWeight:'800', color:Colors.black },
  cityModalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  cityModalSheet: { backgroundColor:Colors.white, borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:'75%' },
  cityModalHandleZone: { alignItems:'center', paddingTop:12, paddingBottom:8 },
  cityModalHandle: { width:36, height:4, borderRadius:2, backgroundColor:Colors.grayBorder },
  cityModalContent: { paddingHorizontal:24, paddingTop:8 },
  cityModalTitle: { fontSize:18, fontWeight:'700', fontFamily:Fonts.bold, color:Colors.black, marginBottom:12 },
  countryRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:14, borderBottomWidth:1, borderBottomColor:Colors.grayBorder },
  countryFlag: { fontSize:20 },
  countryName: { flex:1, fontSize:15, fontWeight:'600', fontFamily:Fonts.semibold, color:Colors.black },
  cityModalRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:13, paddingLeft:36, borderBottomWidth:1, borderBottomColor:Colors.grayBorder },
  cityModalRowActive: {},
  cityModalLabel: { fontSize:15, fontFamily:Fonts.regular, color:Colors.black },
  cityModalLabelActive: { fontWeight:'700', fontFamily:Fonts.bold },
  cityModalCheck: { width:22, height:22, borderRadius:11, backgroundColor:Colors.lime, alignItems:'center', justifyContent:'center' },
  cityModalCheckText: { fontSize:12, fontWeight:'800', color:Colors.black, lineHeight:14 },
});
