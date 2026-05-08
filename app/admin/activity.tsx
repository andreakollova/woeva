import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal, ScrollView,
  Image, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminTabBar } from '@/components/admin/AdminTabBar';

type ActivityType = 'user' | 'event' | 'club' | 'report';

type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  sub: string;
  created_at: string;
  target_id?: string;
};

type Attendee = {
  id: string;
  name: string;
  avatar_url: string | null;
  paid: boolean;
};

type EventDetail = {
  id: string;
  title: string;
  date: string;
  time: string;
  city: string;
  cover_url: string | null;
  status: string;
  price: number;
  is_free: boolean;
  going_count: number;
  creator_name: string;
  attendeeCount: number;
  paidCount: number;
  gross: number;
  cancellationReason: string | null;
  attendees: Attendee[];
};

const PAGE_SIZE = 30;

const TYPE_CONFIG: Record<ActivityType, { icon: string; color: string }> = {
  user:   { icon: '👤', color: '#3B82F6' },
  event:  { icon: '🎉', color: Colors.lime },
  club:   { icon: '🏛',  color: '#A78BFA' },
  report: { icon: '🚩', color: '#EF4444' },
};

function getEventStatus(date: string, status: string): { label: string; color: string; bg: string } {
  if (status === 'cancelled') return { label: 'Zrušené', color: '#CC0000', bg: '#FFE0E0' };
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return { label: 'Prebehlo', color: '#666', bg: '#F0F0F0' };
  if (date === today) return { label: 'Dnes', color: '#006B28', bg: '#D0FFD8' };
  return { label: 'Nadchádzajúce', color: '#005FCC', bg: '#E0EEFF' };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'práve teraz';
  if (mins < 60) return `pred ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `pred ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `pred ${days} d`;
  return new Date(dateStr).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function fetchPage(cursor: string | null): Promise<ActivityItem[]> {
  const cutoff = cursor ?? new Date().toISOString();
  const limit = PAGE_SIZE;

  const [
    { data: users },
    { data: events },
    { data: clubs },
    { data: reports },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email, created_at').lt('created_at', cutoff).order('created_at', { ascending: false }).limit(limit),
    supabase.from('events').select('id, title, date, status, created_at').lt('created_at', cutoff).order('created_at', { ascending: false }).limit(limit),
    supabase.from('clubs').select('id, name, created_at').lt('created_at', cutoff).order('created_at', { ascending: false }).limit(limit),
    supabase.from('reports').select('id, type, reason, status, created_at').lt('created_at', cutoff).order('created_at', { ascending: false }).limit(limit),
  ]);

  const items: ActivityItem[] = [
    ...(users ?? []).map((u: any): ActivityItem => ({
      id: `user-${u.id}`, type: 'user',
      title: u.name || u.email || '(bez mena)',
      sub: u.email || 'Nový používateľ',
      created_at: u.created_at, target_id: u.id,
    })),
    ...(events ?? []).map((e: any): ActivityItem => {
      const st = getEventStatus(e.date, e.status);
      return {
        id: `event-${e.id}`, type: 'event',
        title: e.title,
        sub: st.label,
        created_at: e.created_at, target_id: e.id,
      };
    }),
    ...(clubs ?? []).map((c: any): ActivityItem => ({
      id: `club-${c.id}`, type: 'club',
      title: c.name, sub: 'Nový klub',
      created_at: c.created_at, target_id: c.id,
    })),
    ...(reports ?? []).map((r: any): ActivityItem => ({
      id: `report-${r.id}`, type: 'report',
      title: r.reason || `Hlásenie: ${r.type}`,
      sub: { open: 'Otvorené', in_review: 'V riešení', closed: 'Uzavreté' }[r.status as string] ?? r.status,
      created_at: r.created_at, target_id: r.id,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, PAGE_SIZE);
}

export default function AdminActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: adminUser } = useAuth();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    const page = await fetchPage(null);
    setItems(page);
    setCursor(page.length > 0 ? page[page.length - 1].created_at : null);
    setHasMore(page.length === PAGE_SIZE);
    setLoading(false);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    const page = await fetchPage(cursor);
    if (page.length === 0) {
      setHasMore(false);
    } else {
      setItems(prev => {
        const ids = new Set(prev.map(i => i.id));
        return [...prev, ...page.filter(i => !ids.has(i.id))];
      });
      setCursor(page[page.length - 1].created_at);
      setHasMore(page.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  async function openEventDetail(eventId: string) {
    setEventLoading(true);
    setEventDetail(null);

    const [{ data: ev }, { data: attendeeRows }] = await Promise.all([
      supabase.from('events')
        .select('id, title, date, time, city, cover_url, status, price, is_free, going_count, cancellation_reason, creator:profiles!events_creator_id_fkey(name)')
        .eq('id', eventId).single(),
      supabase.from('event_attendees')
        .select('id, paid, profile:profiles!event_attendees_user_id_fkey(id, name, avatar_url)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
    ]);

    if (ev) {
      const attendees: Attendee[] = (attendeeRows ?? []).map((a: any) => ({
        id: a.profile?.id ?? a.id,
        name: a.profile?.name ?? '(bez mena)',
        avatar_url: a.profile?.avatar_url ?? null,
        paid: a.paid,
      }));
      const paidCount = attendees.filter(a => a.paid).length;
      setEventDetail({
        ...ev,
        creator_name: (ev.creator as any)?.name ?? '—',
        attendeeCount: attendees.length,
        paidCount,
        gross: paidCount * (ev.price ?? 0),
        cancellationReason: ev.cancellation_reason ?? null,
        attendees,
      });
    }
    setEventLoading(false);
  }

  async function cancelEvent() {
    if (!eventDetail) return;
    if (!cancelReason.trim()) { Alert.alert('Dôvod je povinný', 'Zadaj dôvod zrušenia.'); return; }
    Alert.alert('Zrušiť podujatie', `Zrušiť "${eventDetail.title}"? Všetci účastníci budú notifikovaní.`, [
      { text: 'Späť', style: 'cancel' },
      {
        text: 'Zrušiť podujatie', style: 'destructive', onPress: async () => {
          setActionLoading(true);
          await supabase.from('events').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: cancelReason.trim() }).eq('id', eventDetail.id);
          setEventDetail(d => d ? { ...d, status: 'cancelled', cancellationReason: cancelReason.trim() } : null);
          setItems(prev => prev.map(i => i.target_id === eventDetail.id ? { ...i, sub: 'Zrušené' } : i));
          setCancelReason('');
          setActionLoading(false);
        },
      },
    ]);
  }

  async function deleteEvent() {
    if (!eventDetail) return;
    Alert.alert('Vymazať podujatie', `Natrvalo vymazať "${eventDetail.title}"?`, [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Vymazať', style: 'destructive', onPress: async () => {
          Alert.alert('Posledné potvrdenie', 'Toto sa nedá vrátiť späť.', [
            { text: 'Zrušiť', style: 'cancel' },
            {
              text: 'Vymazať natrvalo', style: 'destructive', onPress: async () => {
                setActionLoading(true);
                await supabase.from('events').delete().eq('id', eventDetail.id);
                setItems(prev => prev.filter(i => i.target_id !== eventDetail.id));
                setEventDetail(null);
                setActionLoading(false);
              },
            },
          ]);
        },
      },
    ]);
  }

  function handlePress(item: ActivityItem) {
    if (item.type === 'event' && item.target_id) {
      openEventDetail(item.target_id);
    } else if (item.type === 'report') {
      router.push('/admin/reports' as any);
    } else if (item.type === 'user') {
      router.push('/admin/users' as any);
    } else if (item.type === 'club') {
      router.push('/admin/clubs' as any);
    }
  }

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const cfg = TYPE_CONFIG[item.type];
    return (
      <TouchableOpacity style={styles.row} onPress={() => handlePress(item)} activeOpacity={0.7}>
        <View style={[styles.iconBox, { backgroundColor: cfg.color + '22' }]}>
          <Text style={styles.icon}>{cfg.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{item.sub}</Text>
        </View>
        <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  const eventStatus = eventDetail ? getEventStatus(eventDetail.date, eventDetail.status) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Aktivita</Text>
        <Text style={styles.count}>{items.length}{hasMore ? '+' : ''}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.lime} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() => loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color={Colors.lime} /> : null}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}

      {/* Event detail modal */}
      <Modal visible={!!eventDetail || eventLoading} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEventDetail(null)}>
        <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setEventDetail(null); setCancelReason(''); }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Detail podujatia</Text>
            <View style={{ width: 32 }} />
          </View>

          {eventLoading ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={Colors.black} />
          ) : eventDetail ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
              {eventDetail.cover_url && (
                <Image source={{ uri: eventDetail.cover_url }} style={styles.cover} />
              )}

              {/* Status badge */}
              {eventStatus && (
                <View style={[styles.statusBadge, { backgroundColor: eventStatus.bg }]}>
                  <Text style={[styles.statusText, { color: eventStatus.color }]}>{eventStatus.label}</Text>
                </View>
              )}

              <Text style={styles.eventTitle}>{eventDetail.title}</Text>
              <Text style={styles.eventSub}>od {eventDetail.creator_name} · {eventDetail.city}</Text>
              <Text style={styles.eventSub}>{eventDetail.date} o {eventDetail.time}</Text>
              <Text style={styles.eventSub}>{eventDetail.is_free ? 'Zadarmo' : `€${eventDetail.price}`}</Text>

              {eventDetail.status === 'cancelled' && eventDetail.cancellationReason && (
                <View style={styles.cancelledBox}>
                  <Text style={styles.cancelledLabel}>ZRUŠENÉ</Text>
                  <Text style={styles.cancelledReason}>{eventDetail.cancellationReason}</Text>
                </View>
              )}

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{eventDetail.attendeeCount}</Text>
                  <Text style={styles.statLbl}>Účastníci</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{eventDetail.paidCount}</Text>
                  <Text style={styles.statLbl}>Zaplatené lístky</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>€{eventDetail.gross.toFixed(0)}</Text>
                  <Text style={styles.statLbl}>Hrubý príjem</Text>
                </View>
              </View>

              {/* Attendees */}
              {eventDetail.attendees.length > 0 && (
                <View style={styles.attendeesSection}>
                  <Text style={styles.actionLabel}>ÚČASTNÍCI ({eventDetail.attendeeCount})</Text>
                  {eventDetail.attendees.map(a => (
                    <View key={a.id} style={styles.attendeeRow}>
                      <View style={styles.attendeeAvatar}>
                        {a.avatar_url
                          ? <Image source={{ uri: a.avatar_url }} style={styles.attendeeAvatarImg} />
                          : <Text style={styles.attendeeInitial}>{(a.name || '?').charAt(0).toUpperCase()}</Text>
                        }
                      </View>
                      <Text style={styles.attendeeName} numberOfLines={1}>{a.name}</Text>
                      {a.paid && <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>zaplatené</Text></View>}
                    </View>
                  ))}
                </View>
              )}

              {/* View button */}
              <TouchableOpacity style={styles.viewBtn} onPress={() => { setEventDetail(null); router.push(`/event/${eventDetail.id}` as any); }} activeOpacity={0.8}>
                <Text style={styles.viewBtnText}>Zobraziť podujatie →</Text>
              </TouchableOpacity>

              {/* Cancel */}
              {eventDetail.status === 'active' && (
                <View style={styles.actionSection}>
                  <Text style={styles.actionLabel}>ZRUŠIŤ PODUJATIE</Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Dôvod zrušenia (povinné)"
                    placeholderTextColor={Colors.gray}
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                  />
                  <TouchableOpacity style={[styles.cancelBtn, actionLoading && { opacity: 0.5 }]} onPress={cancelEvent} disabled={actionLoading}>
                    <Text style={styles.cancelBtnText}>Zrušiť podujatie a notifikovať účastníkov</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delete */}
              <View style={styles.actionSection}>
                <Text style={styles.actionLabel}>NEBEZPEČNÁ ZÓNA</Text>
                <TouchableOpacity style={[styles.deleteBtn, actionLoading && { opacity: 0.5 }]} onPress={deleteEvent} disabled={actionLoading}>
                  <Text style={styles.deleteBtnText}>Natrvalo vymazať podujatie</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <AdminTabBar active="activity" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  count: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sep: { height: 1, backgroundColor: '#1C1C1C', marginLeft: 72 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18 },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.white },
  rowSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular, marginTop: 2 },
  rowTime: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: Fonts.regular },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  cover: { width: '100%', height: 180, borderRadius: 16 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700', fontFamily: Fonts.bold },
  eventTitle: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  eventSub: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, marginTop: -12 },
  cancelledBox: { backgroundColor: '#FFF0E8', borderRadius: 12, padding: 14 },
  cancelledLabel: { fontSize: 10, fontWeight: '800', color: '#E85D04', letterSpacing: 1, marginBottom: 4 },
  cancelledReason: { fontSize: 13, color: '#E85D04', fontFamily: Fonts.regular },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statLbl: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center' },
  attendeesSection: { gap: 6 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  attendeeAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  attendeeAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  attendeeInitial: { fontSize: 15, fontWeight: '700', color: Colors.black },
  attendeeName: { flex: 1, fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.black },
  paidBadge: { backgroundColor: '#D0FFD8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  paidBadgeText: { fontSize: 10, fontWeight: '700', color: '#006B28' },
  viewBtn: { backgroundColor: Colors.grayLight, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  viewBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  actionSection: { gap: 10 },
  actionLabel: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase' },
  reasonInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, minHeight: 60 },
  cancelBtn: { backgroundColor: '#FFF0E8', borderRadius: 14, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: '#E85D04' },
  deleteBtn: { backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: '#CC0000' },
});
