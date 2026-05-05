import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

function SettingsIcon() {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
        <Path d="M4 6h16M4 12h16M4 18h16" stroke="#0A0A0A" strokeWidth={2} strokeLinecap="round" />
        <Circle cx="9" cy="6" r="2.2" fill="#fff" stroke="#0A0A0A" strokeWidth={1.8} />
        <Circle cx="16" cy="12" r="2.2" fill="#fff" stroke="#0A0A0A" strokeWidth={1.8} />
        <Circle cx="9" cy="18" r="2.2" fill="#fff" stroke="#0A0A0A" strokeWidth={1.8} />
      </Svg>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [eventsCount, setEventsCount] = useState(0);
  const [clubsCount, setClubsCount] = useState(0);
  const [clubs, setClubs] = useState<{ id: string; name: string; cover_url: string | null; logo_url: string | null; category: string }[]>([]);
  const [myEvents, setMyEvents] = useState<{ id: string; title: string; date: string; cover_url: string | null }[]>([]);
  const [latestEvents, setLatestEvents] = useState<{ id: string; title: string; date: string; cover_url: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('event_attendees').select('id', { count: 'exact' }).eq('user_id', user.id).then(({ count }) => setEventsCount(count ?? 0));
    supabase.from('club_members').select('id, club:clubs(id, name, cover_url, logo_url, category)').eq('user_id', user.id).eq('status', 'approved').then(({ data }) => {
      setClubsCount(data?.length ?? 0);
      setClubs((data ?? []).map((r: any) => r.club).filter(Boolean));
    });
    supabase.from('events').select('id, title, date, cover_url').eq('creator_id', user.id).order('date', { ascending: true }).then(({ data }) => {
      setMyEvents(data ?? []);
    });
    supabase.from('event_attendees')
      .select('event:events(id, title, date, cover_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setLatestEvents((data ?? []).map((r: any) => r.event).filter(Boolean));
      });
  }, [user]);

  const displayName = profile?.name || (user as any)?.user_metadata?.full_name || '';
  const initial = displayName.charAt(0).toUpperCase() || '?';
  const createdAt = user?.created_at || (user as any)?.created_at;
  const joinedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const city = profile?.city || '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <WMark size={34} color={Colors.lime} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <SettingsIcon />
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Profile</Text>

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarWrap} onPress={() => router.push('/settings/profile')} activeOpacity={0.85}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={40} />
            ) : null}
          </View>
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditIcon}>✎</Text>
          </View>
        </TouchableOpacity>

        {/* Name + subtitle */}
        <Text style={styles.name}>{displayName || 'Your name'}</Text>
        <Text style={styles.subtitle}>
          {city ? `${city}  ·  ` : ''}{joinedDate ? `joined ${joinedDate}` : ''}
        </Text>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{eventsCount}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          <View style={[styles.statCard, styles.statCardLime]}>
            <Text style={styles.statNum}>{clubsCount}</Text>
            <Text style={styles.statLabel}>Clubs</Text>
          </View>
        </View>

        {/* Bio */}
        {(profile?.bio || true) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bio</Text>
            {profile?.bio ? (
              <Text style={styles.bioText}>{profile.bio}</Text>
            ) : (
              <TouchableOpacity onPress={() => router.push('/settings/profile')}>
                <Text style={styles.bioEmpty}>Add a bio →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Favorites / Interests */}
        {(profile?.interests?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Favorites</Text>
            <View style={styles.tags}>
              {profile!.interests.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Latest events (attended) — only visible to self */}
        {latestEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Latest events</Text>
            <View style={styles.clubsList}>
              {latestEvents.map(event => {
                const d = new Date(event.date + 'T00:00:00');
                const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.clubRow}
                    onPress={() => router.push(`/event/${event.id}` as any)}
                    activeOpacity={0.7}
                  >
                    {event.cover_url
                      ? <Image source={{ uri: event.cover_url }} style={styles.clubAvatar} />
                      : <View style={[styles.clubAvatar, styles.clubAvatarFallback]}>
                          <Text style={styles.clubAvatarInitial}>{event.title.charAt(0).toUpperCase()}</Text>
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clubName}>{event.title}</Text>
                      <Text style={styles.clubCategory}>{dateStr}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* My clubs */}
        {clubs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My clubs</Text>
            <View style={styles.clubsList}>
              {clubs.map(club => (
                <TouchableOpacity
                  key={club.id}
                  style={styles.clubRow}
                  onPress={() => router.push(`/club/${club.id}` as any)}
                  onLongPress={() => {
                    Alert.alert('Leave club', `Leave ${club.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Leave', style: 'destructive', onPress: async () => {
                        await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', user!.id);
                        setClubs(prev => prev.filter(c => c.id !== club.id));
                        setClubsCount(prev => Math.max(prev - 1, 0));
                      }},
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  {club.cover_url || club.logo_url
                    ? <Image source={{ uri: (club.cover_url ?? club.logo_url)! }} style={styles.clubAvatar} />
                    : <View style={[styles.clubAvatar, styles.clubAvatarFallback]}>
                        <Text style={styles.clubAvatarInitial}>{club.name.charAt(0).toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    {club.category ? <Text style={styles.clubCategory}>{club.category}</Text> : null}
                  </View>
                  <Text style={styles.clubLeaveHint}>hold to leave</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
  settingsIcon: { fontSize: 22, color: Colors.black }, // unused, kept for safety
  pageTitle: { fontSize: 32, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 24, letterSpacing: -0.5 },
  avatarWrap: { alignSelf: 'flex-start', marginBottom: 16, position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  avatarEditIcon: { fontSize: 12, color: Colors.white },
  name: { fontSize: 26, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 4 },
  subtitle: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 24 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 36 },
  statCard: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 16, padding: 16, alignItems: 'center', gap: 2 },
  statCardLime: { backgroundColor: Colors.lime },
  statNum: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  statLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  section: { marginBottom: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: Colors.grayBorder },
  sectionTitle: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 },
  bioText: { fontSize: 15, color: Colors.black, fontFamily: Fonts.regular, lineHeight: 23 },
  bioEmpty: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  clubsList: { gap: 4 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  clubAvatar: { width: 42, height: 42, borderRadius: 12 },
  clubAvatarFallback: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  clubAvatarInitial: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: Fonts.bold },
  clubName: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  clubCategory: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  clubLeaveHint: { fontSize: 11, color: Colors.grayBorder, fontFamily: Fonts.regular },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, backgroundColor: Colors.grayLight },
  tagText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.black },
});
