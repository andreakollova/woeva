import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Club, ClubMember, Event } from '@/types';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/ui/EventCard';
import { WMark } from '@/components/ui/WMark';
import { useAuth } from '@/hooks/useAuth';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [joinRequests, setJoinRequests] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, [id, user]);

  async function loadAll() {
    const [{ data: clubData }, { data: membersData }, { data: eventsData }] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', id).single(),
      supabase.from('club_members').select('*, profile:profiles(*)').eq('club_id', id).eq('status', 'approved'),
      supabase.from('events').select('*').eq('creator_id', id).limit(5),
    ]);
    setClub(clubData);
    setMembers(membersData ?? []);
    setEvents(eventsData ?? []);

    if (user) {
      const me = (membersData ?? []).find((m: ClubMember) => m.user_id === user.id);
      setIsMember(!!me);
      setIsAdmin(me?.role === 'admin');
    }

    if (isAdmin) {
      const { count } = await supabase.from('club_members').select('*', { count: 'exact' }).eq('club_id', id).eq('status', 'pending');
      setJoinRequests(count ?? 0);
    }
  }

  async function handleJoin() {
    if (!user) { router.push('/(auth)/login'); return; }
    setLoading(true);
    await supabase.from('club_members').insert({ club_id: id, user_id: user.id, role: 'member', status: 'approved' });
    await supabase.from('clubs').update({ member_count: (club?.member_count ?? 0) + 1 }).eq('id', id);
    setIsMember(true);
    setLoading(false);
  }

  if (!club) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={styles.cover}>
          {club.cover_url
            ? <Image source={{ uri: club.cover_url }} style={styles.coverImage} />
            : <View style={[styles.coverImage, { backgroundColor: Colors.lime }]} />
          }
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
          {isAdmin && <View style={styles.adminBadge}><Text style={styles.adminText}>ADMIN</Text></View>}
          <View style={styles.coverContent}>
            <Text style={styles.coverLabel}>YOUR CLUB</Text>
            <Text style={styles.coverTitle}>{club.name}</Text>
          </View>
          <View style={styles.wDecor}><WMark size={110} color={Colors.limeDark} /></View>
        </View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statsRow}>
          <View style={styles.memberAvatars}>
            {members.slice(0, 3).map((m, i) => (
              <View key={m.id} style={[styles.memberAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }]}>
                <Text style={styles.memberAvatarText}>{(m.profile as any)?.name?.charAt(0) ?? '?'}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.memberCount}>{club.member_count} members</Text>
        </Animated.View>

        <View style={styles.statCards}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{events.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          {joinRequests > 0 && (
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{joinRequests}</Text>
              <Text style={styles.statLabel}>Requests</Text>
            </View>
          )}
          <View style={[styles.statCard, styles.statCardLime]}>
            <Text style={styles.statNum}>{club.rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Admin manage section */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage</Text>
            <View style={styles.manageList}>
              {[
                { label: 'Members', value: `${club.member_count} >` },
                { label: 'Join requests', badge: joinRequests > 0 ? `${joinRequests} new` : null },
                { label: 'Events', value: `${events.length} >` },
                { label: 'Settings', value: '>' },
              ].map(item => (
                <TouchableOpacity key={item.label} style={styles.manageRow}>
                  <Text style={styles.manageLabel}>{item.label}</Text>
                  {item.badge ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View>
                  ) : (
                    <Text style={styles.manageValue}>{item.value}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Events</Text>
            {events.map(event => (
              <View key={event.id} style={{ marginBottom: 12 }}>
                <EventCard event={event} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {!isAdmin && !isMember && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label="Join club" onPress={handleJoin} loading={loading} variant="lime" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  cover: { height: 240, overflow: 'hidden', position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, fontWeight: '600', color: Colors.black },
  adminBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  adminText: { fontSize: 11, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },
  coverContent: { position: 'absolute', bottom: 16, left: 16, gap: 2 },
  coverLabel: { fontSize: 11, fontWeight: '700', color: Colors.lime, letterSpacing: 1 },
  coverTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: -0.5 },
  wDecor: { position: 'absolute', top: 8, right: 16, opacity: 0.6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, marginBottom: 12 },
  memberAvatars: { flexDirection: 'row', marginRight: 10 },
  memberAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  memberAvatarText: { fontSize: 12, fontWeight: '700', color: Colors.black },
  memberCount: { fontSize: 14, fontWeight: '500', color: Colors.black },
  statCards: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statCardLime: { backgroundColor: Colors.lime },
  statNum: { fontSize: 24, fontWeight: '700', color: Colors.black },
  statLabel: { fontSize: 12, color: Colors.gray },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, color: Colors.gray, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  manageList: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 14, overflow: 'hidden' },
  manageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  manageLabel: { fontSize: 15, fontWeight: '500', color: Colors.black },
  manageValue: { fontSize: 14, color: Colors.gray },
  badge: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600', color: Colors.black },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder },
});
