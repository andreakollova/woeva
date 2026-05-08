import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AdminTabBar } from '@/components/admin/AdminTabBar';
import { generateFormalInvoice } from '@/lib/generateInvoice';

type Period = '7days' | 'month' | '3months' | 'year' | 'all';

type InvoiceRow = {
  id: string;
  invoice_number: string;
  creator_id: string | null;
  creator_name: string;
  creator_email: string | null;
  billing_info: any;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  events_data: any[];
  gross: number;
  stripe_fee: number;
  woeva_fee: number;
  net: number;
  status: 'draft' | 'issued' | 'paid';
  created_at: string;
};

type Revenue = {
  gross: number;
  woeva_fee: number;
  stripe_fee: number;
  net: number;
};

const STATUS_COLOR: Record<string, string> = {
  draft: Colors.grayBorder,
  issued: '#FFF0D0',
  paid: '#D0FFD8',
};
const STATUS_TEXT: Record<string, string> = {
  draft: Colors.gray,
  issued: '#B86000',
  paid: '#006B28',
};

function fmt(n: number) { return `€${n.toFixed(2)}`; }

function dateFmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getPeriodRange(period: Period): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (period === '7days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start, end: null };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: null };
  }
  if (period === '3months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    return { start, end: null };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end: null };
  }
  return { start: null, end: null };
}

