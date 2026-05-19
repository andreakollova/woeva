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

        {/* Bio + Interests inline block */}
        <View style={styles.infoBlock}>
          {profile?.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/settings/profile')} activeOpacity={0.7}>
              <Text style={styles.bioEmpty}>{t.settings.addBio}</Text>
            </TouchableOpacity>
          )}
          {(profile?.interests?.length ?? 0) > 0 && (
            <View style={styles.tags}>
              {profile!.interests.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{lang === 'sk' ? (CATEGORY_SK[tag] ?? tag) : (CATEGORY_EN[tag] ?? tag)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* My clubs */}
        {clubs.length > 0 && (
          <View style={styles.listBlock}>
            <Text style={styles.listBlockTitle}>{t.settings.myClubs}</Text>
            {(showAllClubs ? clubs : clubs.slice(0, 4)).map((club, idx, arr) => (
              <TouchableOpacity
                key={club.id}
                style={[styles.listRow, idx === arr.length - 1 && styles.listRowLast]}
                onPress={() => router.push(`/club/${club.id}` as any)}
                onLongPress={async () => {
                  const { count } = await supabase.from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('role', 'admin').eq('status', 'approved');
                  if ((count ?? 0) <= 1) { Alert.alert('Cannot leave', 'You are the only admin. Assign another admin first.'); return; }
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
                  ? <Image source={{ uri: (club.logo_url ?? club.cover_url)! }} style={styles.rowAvatar} />
                  : <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
                      <Text style={styles.rowAvatarInitial}>{club.name.charAt(0).toUpperCase()}</Text>
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{club.name}</Text>
                  {club.category ? <Text style={styles.rowSub}>{club.category}</Text> : null}
                </View>
                <Text style={styles.rowChevron}>›</Text>
              </TouchableOpacity>
            ))}
            {clubs.length > 4 && !showAllClubs && (
              <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllClubs(true)} activeOpacity={0.7}>
                <Text style={styles.showMoreText}>+ {clubs.length - 4} more</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Latest events */}
        {latestEvents.length > 0 && (
          <View style={styles.listBlock}>
            <Text style={styles.listBlockTitle}>{t.settings.latestEvents}</Text>
            {(showAllEvents ? latestEvents : latestEvents.slice(0, 4)).map((event, idx, arr) => {
              const d = new Date(event.date + 'T00:00:00');
              const dateStr = d.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.listRow, idx === arr.length - 1 && styles.listRowLast]}
                  onPress={() => router.push(`/event/${event.id}` as any)}
                  activeOpacity={0.7}
                >
                  {event.cover_url
                    ? <Image source={{ uri: event.cover_url }} style={styles.rowAvatar} />
                    : <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
                        <Text style={styles.rowAvatarInitial}>{event.title.charAt(0).toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.rowSub}>{dateStr}</Text>
                  </View>
                  <Text style={styles.rowChevron}>›</Text>
                </TouchableOpacity>
              );
            })}
            {latestEvents.length > 4 && !showAllEvents && (
              <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllEvents(true)} activeOpacity={0.7}>
                <Text style={styles.showMoreText}>+ {latestEvents.length - 4} more</Text>
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
  subtitle: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 20 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 16, padding: 16, alignItems: 'center', gap: 2 },
  statCardLime: { backgroundColor: Colors.lime },
  statNum: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  statLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  bioText: { fontSize: 15, color: Colors.black, fontFamily: Fonts.regular, lineHeight: 23 },
  bioEmpty: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  infoBlock: { marginBottom: 24, gap: 12 },
  listBlock: { marginBottom: 24 },
  listBlockTitle: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  listRowLast: { borderBottomWidth: 0 },
  rowAvatar: { width: 40, height: 40, borderRadius: 10 },
  rowAvatarFallback: { backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  rowAvatarInitial: { fontSize: 16, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  rowChevron: { fontSize: 20, color: Colors.grayBorder, fontWeight: '300' },
  showMoreBtn: { paddingVertical: 10, alignItems: 'center' },
  showMoreText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.semibold, fontWeight: '600' },
  adminBtn: { marginTop: 24, backgroundColor: Colors.black, borderRadius: 16, padding: 16, alignItems: 'center' },
  adminBtnText: { color: Colors.lime, fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50, backgroundColor: Colors.grayLight },
  tagText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.black },
});
