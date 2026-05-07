import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';

type Stats = {
  totalUsers: number;
  newToday: number;
  newThisWeek: number;
  activeEvents: number;
  totalClubs: number;
  openReports: number;
  woevaFeeMonth: number;
  grossMonth: number;
};

type ActivityItem = {
  id: string;
  type: 'user' | 'event' | 'club';
  title: string;
  sub: string;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminIndexScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [
      { count: totalUsers },
      { count: newToday },
      { count: newThisWeek },
      { count: activeEvents },
      { count: totalClubs },
      { count: openReports },
      { data: revenueData },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('clubs').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('platform_revenue').select('gross, woeva_fee').gte('created_at', monthStart.toISOString()),
    ]);

    const grossMonth = (revenueData ?? []).reduce((s: number, r: any) => s + r.gross, 0);
    const woevaFeeMonth = (revenueData ?? []).reduce((s: number, r: any) => s + r.woeva_fee, 0);

    setStats({
      totalUsers: totalUsers ?? 0,
      newToday: newToday ?? 0,
      newThisWeek: newThisWeek ?? 0,
      activeEvents: activeEvents ?? 0,
      totalClubs: totalClubs ?? 0,
      openReports: openReports ?? 0,
      grossMonth,
      woevaFeeMonth,
    });

    // Recent activity feed
    const [{ data: recentUsers }, { data: recentEvents }, { data: recentClubs }] = await Promise.all([
      supabase.from('profiles').select('id, name, email, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('events').select('id, title, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('clubs').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    const feed: ActivityItem[] = [
      ...(recentUsers ?? []).map((u: any) => ({ id: u.id, type: 'user' as const, title: u.name || 'Unknown', sub: u.email || '', created_at: u.created_at })),
      ...(recentEvents ?? []).map((e: any) => ({ id: e.id, type: 'event' as const, title: e.title, sub: 'New event', created_at: e.created_at })),
      ...(recentClubs ?? []).map((c: any) => ({ id: c.id, type: 'club' as const, title: c.name, sub: 'New club', created_at: c.created_at })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);

    setActivity(feed);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();

    // Real-time subscription
    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clubs' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const sections = [
    { key: 'users', label: 'Users', icon: '👤', route: '/admin/users', badge: null },
    { key: 'events', label: 'Events', icon: '🎉', route: '/admin/events', badge: null },
    { key: 'clubs', label: 'Clubs', icon: '🏛', route: '/admin/clubs', badge: null },
    { key: 'categories', label: 'Categories', icon: '🏷', route: '/admin/categories', badge: null },
    { key: 'billing', label: 'Billing', icon: '💰', route: '/admin/billing', badge: null },
    { key: 'reports', label: 'Reports', icon: '🚩', route: '/admin/reports', badge: stats?.openReports ?? null },
    { key: 'broadcast', label: 'Broadcast', icon: '📣', route: '/admin/broadcast', badge: null },
    { key: 'chat', label: 'Chat', icon: '💬', route: '/admin/chat', badge: null },
  ];

  const typeColor = { user: '#E8F4FF', event: Colors.lime, club: '#FFF0E8' };
  const typeLabel = { user: '👤', event: '🎉', club: '🏛' };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Admin Panel</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
        ) : (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: Colors.black }]}>
                <Text style={[styles.statNum, { color: Colors.lime }]}>{stats?.totalUsers}</Text>
                <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.6)' }]}>Total users</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{stats?.newToday}</Text>
                <Text style={styles.statLabel}>New today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{stats?.activeEvents}</Text>
                <Text style={styles.statLabel}>Active events</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{stats?.totalClubs}</Text>
                <Text style={styles.statLabel}>Clubs</Text>
              </View>
              <View style={[styles.statCard, styles.statCardWide, { backgroundColor: Colors.lime }]}>
                <Text style={styles.statNum}>€{(stats?.woevaFeeMonth ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Woeva fee this month</Text>
              </View>
              <View style={[styles.statCard, styles.statCardWide]}>
                <Text style={styles.statNum}>€{(stats?.grossMonth ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Gross revenue this month</Text>
              </View>
            </View>

            {/* Section tiles */}
            <Text style={styles.sectionLabel}>SECTIONS</Text>
            <View style={styles.tilesGrid}>
              {sections.map(s => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.tile}
                  onPress={() => router.push(s.route as any)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.tileIcon}>{s.icon}</Text>
                  <Text style={styles.tileLabel}>{s.label}</Text>
                  {s.badge != null && s.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{s.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity feed */}
            {activity.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
                <View style={styles.feedCard}>
                  {activity.map((item, i) => (
                    <View key={item.id + item.type} style={[styles.feedRow, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[styles.feedIcon, { backgroundColor: typeColor[item.type] }]}>
                        <Text style={styles.feedIconText}>{typeLabel[item.type]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.feedTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.feedSub}>{item.sub}</Text>
                      </View>
                      <Text style={styles.feedTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  statCard: { width: '47%', backgroundColor: Colors.grayLight, borderRadius: 16, padding: 16, gap: 4 },
  statCardWide: { width: '100%' },
  statNum: { fontSize: 24, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', backgroundColor: Colors.grayLight, borderRadius: 16, padding: 16, gap: 8, position: 'relative' },
  tileIcon: { fontSize: 24 },
  tileLabel: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  badge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#FF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  feedCard: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  feedIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  feedIconText: { fontSize: 16 },
  feedTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  feedSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  feedTime: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
});
