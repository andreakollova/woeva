import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
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
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke="#0A0A0A" strokeWidth={1.6} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="#0A0A0A"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [eventsCount, setEventsCount] = useState(0);
  const [clubsCount, setClubsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('event_attendees').select('id', { count: 'exact' }).eq('user_id', user.id).then(({ count }) => setEventsCount(count ?? 0));
    supabase.from('club_members').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'approved').then(({ count }) => setClubsCount(count ?? 0));
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
          <WMark size={34} color={Colors.lime} />
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <SettingsIcon />
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
        </View>

        {/* Name + subtitle */}
        <Text style={styles.name}>{displayName || 'Your name'}</Text>
        <Text style={styles.subtitle}>
          {city ? `${city}  ·  ` : ''}{joinedDate ? `joined ${joinedDate}` : ''}
        </Text>

        {/* Edit profile */}
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/settings/profile')}>
          <Text style={styles.editBtnText}>Edit profile</Text>
        </TouchableOpacity>

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
  avatarWrap: { alignItems: 'flex-start', marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  name: { fontSize: 26, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 24 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  statCard: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statCardLime: { backgroundColor: Colors.lime },
  statNum: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  statLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 12 },
  bioText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 22 },
  bioEmpty: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  editBtn: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 8, marginBottom: 24 },
  editBtnText: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.black },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: Colors.grayBorder },
  tagText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.black },
});
