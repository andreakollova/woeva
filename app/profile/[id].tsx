import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';
import { useTranslations } from '@/context/LanguageContext';
import { CATEGORY_SK, CATEGORY_EN } from '@/types';

type PublicProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  interests: string[];
};

type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  cover_url: string | null;
};

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useTranslations();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: ev }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url, bio, city, interests').eq('id', id).single(),
        supabase
          .from('events')
          .select('id, title, date, cover_url')
          .eq('creator_id', id)
          .eq('status', 'approved')
          .gte('date', new Date().toISOString().slice(0, 10))
          .order('date', { ascending: true })
          .limit(10),
      ]);
      setProfile(p as any);
      setEvents((ev ?? []) as UpcomingEvent[]);
      setLoading(false);
    })();
  }, [id]);

  const displayName = profile?.name || '?';
  const initial = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <BackButton />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroTopBar}>
            <BackButton color={Colors.white} />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={48} />
            ) : null}
          </View>

          <Text style={styles.heroName}>{displayName}</Text>
          {profile?.city ? (
            <Text style={styles.heroSub}>{profile.city}</Text>
          ) : null}
        </View>

        {/* Content */}
        <View style={styles.content}>

          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : null}

          {(profile?.interests?.length ?? 0) > 0 && (
            <View style={styles.tagsWrap}>
              {profile!.interests.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{lang === 'sk' ? (CATEGORY_SK[tag] ?? tag) : (CATEGORY_EN[tag] ?? tag)}</Text>
                </View>
              ))}
            </View>
          )}

          {events.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{lang === 'sk' ? 'Najbližšie eventy' : 'Upcoming events'}</Text>
              {events.map((event, idx, arr) => {
                const d = new Date(event.date + 'T00:00:00');
                const dateStr = d.toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.row, idx === arr.length - 1 && styles.rowLast]}
                    onPress={() => router.push(`/event/${event.id}` as any)}
                    activeOpacity={0.6}
                  >
                    {event.cover_url
                      ? <Image source={{ uri: event.cover_url }} style={styles.rowImg} />
                      : <View style={[styles.rowImg, styles.rowImgFallback]}>
                          <Text style={styles.rowImgInitial}>{event.title.charAt(0).toUpperCase()}</Text>
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.rowSub}>{dateStr}</Text>
                    </View>
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 18l6-6-6-6" stroke="#CCCCCC" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  hero: {
    backgroundColor: Colors.black,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroTopBar: {
    paddingVertical: 10,
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarText: { fontSize: 34, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Fonts.extrabold,
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: Fonts.regular,
  },

  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    minHeight: 300,
  },

  bio: {
    fontSize: 15,
    color: Colors.black,
    fontFamily: Fonts.regular,
    lineHeight: 24,
    marginBottom: 16,
  },

  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: '#F2F2F2',
  },
  tagText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.black },

  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: '#ABABAB',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  rowLast: { borderBottomWidth: 0 },
  rowImg: { width: 42, height: 42, borderRadius: 12 },
  rowImgFallback: { backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  rowImgInitial: { fontSize: 16, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
});
