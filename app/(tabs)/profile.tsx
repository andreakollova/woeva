import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event, Club } from '@/types';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { WMark } from '@/components/ui/WMark';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [clubTab, setClubTab] = useState<'yours' | 'discover'>('yours');

  useEffect(() => {
    if (user) {
      loadMyEvents();
      loadMyClubs();
    }
  }, [user]);

  async function loadMyEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('creator_id', user!.id)
      .order('date', { ascending: false })
      .limit(10);
    setMyEvents(data ?? []);
  }

  async function loadMyClubs() {
    const { data } = await supabase
      .from('club_members')
      .select('club:clubs(*)')
      .eq('user_id', user!.id)
      .eq('status', 'approved');
    setMyClubs((data ?? []).map((r: any) => r.club).filter(Boolean));
  }

  const initial = profile?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <WMark size={34} color={Colors.lime} />
          <TouchableOpacity onPress={() => router.push('/settings/index')}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Profile header */}
        <Animated.View entering={FadeInDown.springify()} style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{profile?.name ?? 'Your name'}</Text>
          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {profile?.city && <Text style={styles.city}>{profile.city}</Text>}
          <Button
            label="Edit profile"
            onPress={() => router.push('/settings/profile')}
            variant="outline"
            style={styles.editBtn}
          />
        </Animated.View>

        {/* Clubs section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clubs</Text>
          <View style={styles.tabs}>
            {(['yours', 'discover'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, clubTab === t && styles.tabBtnActive]}
                onPress={() => setClubTab(t)}
              >
                <Text style={[styles.tabText, clubTab === t && styles.tabTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {clubTab === 'yours' && myClubs.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyDot} />
              <Text style={styles.emptyTitle}>No clubs yet</Text>
              <Text style={styles.emptyText}>Join one that fits you, or start your own.</Text>
              <Button label="Discover clubs" onPress={() => setClubTab('discover')} variant="lime" style={styles.cta} />
              <Button label="Start a club" onPress={() => router.push('/club/create')} variant="ghost" />
            </View>
          )}

          {clubTab === 'yours' && myClubs.map(club => (
            <TouchableOpacity
              key={club.id}
              style={styles.clubRow}
              onPress={() => router.push(`/club/${club.id}`)}
            >
              <View style={styles.clubThumb}>
                {club.cover_url
                  ? <Image source={{ uri: club.cover_url }} style={styles.clubImage} />
                  : <View style={[styles.clubImage, { backgroundColor: Colors.lime }]} />
                }
              </View>
              <View style={styles.clubInfo}>
                <Text style={styles.clubName}>{club.name}</Text>
                <Text style={styles.clubMeta}>{club.member_count} members · {club.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* My events */}
        {myEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My events</Text>
            {myEvents.slice(0, 3).map(event => (
              <View key={event.id} style={{ marginBottom: 12 }}>
                <EventCard event={event} featured />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingBottom: 40 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, marginBottom: 20 },
  logoW: { fontSize: 24, fontWeight: '800', color: Colors.lime, letterSpacing: -1 },
  settingsIcon: { fontSize: 20, color: Colors.black },
  profileHeader: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 32, gap: 6 },
  avatarWrap: { marginBottom: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  name: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  bio: { fontSize: 14, color: Colors.gray, textAlign: 'center', lineHeight: 20, fontFamily: Fonts.regular },
  city: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  editBtn: { marginTop: 12, height: 40, paddingHorizontal: 24 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 14, letterSpacing: -0.3 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight },
  tabBtnActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.white },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.grayLight },
  emptyTitle: { fontSize: 20, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  emptyText: { fontSize: 14, color: Colors.gray, textAlign: 'center', fontFamily: Fonts.regular },
  cta: { width: '100%' },
  clubRow: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  clubThumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  clubImage: { width: '100%', height: '100%' },
  clubInfo: { flex: 1, gap: 3 },
  clubName: { fontSize: 16, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  clubMeta: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
});
