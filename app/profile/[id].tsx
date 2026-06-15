import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Share } from 'react-native';
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 60 }} showsVerticalScrollIndicator={false}>

        {/* Black cover */}
        <View style={[styles.cover, { paddingTop: insets.top }]}>
          <View style={[styles.topBar, { marginTop: 8 }]}>
            <BackButton color={Colors.white} style={styles.backCircle} />
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={async () => {
                const name = profile?.name ?? 'Profil';
                const url = `https://woeva.com/share-profile?id=${id}`;
                try { await Share.share({ title: name, message: `${name} na Woeva\n${url}`, url }); } catch {}
              }}
              activeOpacity={0.8}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke={Colors.gray} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.shareBtnText}>Zdieľať</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* White card */}
        <View style={styles.card}>
          {/* Avatar floats up */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={44} />
              ) : null}
            </View>
          </View>

          <Text style={styles.name}>{displayName}</Text>
          {profile?.city ? <Text style={styles.city}>{profile.city}</Text> : null}

          {profile?.bio ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.bio}>{profile.bio}</Text>
            </>
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
            <>
              <View style={styles.divider} />
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
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  cover: {
    height: 180,
    backgroundColor: Colors.black,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backCircle: { backgroundColor: Colors.black, borderRadius: 20 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.gray,
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  avatarWrap: {
    marginTop: -44,
    marginBottom: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    overflow: 'hidden',
  },
  avatarText: { fontSize: 36, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  shareBtnText: { fontSize: 10, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  name: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: Colors.black,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  city: {
    fontSize: 13,
    color: Colors.gray,
    fontFamily: Fonts.regular,
    marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: '#EBEBEB', marginVertical: 16 },
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
    marginTop: 8,
    marginBottom: 4,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: '#F2F2F2',
  },
  tagText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.black },
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
