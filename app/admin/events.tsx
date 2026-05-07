import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, Image, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';
import { notify } from '@/lib/notify';

type EventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  cover_url: string | null;
  going_count: number;
  price: number;
  is_free: boolean;
  status: string;
  city: string;
  created_at: string;
  creator_id: string;
  creator_name: string;
  creator_email: string | null;
};

type EventDetail = EventRow & {
  attendeeCount: number;
  paidCount: number;
  gross: number;
  cancellationReason: string | null;
};

type FilterTab = 'all' | 'active' | 'cancelled' | 'past';

export default function AdminEventsScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<EventDetail | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadEvents() {
    const { data } = await supabase
      .from('events')
      .select('id, title, date, time, cover_url, going_count, price, is_free, status, city, created_at, creator_id, creator:profiles!events_creator_id_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!data) { setLoading(false); setRefreshing(false); return; }
    setEvents((data as any[]).map(e => ({
      ...e,
      creator_name: (e.creator as any)?.name ?? '—',
      creator_email: (e.creator as any)?.email ?? null,
    })));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadEvents(); }, []);

  function applyFilters(list: EventRow[]) {
    const now = new Date().toISOString().slice(0, 10);
    let result = list;
    if (filter === 'active') result = result.filter(e => e.status === 'active' && e.date >= now);
    else if (filter === 'cancelled') result = result.filter(e => e.status === 'cancelled');
    else if (filter === 'past') result = result.filter(e => e.status === 'active' && e.date < now);

    const q = search.toLowerCase().trim();
    if (q) result = result.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.creator_name.toLowerCase().includes(q) ||
      e.city.toLowerCase().includes(q)
    );
    return result;
  }

  async function openDetail(e: EventRow) {
    setSelected({ ...e, attendeeCount: 0, paidCount: 0, gross: 0, cancellationReason: null });

    const [{ count: attendeeCount }, { data: paid }] = await Promise.all([
      supabase.from('event_attendees').select('id', { count: 'exact', head: true }).eq('event_id', e.id),
      supabase.from('event_attendees').select('id').eq('event_id', e.id).eq('paid', true),
    ]);
    const paidCount = paid?.length ?? 0;
    const gross = paidCount * e.price;

    // Get cancellation reason
    const { data: ev } = await supabase.from('events').select('cancellation_reason').eq('id', e.id).single();

    setSelected({ ...e, attendeeCount: attendeeCount ?? 0, paidCount, gross, cancellationReason: ev?.cancellation_reason ?? null });
  }

  async function logAction(action: string, targetName: string, note?: string) {
    await supabase.from('admin_log').insert({
      admin_id: adminUser?.id,
      action,
      target_type: 'event',
      target_id: selected?.id,
      target_name: targetName,
      note: note ?? null,
    });
  }

  async function cancelEvent() {
    if (!selected) return;
    if (!cancelReason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for cancellation.');
      return;
    }
    Alert.alert(
      'Cancel event',
      `Cancel "${selected.title}"? All attendees will be notified.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel event', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await supabase.from('events').update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancellation_reason: cancelReason.trim(),
            }).eq('id', selected.id);

            // Notify attendees
            const { data: attendees } = await supabase
              .from('event_attendees')
              .select('user_id, profile:profiles(push_token, email)')
              .eq('event_id', selected.id);

            const tokens = (attendees ?? []).map((a: any) => a.profile?.push_token).filter(Boolean);
            const emails = (attendees ?? []).map((a: any) => a.profile?.email).filter(Boolean);

            await notify.eventCancelled({
              eventId: selected.id,
              eventTitle: selected.title,
              creatorName: 'Woeva Admin',
              reason: cancelReason.trim(),
              attendeeTokens: tokens,
              attendeeEmails: emails,
            });

            await logAction('cancel_event', selected.title, cancelReason.trim());
            setSelected(s => s ? { ...s, status: 'cancelled', cancellationReason: cancelReason.trim() } : null);
            setEvents(prev => prev.map(e => e.id === selected.id ? { ...e, status: 'cancelled' } : e));
            setCancelReason('');
            setActionLoading(false);
          },
        },
      ]
    );
  }

  async function deleteEventConfirm1() {
    if (!selected) return;
    Alert.alert(
      'Delete event',
      `Delete "${selected.title}"? This will remove all attendees and chat history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: deleteEventConfirm2 },
      ]
    );
  }

  async function deleteEventConfirm2() {
    if (!selected) return;
    Alert.alert(
      'Final confirmation',
      `"${selected.title}" will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await logAction('delete_event', selected.title);
            await supabase.from('events').delete().eq('id', selected.id);
            setEvents(prev => prev.filter(e => e.id !== selected.id));
            setSelected(null);
            setActionLoading(false);
          },
        },
      ]
    );
  }

  const filtered = applyFilters(events);
  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'past', label: 'Past' },
  ];

  const renderEvent = ({ item }: { item: EventRow }) => {
    const isPast = item.date < new Date().toISOString().slice(0, 10);
    return (
      <TouchableOpacity style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
        <View style={styles.cover}>
          {item.cover_url
            ? <Image source={{ uri: item.cover_url }} style={StyleSheet.absoluteFill as any} />
            : <Text style={styles.coverInitial}>{item.title.charAt(0)}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowSub}>{item.creator_name} · {item.date}</Text>
          <Text style={styles.rowSub}>{item.going_count} going · {item.is_free ? 'Free' : `€${item.price}`}</Text>
        </View>
        <View style={[styles.statusBadge,
          item.status === 'cancelled' && styles.statusCancelled,
          isPast && item.status !== 'cancelled' && styles.statusPast,
        ]}>
          <Text style={styles.statusText}>
            {item.status === 'cancelled' ? 'CANCELLED' : isPast ? 'PAST' : 'ACTIVE'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Events</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search title, creator, city..."
          placeholderTextColor={Colors.gray}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filter === t.key && styles.tabActive]}
            onPress={() => setFilter(t.key)}
          >
            <Text style={[styles.tabText, filter === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={renderEvent}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEvents(); }} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* Event detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Event detail</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
              {/* Cover */}
              {selected.cover_url && (
                <Image source={{ uri: selected.cover_url }} style={styles.detailCover} />
              )}

              <Text style={styles.detailTitle}>{selected.title}</Text>
              <Text style={styles.detailSub}>by {selected.creator_name} · {selected.city}</Text>
              <Text style={styles.detailSub}>{selected.date} at {selected.time}</Text>

              {selected.status === 'cancelled' && selected.cancellationReason && (
                <View style={styles.cancelledBox}>
                  <Text style={styles.cancelledLabel}>CANCELLED</Text>
                  <Text style={styles.cancelledReason}>{selected.cancellationReason}</Text>
                </View>
              )}

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{selected.attendeeCount}</Text>
                  <Text style={styles.statLbl}>Attendees</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{selected.paidCount}</Text>
                  <Text style={styles.statLbl}>Paid tickets</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>€{selected.gross.toFixed(0)}</Text>
                  <Text style={styles.statLbl}>Gross</Text>
                </View>
              </View>

              {/* Cancel action */}
              {selected.status === 'active' && (
                <View style={styles.actionSection}>
                  <Text style={styles.actionSectionTitle}>CANCEL EVENT</Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Reason for cancellation (required)"
                    placeholderTextColor={Colors.gray}
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FFF0E8' }]}
                    onPress={cancelEvent}
                    disabled={actionLoading}
                  >
                    <Text style={[styles.actionBtnText, { color: '#E85D04' }]}>Cancel event & notify attendees</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delete action */}
              <View style={styles.actionSection}>
                <Text style={styles.actionSectionTitle}>DANGER ZONE</Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FFF0F0' }]}
                  onPress={deleteEventConfirm1}
                  disabled={actionLoading}
                >
                  <Text style={[styles.actionBtnText, { color: '#CC0000' }]}>Delete event permanently</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  count: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  search: { backgroundColor: Colors.grayLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.grayLight },
  tabActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 13, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.lime },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  sep: { height: 1, backgroundColor: Colors.grayBorder, marginLeft: 76 },
  cover: { width: 52, height: 44, borderRadius: 10, backgroundColor: Colors.grayBorder, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontSize: 22, color: Colors.white },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  statusBadge: { backgroundColor: '#E8FFE8', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  statusCancelled: { backgroundColor: '#FFE0E0' },
  statusPast: { backgroundColor: Colors.grayLight },
  statusText: { fontSize: 9, fontWeight: '700', color: Colors.black },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  detailCover: { width: '100%', height: 180, borderRadius: 16 },
  detailTitle: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  detailSub: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  cancelledBox: { backgroundColor: '#FFF0E8', borderRadius: 12, padding: 14 },
  cancelledLabel: { fontSize: 10, fontWeight: '800', color: '#E85D04', letterSpacing: 1, marginBottom: 4 },
  cancelledReason: { fontSize: 13, color: '#E85D04', fontFamily: Fonts.regular },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statLbl: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center' },
  actionSection: { gap: 10 },
  actionSectionTitle: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase' },
  reasonInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, minHeight: 60 },
  actionBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
});
