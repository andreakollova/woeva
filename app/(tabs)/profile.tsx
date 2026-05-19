import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import { CATEGORY_SK, CATEGORY_EN } from '@/types';

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
  const { t, lang } = useTranslations();
  const [eventsCount, setEventsCount] = useState(0);
  const [clubsCount, setClubsCount] = useState(0);
  const [clubs, setClubs] = useState<{ id: string; name: string; cover_url: string | null; logo_url: string | null; category: string }[]>([]);
  const [myEvents, setMyEvents] = useState<{ id: string; title: string; date: string; cover_url: string | null }[]>([]);
  const [latestEvents, setLatestEvents] = useState<{ id: string; title: string; date: string; cover_url: string | null }[]>([]);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  useFocusEffect(useCallback(() => {
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
  }, [user]));

  const displayName = profile?.name || (user as any)?.user_metadata?.full_name || '';
  const initial = displayName.charAt(0).toUpperCase() || '?';
  const createdAt = user?.created_at || (user as any)?.created_at;
  const joinedDate = createdAt
    ? new Date(createdAt).toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { month: 'long', year: 'numeric' })
    : '';
  const city = profile?.city || '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <WMark size={34} color={Colors.lime} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <SettingsIcon />
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>{t.settings.profile}</Text>

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
        <Text style={styles.name}>{displayName || t.settings.yourName}</Text>
        <Text style={styles.subtitle}>
          {city ? `${city}  ·  ` : ''}{joinedDate ? t.settings.joinedOn(joinedDate) : ''}
        </Text>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{eventsCount}</Text>
            <Text style={styles.statLabel}>{t.dashboard.events}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardLime]}>
            <Text style={styles.statNum}>{clubsCount}</Text>
            <Text style={styles.statLabel}>{t.settings.clubs}</Text>
          </View>
        </View>

        {/* Bio */}
        {(profile?.bio || true) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.settings.bio}</Text>
            {profile?.bio ? (
              <Text style={styles.bioText}>{profile.bio}</Text>
            ) : (
              <TouchableOpacity onPress={() => router.push('/settings/profile')}>
                <Text style={styles.bioEmpty}>{t.settings.addBio}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Favorites / Interests */}
        {(profile?.interests?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.settings.favorites}</Text>
            <View style={styles.tags}>
              {profile!.interests.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{lang === 'sk' ? (CATEGORY_SK[tag] ?? tag) : (CATEGORY_EN[tag] ?? tag)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* My clubs */}
        {clubs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.settings.myClubs}</Text>
            <View style={styles.clubsList}>
              {(showAllClubs ? clubs : clubs.slice(0, 4)).map((club, idx, arr) => (
                <TouchableOpacity
                  key={club.id}
                  style={[styles.clubRow, idx === arr.length - 1 && styles.clubRowLast]}
                  onPress={() => router.push(`/club/${club.id}` as any)}
                  onLongPress={async () => {
                    const { count } = await supabase.from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('role', 'admin').eq('status', 'approved');
                    if ((count ?? 0) <= 1) {
                      Alert.alert('Cannot leave', 'You are the only admin. Assign another admin first.');
                      return;
                    }
                    Alert.alert(t.settings.leaveClub, t.settings.leaveClubConfirm(club.name), [
                      { text: t.common.cancel, style: 'cancel' },
                      { text: t.event.leave, style: 'destructive', onPress: async () => {
                        await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', user!.id);
                        setClubs(prev => prev.filter(c => c.id !== club.id));
                        setClubsCount(prev => Math.max(prev - 1, 0));
                      }},
                    ]);
                  }}
                  activeOpacity={0.7}
                >
                  {club.logo_url || club.cover_url
                    ? <Image source={{ uri: (club.logo_url ?? club.cover_url)! }} style={styles.clubAvatar} />
                    : <View style={[styles.clubAvatar, styles.clubAvatarFallback]}>
                        <Text style={styles.clubAvatarInitial}>{club.name.charAt(0).toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
                    {club.category ? <Text style={styles.clubCategory}>{club.category}</Text> : null}
                  </View>
                  <Text style={styles.clubLeaveHint}>{t.settings.holdToLeave}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {clubs.length > 4 && !showAllClubs && (
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowAllClubs(true)} activeOpacity={0.7}>
                <Text style={styles.viewAllText}>View all ({clubs.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Latest events (attended) */}
        {latestEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.settings.latestEvents}</Text>
            <View style={styles.clubsList}>
              {(showAllEvents ? latestEvents : latestEvents.slice(0, 4)).map((event, idx, arr) => {
                const d = new Date(event.date + 'T00:00:00');
                const dateStr = d.toLocaleDateString('sk-SK', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.clubRow, idx === arr.length - 1 && styles.clubRowLast]}
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
            {latestEvents.length > 4 && !showAllEvents && (
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowAllEvents(true)} activeOpacity={0.7}>
                <Text style={styles.viewAllText}>View all ({latestEvents.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {profile?.is_admin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push('/admin' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.adminBtnText}>⚡ Admin Panel</Text>
          </TouchableOpacity>
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
  clubsList: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.grayBorder },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder, backgroundColor: Colors.white },
  clubRowLast: { borderBottomWidth: 0 },
  viewAllBtn: { paddingTop: 10, paddingBottom: 2, alignItems: 'center' },
  viewAllText: { fontSize: 13, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  clubAvatar: { width: 36, height: 36, borderRadius: 10 },
  clubAvatarFallback: { backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  clubAvatarInitial: { fontSize: 14, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  clubName: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  clubCategory: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  clubLeaveHint: { fontSize: 11, color: Colors.grayBorder, fontFamily: Fonts.regular },
  adminBtn: { marginTop: 32, backgroundColor: Colors.black, borderRadius: 16, padding: 16, alignItems: 'center' },
  adminBtnText: { color: Colors.lime, fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, backgroundColor: Colors.grayLight },
  tagText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.black },
});
