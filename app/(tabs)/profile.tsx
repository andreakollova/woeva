import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import { CATEGORY_SK, CATEGORY_EN } from '@/types';

function ChevronIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke="#CCCCCC" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* Dark hero */}
        <View style={styles.hero}>
          <View style={styles.heroTopBar}>
            <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
              <WMark size={30} color={Colors.lime} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings')} activeOpacity={0.7} style={styles.settingsBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="rgba(255,255,255,0.8)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="rgba(255,255,255,0.8)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarWrap} onPress={() => router.push('/settings/profile')} activeOpacity={0.85}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill as any} borderRadius={48} />
              ) : null}
            </View>
            <View style={styles.editBadge}>
              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={Colors.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={Colors.white} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
              </Svg>
            </View>
          </TouchableOpacity>

          <Text style={styles.heroName}>{displayName || t.settings.yourName}</Text>
          <Text style={styles.heroSub}>
            {[city, joinedDate ? `joined ${joinedDate}` : ''].filter(Boolean).join('  ·  ')}
          </Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{eventsCount}</Text>
              <Text style={styles.statLabel}>{t.dashboard.events}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{clubsCount}</Text>
              <Text style={styles.statLabel}>{t.settings.clubs}</Text>
            </View>
          </View>
        </View>

        {/* White content */}
        <View style={styles.content}>

          {/* Bio */}
          {profile?.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/settings/profile')} activeOpacity={0.6}>
              <Text style={styles.bioEmpty}>{t.settings.addBio}</Text>
            </TouchableOpacity>
          )}

          {/* Interests */}
          {(profile?.interests?.length ?? 0) > 0 && (
            <View style={styles.tagsWrap}>
              {profile!.interests.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{lang === 'sk' ? (CATEGORY_SK[tag] ?? tag) : (CATEGORY_EN[tag] ?? tag)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* My clubs */}
          {clubs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.settings.myClubs}</Text>
              {(showAllClubs ? clubs : clubs.slice(0, 4)).map((club, idx, arr) => (
                <TouchableOpacity
                  key={club.id}
                  style={[styles.row, idx === arr.length - 1 && styles.rowLast]}
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
                  activeOpacity={0.6}
                >
                  {club.logo_url || club.cover_url
                    ? <Image source={{ uri: (club.logo_url ?? club.cover_url)! }} style={styles.rowImg} />
                    : <View style={[styles.rowImg, styles.rowImgFallback]}>
                        <Text style={styles.rowImgInitial}>{club.name.charAt(0).toUpperCase()}</Text>
                      </View>
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{club.name}</Text>
                    {club.category ? <Text style={styles.rowSub}>{club.category}</Text> : null}
                  </View>
                  <ChevronIcon />
                </TouchableOpacity>
              ))}
              {clubs.length > 4 && !showAllClubs && (
                <TouchableOpacity style={styles.showMore} onPress={() => setShowAllClubs(true)}>
                  <Text style={styles.showMoreText}>Show {clubs.length - 4} more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Latest events */}
          {latestEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.settings.latestEvents}</Text>
              {(showAllEvents ? latestEvents : latestEvents.slice(0, 4)).map((event, idx, arr) => {
                const d = new Date(event.date + 'T00:00:00');
                const dateStr = d.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' });
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
                    <ChevronIcon />
                  </TouchableOpacity>
                );
              })}
              {latestEvents.length > 4 && !showAllEvents && (
                <TouchableOpacity style={styles.showMore} onPress={() => setShowAllEvents(true)}>
                  <Text style={styles.showMoreText}>Show {latestEvents.length - 4} more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {profile?.is_admin && (
            <TouchableOpacity style={styles.adminBtn} onPress={() => router.push('/admin' as any)} activeOpacity={0.85}>
              <Text style={styles.adminBtnText}>⚡ Admin Panel</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },

  // Hero
  hero: {
    backgroundColor: Colors.black,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 24,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { alignSelf: 'flex-start', marginBottom: 20, position: 'relative' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarText: { fontSize: 42, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.black,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Fonts.extrabold,
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: Fonts.regular,
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  statNum: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },

  // White content area
  content: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    minHeight: 400,
  },

  bio: {
    fontSize: 15,
    color: Colors.black,
    fontFamily: Fonts.regular,
    lineHeight: 24,
    marginBottom: 16,
  },
  bioEmpty: {
    fontSize: 15,
    color: Colors.gray,
    fontFamily: Fonts.regular,
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

  // Sections
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

  showMore: { paddingVertical: 12, alignItems: 'center' },
  showMoreText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.semibold },

  adminBtn: { marginTop: 8, marginBottom: 12, backgroundColor: Colors.black, borderRadius: 16, padding: 16, alignItems: 'center' },
  adminBtnText: { color: Colors.lime, fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold },
});
