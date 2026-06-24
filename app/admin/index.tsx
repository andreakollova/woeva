import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { AdminTabBar } from '@/components/admin/AdminTabBar';
import { WMark } from '@/components/ui/WMark';

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

type AlertItem = {
  id: string;
  icon: string;
  title: string;
  sub: string;
  bg: string;
  textColor: string;
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
  if (mins < 1) return 'práve teraz';
  if (mins < 60) return `pred ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `pred ${hours} h`;
  return `pred ${Math.floor(hours / 24)} d`;
}

const TYPE_ICON = { user: '👤', event: '🎉', club: '🏛' };
const TYPE_SK = { user: 'nový používateľ', event: 'nové podujatie', club: 'nový klub' };

export default function AdminIndexScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
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

    const s: Stats = {
      totalUsers: totalUsers ?? 0,
      newToday: newToday ?? 0,
      newThisWeek: newThisWeek ?? 0,
      activeEvents: activeEvents ?? 0,
      totalClubs: totalClubs ?? 0,
      openReports: openReports ?? 0,
      grossMonth,
      woevaFeeMonth,
    };
    setStats(s);

    // Build alerts
    const alertList: AlertItem[] = [];
    if ((openReports ?? 0) > 0) {
      alertList.push({ id: 'reports', icon: '🚩', title: `${openReports} otvorených hlásení`, sub: 'Vyžaduje kontrolu', bg: '#FF4444', textColor: '#fff' });
    }
    if ((newToday ?? 0) > 0) {
      alertList.push({ id: 'users', icon: '👥', title: `${newToday} noví používatelia`, sub: 'Zaregistrovali sa dnes', bg: Colors.lime, textColor: Colors.black });
    }
    if ((activeEvents ?? 0) > 0) {
      alertList.push({ id: 'events', icon: '🎉', title: `${activeEvents} aktívnych podujatí`, sub: 'Práve prebieha', bg: '#1A1A1A', textColor: '#fff' });
    }
    alertList.push({ id: 'revenue', icon: '💰', title: `€${woevaFeeMonth.toFixed(2)} zarobené`, sub: 'Woeva poplatok tento mesiac', bg: '#1A1A1A', textColor: '#fff' });
    setAlerts(alertList);

    // Activity feed
    const [{ data: recentUsers }, { data: recentEvents }, { data: recentClubs }] = await Promise.all([
      supabase.from('profiles').select('id, name, email, created_at').order('created_at', { ascending: false }).limit(4),
      supabase.from('events').select('id, title, created_at').order('created_at', { ascending: false }).limit(4),
      supabase.from('clubs').select('id, name, created_at').order('created_at', { ascending: false }).limit(4),
    ]);

    const feed: ActivityItem[] = [
      ...(recentUsers ?? []).map((u: any) => ({ id: u.id, type: 'user' as const, title: u.name || 'Neznámy', sub: u.email || 'nový používateľ', created_at: u.created_at })),
      ...(recentEvents ?? []).map((e: any) => ({ id: e.id, type: 'event' as const, title: e.title, sub: 'nové podujatie', created_at: e.created_at })),
      ...(recentClubs ?? []).map((c: any) => ({ id: c.id, type: 'club' as const, title: c.name, sub: 'nový klub', created_at: c.created_at })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

    setActivity(feed);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-overview-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const today = new Date().toLocaleDateString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>{today}</Text>
        <View style={styles.headerLogo}>
          <WMark size={32} color={Colors.lime} />
          <Text style={styles.headerAdmin}>Admin</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.lime} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        >
          {/* Alerts / Notifications */}
          <Text style={styles.sectionLabel}>UPOZORNENIA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertsRow}>
            {alerts.map(a => (
              <View key={a.id} style={[styles.alertCard, { backgroundColor: a.bg }]}>
                <Text style={styles.alertIcon}>{a.icon}</Text>
                <Text style={[styles.alertTitle, { color: a.textColor }]}>{a.title}</Text>
                <Text style={[styles.alertSub, { color: a.textColor, opacity: 0.7 }]}>{a.sub}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Stats */}
          <Text style={styles.sectionLabel}>ŠTATISTIKY</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{stats?.totalUsers}</Text>
              <Text style={styles.statLabel}>Používatelia</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{stats?.newThisWeek}</Text>
              <Text style={styles.statLabel}>Noví tento týždeň</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{stats?.activeEvents}</Text>
              <Text style={styles.statLabel}>Aktívne podujatia</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{stats?.totalClubs}</Text>
              <Text style={styles.statLabel}>Kluby</Text>
            </View>
          </View>

          {/* Revenue */}
          <View style={styles.revenueCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.revenueLabel}>Hrubý príjem tento mesiac</Text>
              <Text style={styles.revenueNum}>€{(stats?.grossMonth ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.revenueLabel}>Zárobky Woeva</Text>
              <Text style={[styles.revenueNum, { color: Colors.lime }]}>€{(stats?.woevaFeeMonth ?? 0).toFixed(2)}</Text>
            </View>
          </View>

          {/* Recent activity */}
          {activity.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>POSLEDNÁ AKTIVITA</Text>
              <View style={styles.feedCard}>
                {activity.map((item, i) => (
                  <View key={item.id + item.type} style={[styles.feedRow, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.feedIconBox}>
                      <Text style={styles.feedIconText}>{TYPE_ICON[item.type]}</Text>
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
        </ScrollView>
      )}

      <AdminTabBar active="index" reportsBadge={stats?.openReports ?? 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { paddingHorizontal: 20, paddingBottom: 10, paddingTop: 14 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular, marginBottom: 8, textTransform: 'capitalize' },
  headerLogo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAdmin: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', fontFamily: Fonts.semibold, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 12 },
  alertsRow: { gap: 10, paddingRight: 4 },
  alertCard: { borderRadius: 18, padding: 16, width: 140, gap: 6 },
  alertIcon: { fontSize: 22 },
  alertTitle: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.bold },
  alertSub: { fontSize: 11, fontFamily: Fonts.regular },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%', backgroundColor: '#161616', borderRadius: 16, padding: 16, gap: 4 },
  statNum: { fontSize: 26, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },
  revenueCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616', borderRadius: 16, padding: 18, marginTop: 10 },
  revenueDivider: { width: 1, height: 40, backgroundColor: '#2A2A2A', marginHorizontal: 16 },
  revenueLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular, marginBottom: 4 },
  revenueNum: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  feedCard: { backgroundColor: '#161616', borderRadius: 16, overflow: 'hidden' },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  feedIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  feedIconText: { fontSize: 16 },
  feedTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.white },
  feedSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },
  feedTime: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: Fonts.regular },
});
