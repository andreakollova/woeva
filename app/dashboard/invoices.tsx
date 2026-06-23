import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';
import { generateCreatorInvoice } from '@/lib/generateInvoice';
import { useTranslations } from '@/context/LanguageContext';

// ─── Fee constants (must match dashboard) ──────────────────────────────────────
const STRIPE_PCT = 0.015;
const STRIPE_FIXED = 0.25;

function fmt(n: number) { return `€${n.toFixed(2)}`; }

function calcRevenue(price: number, onlineCount: number, doorCount: number) {
  const onlineGross = price * onlineCount;
  const doorGross = price * doorCount;
  const gross = onlineGross + doorGross;
  const woevaFeePerTicket = onlineCount > 0 ? Math.round((price * 0.04 + 0.50) * 100) / 100 : 0;
  const woeva_fee = Math.round(woevaFeePerTicket * onlineCount * 100) / 100;
  const stripe_fee = onlineCount > 0 ? Math.round((onlineGross * STRIPE_PCT + onlineCount * STRIPE_FIXED) * 100) / 100 : 0;
  const onlineNet = Math.max(0, Math.round((onlineGross - woeva_fee) * 100) / 100);
  const net = Math.round((onlineNet + doorGross) * 100) / 100;
  return { gross, onlineGross, doorGross, stripe_fee, woeva_fee, onlineNet, net };
}

type EventRow = {
  id: string; title: string; date: string;
  price: number; is_free: boolean;
  online_count: number; door_count: number;
  onlineGross: number; onlineNet: number;
  stripe_fee: number; woeva_fee: number;
  gross: number; net: number; paid_count: number;
};

type MonthGroup = {
  key: string; label: string;
  gross: number; net: number;
  events: EventRow[];
};

type BillingInfo = {
  id: string; company_name: string; ico: string; dic: string | null;
  address: string; city: string; country: string;
};

function canDownloadMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const now = new Date();
  const cy = now.getFullYear(), cm = now.getMonth() + 1;
  if (year < cy || (year === cy && month < cm)) return true;
  if (year === cy && month === cm) {
    const lastDay = new Date(cy, cm, 0).getDate();
    return now.getDate() >= lastDay;
  }
  return false;
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, lang } = useTranslations();

  const [loading, setLoading] = useState(true);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthGroup[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [user]));

  async function load() {
    if (!user) return;
    setLoading(true);

    const [{ data: billingData }, { data: clubsData }] = await Promise.all([
      supabase.from('creator_billing').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('clubs').select('id').eq('creator_id', user.id),
    ]);
    setBilling(billingData ?? null);

    const clubIds = (clubsData ?? []).map((c: any) => c.id);
    const { data: eventsData } = clubIds.length > 0
      ? await supabase.from('events')
          .select('id, title, date, price, is_free')
          .or(`creator_id.eq.${user.id},club_id.in.(${clubIds.join(',')})`)
          .order('date', { ascending: false })
      : await supabase.from('events')
          .select('id, title, date, price, is_free')
          .eq('creator_id', user.id)
          .order('date', { ascending: false });

    const paidEvents = (eventsData ?? []).filter((e: any) => !e.is_free && (e.price ?? 0) > 0);

    if (paidEvents.length > 0) {
      const { data: attsData } = await supabase
        .from('event_attendees')
        .select('event_id, user_id, payment_intent_id, paid, profile:profiles(avatar_url)')
        .in('event_id', paidEvents.map((e: any) => e.id));

      const onlineCounts: Record<string, number> = {};
      const doorCounts: Record<string, number> = {};
      (attsData ?? []).forEach((a: any) => {
        if ((a.profile?.avatar_url ?? '').includes('/bots/') || !a.paid) return;
        if (a.payment_intent_id) onlineCounts[a.event_id] = (onlineCounts[a.event_id] ?? 0) + 1;
        else doorCounts[a.event_id] = (doorCounts[a.event_id] ?? 0) + 1;
      });

      const rows: EventRow[] = paidEvents.map((e: any) => {
        const oc = onlineCounts[e.id] ?? 0;
        const dc = doorCounts[e.id] ?? 0;
        return { ...e, online_count: oc, door_count: dc, paid_count: oc + dc, ...calcRevenue(e.price ?? 0, oc, dc) };
      });

      // Group by month
      const map: Record<string, MonthGroup> = {};
      rows.filter(e => e.onlineGross > 0).forEach(e => {
        const d = new Date(e.date + 'T00:00:00');
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map[key]) {
          const raw = d.toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { month: 'long', year: 'numeric' });
          map[key] = { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), gross: 0, net: 0, events: [] };
        }
        map[key].gross += e.onlineGross;
        map[key].net += e.onlineNet;
        map[key].events.push(e);
      });
      setMonthlyEarnings(Object.values(map).sort((a, b) => b.key.localeCompare(a.key)));
    } else {
      setMonthlyEarnings([]);
    }

    setLoading(false);
  }

  async function downloadMonth(m: MonthGroup) {
    if (!billing) {
      Alert.alert(
        lang === 'sk' ? 'Chýbajú fakturačné údaje' : 'Missing billing details',
        lang === 'sk' ? 'Prosím vyplňte fakturačné údaje v nastaveniach výplat.' : 'Please fill in billing details in payout settings.'
      );
      return;
    }
    const [year, month] = m.key.split('-').map(Number);
    const invoiceNum = `W-${year}-${String(month).padStart(2, '0')}`;
    const invoiceEvents = m.events.map(e => ({
      title: e.title, date: e.date,
      paid_count: e.online_count,
      gross: e.onlineGross, stripe_fee: e.stripe_fee,
      woeva_fee: e.woeva_fee, net: e.onlineNet,
    }));
    const html = generateCreatorInvoice(billing, invoiceEvents, m.label, invoiceNum);
    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoiceNum}` });
    } catch {
      Alert.alert(
        lang === 'sk' ? 'PDF nie je dostupné' : 'PDF unavailable',
        'npx expo install expo-print expo-sharing'
      );
    }
  }

  async function exportAll() {
    const available = monthlyEarnings.filter(m => canDownloadMonth(m.key));
    if (!billing || available.length === 0) return;
    setExporting(true);
    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      // Generate one combined PDF with all months
      const sections = available.map(m => {
        const [year, month] = m.key.split('-').map(Number);
        const invoiceNum = `W-${year}-${String(month).padStart(2, '0')}`;
        return generateCreatorInvoice(
          billing,
          m.events.map(e => ({
            title: e.title, date: e.date, paid_count: e.online_count,
            gross: e.onlineGross, stripe_fee: e.stripe_fee,
            woeva_fee: e.woeva_fee, net: e.onlineNet,
          })),
          m.label,
          invoiceNum
        );
      });
      // Combine into multi-page HTML
      const combined = sections.map((html, i) => {
        const body = html.replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '');
        return i < sections.length - 1 ? `${body}<div style="page-break-after:always"></div>` : body;
      });
      const fullHtml = `<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8"/><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:40px;color:#0a0a0a;font-size:13px;}@media print{.page-break{page-break-after:always}}</style></head><body>${combined.join('')}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html: fullHtml, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Woeva-faktury.pdf' });
    } catch {
      Alert.alert(lang === 'sk' ? 'Chyba' : 'Error', lang === 'sk' ? 'Nepodarilo sa exportovať.' : 'Export failed.');
    }
    setExporting(false);
  }

  const filtered = useMemo(
    () => selectedMonth ? monthlyEarnings.filter(m => m.key === selectedMonth) : monthlyEarnings,
    [monthlyEarnings, selectedMonth]
  );

  const availableCount = monthlyEarnings.filter(m => canDownloadMonth(m.key)).length;

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <BackButton />
          <Text style={s.title}>{t.dashboard.invoicesLabel}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ActivityIndicator style={{ marginTop: 80 }} color={Colors.black} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <BackButton />
        <Text style={s.title}>{t.dashboard.invoicesLabel}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Month filter pills */}
      {monthlyEarnings.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillsRow}
          style={s.pillsScroll}
        >
          <TouchableOpacity
            style={[s.pill, !selectedMonth && s.pillActive]}
            onPress={() => setSelectedMonth(null)}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, !selectedMonth && s.pillTextActive]}>
              {lang === 'sk' ? 'Všetky' : 'All'}
            </Text>
          </TouchableOpacity>
          {monthlyEarnings.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[s.pill, selectedMonth === m.key && s.pillActive]}
              onPress={() => setSelectedMonth(selectedMonth === m.key ? null : m.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, selectedMonth === m.key && s.pillTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {monthlyEarnings.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>{lang === 'sk' ? 'Zatiaľ žiadne faktúry' : 'No invoices yet'}</Text>
            <Text style={s.emptySub}>{lang === 'sk' ? 'Faktúry sa zobrazia po prvom predanom lístku.' : 'Invoices appear after your first sold ticket.'}</Text>
          </View>
        ) : (
          <>
            {/* Bulk export */}
            {availableCount > 1 && !selectedMonth && (
              <TouchableOpacity style={s.bulkBtn} onPress={exportAll} activeOpacity={0.75} disabled={exporting}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={s.bulkBtnText}>
                  {exporting
                    ? (lang === 'sk' ? 'Exportuje sa…' : 'Exporting…')
                    : (lang === 'sk' ? `Exportovať všetky (${availableCount})` : `Export all (${availableCount})`)}
                </Text>
              </TouchableOpacity>
            )}

            {filtered.map(m => {
              const available = canDownloadMonth(m.key);
              return (
                <View key={m.key} style={s.card}>
                  {/* Month + status */}
                  <View style={s.cardTop}>
                    <Text style={s.cardMonth}>{m.label}</Text>
                    {available ? (
                      <View style={s.badgeReady}><Text style={s.badgeReadyText}>{t.dashboard.invoiceReady}</Text></View>
                    ) : (
                      <View style={s.badgePending}><Text style={s.badgePendingText}>{t.dashboard.invoicePendingLabel}</Text></View>
                    )}
                  </View>

                  {/* Stats */}
                  <View style={s.statsRow}>
                    <View style={s.statBlock}>
                      <Text style={s.statLabel}>{t.dashboard.invoiceEventsLabel}</Text>
                      <Text style={s.statVal}>{m.events.length}</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.statBlock}>
                      <Text style={s.statLabel}>{t.dashboard.invoiceGrossLabel}</Text>
                      <Text style={s.statVal}>{fmt(m.gross)}</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.statBlock}>
                      <Text style={s.statLabel}>{t.dashboard.invoiceOnlineNet}</Text>
                      <Text style={[s.statVal, { color: '#16A34A' }]}>{fmt(m.net)}</Text>
                    </View>
                  </View>

                  {/* Event breakdown */}
                  {m.events.map((e, i) => (
                    <View key={e.id} style={[s.eventRow, i === 0 && s.eventRowFirst]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                        <Text style={s.eventDate}>
                          {new Date(e.date + 'T00:00:00').toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {e.online_count > 0 ? ` · ${e.online_count} ${lang === 'sk' ? 'lístkov' : 'tickets'}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.eventGross}>{fmt(e.onlineGross)}</Text>
                        <Text style={s.eventNet}>{fmt(e.onlineNet)} net</Text>
                      </View>
                    </View>
                  ))}

                  {/* Download */}
                  {available ? (
                    <TouchableOpacity style={s.downloadBtn} onPress={() => downloadMonth(m)} activeOpacity={0.75}>
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={s.downloadBtnText}>{t.dashboard.downloadPdf}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.pendingNote}>
                      {lang === 'sk' ? 'Dostupné na konci mesiaca' : 'Available at the end of the month'}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },

  pillsScroll: { maxHeight: 52 },
  pillsRow: { paddingHorizontal: 20, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight },
  pillActive: { backgroundColor: Colors.black },
  pillText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.black },
  pillTextActive: { color: Colors.lime, fontFamily: Fonts.bold },

  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, marginBottom: 8 },
  emptySub: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.gray, textAlign: 'center', lineHeight: 20 },

  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.black, borderRadius: 14, paddingVertical: 14, marginBottom: 4,
  },
  bulkBtnText: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white },

  card: { backgroundColor: '#F7F7F7', borderRadius: 20, padding: 20, gap: 0 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardMonth: { fontSize: 18, fontWeight: '800', fontFamily: Fonts.bold, color: Colors.black },

  badgeReady: { backgroundColor: '#E8F5E9', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  badgeReadyText: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.bold, color: '#2E7D32' },
  badgePending: { backgroundColor: '#F5F5F5', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  badgePendingText: { fontSize: 11, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },

  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 0 },
  statBlock: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.grayBorder },
  statLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  statVal: { fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },

  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E0' },
  eventRowFirst: { marginTop: 12 },
  eventTitle: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  eventDate: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.gray, marginTop: 2 },
  eventGross: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  eventNet: { fontSize: 11, fontFamily: Fonts.regular, color: '#16A34A', marginTop: 1 },

  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.black, borderRadius: 14, paddingVertical: 13, marginTop: 14,
  },
  downloadBtnText: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white },
  pendingNote: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.gray, textAlign: 'center', marginTop: 14 },
});
