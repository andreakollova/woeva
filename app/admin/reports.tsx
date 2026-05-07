import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';

type ReportRow = {
  id: string;
  type: 'inappropriate' | 'spam' | 'harassment';
  target_id: string;
  reporter_id: string;
  reporter_name: string;
  reason: string;
  status: 'open' | 'in_review' | 'closed';
  admin_note: string | null;
  created_at: string;
};

type StatusTab = 'open' | 'in_review' | 'closed';

const STATUS_COLORS: Record<string, string> = {
  open: '#FFE0E0',
  in_review: '#FFF0E0',
  closed: '#E0F0FF',
};
const STATUS_TEXT_COLORS: Record<string, string> = {
  open: '#CC0000',
  in_review: '#E85D04',
  closed: '#0066CC',
};

function timeFmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminReportsScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [tab, setTab] = useState<StatusTab>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadReports() {
    const { data } = await supabase
      .from('reports')
      .select('id, type, target_id, reporter_id, reason, status, admin_note, created_at, reporter:profiles!reports_reporter_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!data) { setLoading(false); setRefreshing(false); return; }
    setReports((data as any[]).map(r => ({
      ...r,
      reporter_name: (r.reporter as any)?.name ?? '—',
    })));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadReports(); }, []);

  const filtered = reports.filter(r => r.status === tab);

  const counts = {
    open: reports.filter(r => r.status === 'open').length,
    in_review: reports.filter(r => r.status === 'in_review').length,
    closed: reports.filter(r => r.status === 'closed').length,
  };

  async function updateStatus(reportId: string, newStatus: 'open' | 'in_review' | 'closed', note?: string) {
    setSaving(true);
    await supabase.from('reports').update({
      status: newStatus,
      admin_note: note ?? selected?.admin_note ?? null,
      reviewed_by: adminUser?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', reportId);

    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus, admin_note: note ?? r.admin_note } : r));
    if (selected?.id === reportId) {
      setSelected(s => s ? { ...s, status: newStatus, admin_note: note ?? s.admin_note } : null);
    }
    setSaving(false);
  }

  async function saveNote() {
    if (!selected) return;
    await updateStatus(selected.id, selected.status, adminNote);
    setAdminNote('');
  }

  function openDetail(r: ReportRow) {
    setSelected(r);
    setAdminNote(r.admin_note ?? '');
  }

  const typeLabels: Record<string, string> = {
    inappropriate: '⚠️ Inappropriate',
    spam: '🗑 Spam',
    harassment: '🚫 Harassment',
  };

  const TABS: { key: StatusTab; label: string }[] = [
    { key: 'open', label: `Open (${counts.open})` },
    { key: 'in_review', label: `In review (${counts.in_review})` },
    { key: 'closed', label: `Closed (${counts.closed})` },
  ];

  const renderReport = ({ item }: { item: ReportRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
      <View style={[styles.typeBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
        <Text style={[styles.typeBadgeText, { color: STATUS_TEXT_COLORS[item.status] }]}>
          {item.type.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.reason || '(no reason given)'}</Text>
        <Text style={styles.rowSub}>Reported by {item.reporter_name} · {timeFmt(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Reports</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No {tab.replace('_', ' ')} reports</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          renderItem={renderReport}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Report detail</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>{typeLabels[selected.type]}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reported by</Text>
                <Text style={styles.detailValue}>{selected.reporter_name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{timeFmt(selected.created_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Target ID</Text>
                <Text style={[styles.detailValue, { fontSize: 11, fontFamily: 'monospace' }]}>{selected.target_id}</Text>
              </View>
              {selected.reason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.detailLabel}>Reason</Text>
                  <Text style={styles.reasonText}>{selected.reason}</Text>
                </View>
              ) : null}

              {/* Status actions */}
              <View style={styles.actionSection}>
                <Text style={styles.actionSectionTitle}>STATUS</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['open', 'in_review', 'closed'] as StatusTab[]).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusBtn, selected.status === s && styles.statusBtnActive]}
                      onPress={() => updateStatus(selected.id, s)}
                      disabled={saving}
                    >
                      <Text style={[styles.statusBtnText, selected.status === s && styles.statusBtnTextActive]}>
                        {s.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Admin note */}
              <View style={styles.actionSection}>
                <Text style={styles.actionSectionTitle}>ADMIN NOTE</Text>
                <TextInput
                  style={styles.noteInput}
                  value={adminNote}
                  onChangeText={setAdminNote}
                  placeholder="Add an internal note..."
                  placeholderTextColor={Colors.gray}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.saveNoteBtn, saving && { opacity: 0.5 }]}
                  onPress={saveNote}
                  disabled={saving}
                >
                  <Text style={styles.saveNoteBtnText}>Save note</Text>
                </TouchableOpacity>
              </View>

              {selected.admin_note ? (
                <View style={styles.savedNote}>
                  <Text style={styles.savedNoteLabel}>Saved note:</Text>
                  <Text style={styles.savedNoteText}>{selected.admin_note}</Text>
                </View>
              ) : null}
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
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.grayLight, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 12, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.lime },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  sep: { height: 1, backgroundColor: Colors.grayBorder, marginLeft: 20 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  detailLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.black, flex: 1, textAlign: 'right' },
  reasonBox: { backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14, gap: 6 },
  reasonText: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, lineHeight: 20 },
  actionSection: { gap: 10 },
  actionSectionTitle: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase' },
  statusBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.grayLight, alignItems: 'center' },
  statusBtnActive: { backgroundColor: Colors.black },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold, textTransform: 'capitalize' },
  statusBtnTextActive: { color: Colors.lime },
  noteInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, minHeight: 80 },
  saveNoteBtn: { backgroundColor: Colors.black, borderRadius: 12, padding: 12, alignItems: 'center' },
  saveNoteBtnText: { color: Colors.lime, fontSize: 14, fontWeight: '700', fontFamily: Fonts.bold },
  savedNote: { backgroundColor: '#FFFDE0', borderRadius: 12, padding: 14, gap: 4 },
  savedNoteLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  savedNoteText: { fontSize: 13, color: Colors.black, fontFamily: Fonts.regular },
});