export default function AdminBillingScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [period, setPeriod] = useState<Period>('7days');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [revenue, setRevenue] = useState<Revenue>({ gross: 0, woeva_fee: 0, stripe_fee: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { start, end } = getPeriodRange(period);

    let invoiceQuery = supabase
      .from('invoices')
      .select('*, creator:profiles!invoices_creator_id_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(200);

    let revenueQuery = supabase
      .from('platform_revenue')
      .select('gross, woeva_fee, stripe_fee, net');

    if (start) {
      invoiceQuery = invoiceQuery.gte('created_at', start.toISOString());
      revenueQuery = revenueQuery.gte('created_at', start.toISOString());
    }
    if (end) {
      invoiceQuery = invoiceQuery.lt('created_at', end.toISOString());
      revenueQuery = revenueQuery.lt('created_at', end.toISOString());
    }

    const [{ data: invoiceData }, { data: revenueData }] = await Promise.all([
      invoiceQuery,
      revenueQuery,
    ]);

    const rows: InvoiceRow[] = ((invoiceData ?? []) as any[]).map(inv => ({
      ...inv,
      creator_name: (inv.creator as any)?.name ?? '—',
      creator_email: (inv.creator as any)?.email ?? null,
    }));
    setInvoices(rows);

    const rev = (revenueData ?? []) as any[];
    setRevenue({
      gross: rev.reduce((s, r) => s + (r.gross ?? 0), 0),
      woeva_fee: rev.reduce((s, r) => s + (r.woeva_fee ?? 0), 0),
      stripe_fee: rev.reduce((s, r) => s + (r.stripe_fee ?? 0), 0),
      net: rev.reduce((s, r) => s + (r.net ?? 0), 0),
    });

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, [period]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [period]);

  async function markAsPaid(inv: InvoiceRow) {
    Alert.alert(
      'Označiť ako zaplatené',
      `Označiť faktúru ${inv.invoice_number} ako zaplatenú?`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        {
          text: 'Zaplatené', onPress: async () => {
            setSaving(true);
            await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id);
            await supabase.from('admin_log').insert({
              admin_id: adminUser?.id,
              action: 'invoice_paid',
              target_type: 'invoice',
              target_id: inv.id,
              note: `Invoice ${inv.invoice_number} for ${inv.creator_name} marked as paid`,
            });
            setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' } : i));
            setSelected(s => s?.id === inv.id ? { ...s, status: 'paid' } : s);
            setSaving(false);
          },
        },
      ]
    );
  }

  async function viewPdf(inv: InvoiceRow) {
    if (!inv.billing_info) {
      Alert.alert('Missing info', 'No billing information on this invoice.');
      return;
    }
    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const html = generateFormalInvoice(inv.billing_info, inv.events_data ?? [], inv.period_label, inv.invoice_number);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${inv.invoice_number}` });
    } catch {
      Alert.alert('PDF unavailable', 'Install expo-print and expo-sharing:\nnpx expo install expo-print expo-sharing');
    }
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: '7days',   label: '7 dní' },
    { key: 'month',   label: 'Tento mesiac' },
    { key: '3months', label: '3 mesiace' },
    { key: 'year',    label: 'Tento rok' },
    { key: 'all',     label: 'Celkovo' },
  ];

  const counts = {
    draft: invoices.filter(i => i.status === 'draft').length,
    issued: invoices.filter(i => i.status === 'issued').length,
    paid: invoices.filter(i => i.status === 'paid').length,
  };

  const renderInvoice = ({ item }: { item: InvoiceRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => setSelected(item)} activeOpacity={0.7}>
      <View style={styles.invoiceNumBox}>
        <Text style={styles.invoiceNumText} numberOfLines={1}>{item.invoice_number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.creator_name}</Text>
        <Text style={styles.rowSub}>{item.period_label} · {dateFmt(item.created_at)}</Text>
        <Text style={styles.rowAmount}>{fmt(item.net)} net</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] }]}>
        <Text style={[styles.statusBadgeText, { color: STATUS_TEXT[item.status] }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Fakturácia</Text>
      </View>

      {/* Period filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.periodRow}
      >
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodPill, period === p.key && styles.periodPillActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodPillText, period === p.key && styles.periodPillTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={i => i.id}
          renderItem={renderInvoice}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={() => (
            <>
              {/* Revenue summary */}
              <View style={styles.revenueGrid}>
                <View style={styles.revenueRow}>
                  <View style={[styles.revCard, { backgroundColor: Colors.lime }]}>
                    <Text style={[styles.revNum, { color: Colors.black }]}>{fmt(revenue.woeva_fee)}</Text>
                    <Text style={[styles.revLabel, { color: 'rgba(0,0,0,0.55)' }]}>Woeva poplatky</Text>
                  </View>
                  <View style={styles.revCard}>
                    <Text style={styles.revNum}>{fmt(revenue.gross)}</Text>
                    <Text style={styles.revLabel}>Hrubý príjem</Text>
                  </View>
                </View>
                <View style={styles.revenueRow}>
                  <View style={styles.revCard}>
                    <Text style={styles.revNum}>{fmt(revenue.stripe_fee)}</Text>
                    <Text style={styles.revLabel}>Poplatky Stripe</Text>
                  </View>
                  <View style={[styles.revCard, { backgroundColor: '#1A1A1A' }]}>
                    <Text style={[styles.revNum, { color: Colors.white }]}>{fmt(revenue.net)}</Text>
                    <Text style={[styles.revLabel, { color: 'rgba(255,255,255,0.5)' }]}>Čistý príjem tvorcov</Text>
                  </View>
                </View>
              </View>

              {/* Invoice status summary */}
              <View style={styles.invoiceSummary}>
                <View style={styles.invoiceSummaryItem}>
                  <Text style={styles.invoiceSummaryNum}>{counts.draft}</Text>
                  <Text style={styles.invoiceSummaryLabel}>Návrh</Text>
                </View>
                <View style={[styles.invoiceSummaryDivider]} />
                <View style={styles.invoiceSummaryItem}>
                  <Text style={[styles.invoiceSummaryNum, { color: '#B86000' }]}>{counts.issued}</Text>
                  <Text style={styles.invoiceSummaryLabel}>Vystavené</Text>
                </View>
                <View style={styles.invoiceSummaryDivider} />
                <View style={styles.invoiceSummaryItem}>
                  <Text style={[styles.invoiceSummaryNum, { color: '#006B28' }]}>{counts.paid}</Text>
                  <Text style={styles.invoiceSummaryLabel}>Zaplatené</Text>
                </View>
              </View>

              {invoices.length > 0 && (
                <Text style={styles.listHeader}>FAKTÚRY ({invoices.length})</Text>
              )}
            </>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Žiadne faktúry za toto obdobie</Text>
            </View>
          )}
        />
      )}

      {/* Invoice detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selected.invoice_number}</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
              {/* Status badge */}
              <View style={{ alignItems: 'flex-start' }}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[selected.status] }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_TEXT[selected.status] }]}>
                    {selected.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.detailSection}>
                {[
                  { label: 'Tvorca', value: selected.creator_name },
                  { label: 'Email', value: selected.creator_email ?? '—' },
                  { label: 'Obdobie', value: selected.period_label },
                  { label: 'Vystavená', value: dateFmt(selected.created_at) },
                ].map(row => (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    <Text style={styles.detailValue}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {/* Amounts */}
              <View style={styles.amountSection}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Hrubý príjem</Text>
                  <Text style={styles.amountValue}>{fmt(selected.gross)}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Poplatky Stripe</Text>
                  <Text style={[styles.amountValue, { color: Colors.gray }]}>− {fmt(selected.stripe_fee)}</Text>
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Woeva poplatok (5%)</Text>
                  <Text style={[styles.amountValue, { color: Colors.gray }]}>− {fmt(selected.woeva_fee)}</Text>
                </View>
                <View style={[styles.amountRow, styles.amountRowTotal]}>
                  <Text style={styles.amountTotalLabel}>Čistý príjem tvorcu</Text>
                  <Text style={styles.amountTotalValue}>{fmt(selected.net)}</Text>
                </View>
              </View>

              {/* Billing info */}
              {selected.billing_info && (
                <View style={styles.billingBox}>
                  <Text style={styles.billingBoxTitle}>DODÁVATEĽ (Creator)</Text>
                  <Text style={styles.billingBoxText}>{selected.billing_info.company_name}</Text>
                  <Text style={styles.billingBoxText}>IČO: {selected.billing_info.ico}</Text>
                  {selected.billing_info.dic && (
                    <Text style={styles.billingBoxText}>DIČ: {selected.billing_info.dic}</Text>
                  )}
                  <Text style={styles.billingBoxText}>{selected.billing_info.address}</Text>
                  <Text style={styles.billingBoxText}>{selected.billing_info.city}, {selected.billing_info.country}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={() => viewPdf(selected)}
                >
                  <Text style={styles.pdfBtnText}>Zobraziť / Stiahnuť PDF</Text>
                </TouchableOpacity>

                {selected.status !== 'paid' && (
                  <TouchableOpacity
                    style={[styles.paidBtn, saving && { opacity: 0.6 }]}
                    onPress={() => markAsPaid(selected)}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color={Colors.black} />
                      : <Text style={styles.paidBtnText}>Označiť ako zaplatené</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
      <AdminTabBar active="billing" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8, paddingTop: 14 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  periodRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  periodPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1C1C1C' },
  periodPillActive: { backgroundColor: Colors.lime },
  periodPillText: { fontSize: 13, fontWeight: '500', fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.5)' },
  periodPillTextActive: { color: Colors.black, fontWeight: '700' },
  revenueGrid: { gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  revenueRow: { flexDirection: 'row', gap: 10 },
  revCard: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, gap: 4 },
  revNum: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  revLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },
  invoiceSummary: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 12 },
  invoiceSummaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  invoiceSummaryNum: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.white },
  invoiceSummaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },
  invoiceSummaryDivider: { width: 1, backgroundColor: '#333' },
  listHeader: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  sep: { height: 1, backgroundColor: '#1C1C1C', marginLeft: 20 },
  invoiceNumBox: { backgroundColor: '#1C1C1C', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, minWidth: 80, alignItems: 'center' },
  invoiceNumText: { fontSize: 10, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white, letterSpacing: 0.3 },
  rowTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.white },
  rowSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular, marginTop: 1 },
  rowAmount: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  detailSection: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 14, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  detailLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.black, flex: 1, textAlign: 'right' },
  amountSection: { backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, gap: 10 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountRowTotal: { borderTopWidth: 1, borderTopColor: Colors.grayBorder, paddingTop: 10, marginTop: 2 },
  amountLabel: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  amountValue: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  amountTotalLabel: { fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  amountTotalValue: { fontSize: 17, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  billingBox: { backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14, gap: 3 },
  billingBoxTitle: { fontSize: 10, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  billingBoxText: { fontSize: 13, color: Colors.black, fontFamily: Fonts.regular },
  pdfBtn: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 14, padding: 14, alignItems: 'center' },
  pdfBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  paidBtn: { backgroundColor: Colors.lime, borderRadius: 14, padding: 14, alignItems: 'center' },
  paidBtnText: { fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
});
