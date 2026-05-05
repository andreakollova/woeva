import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, Rect, Polyline, Polygon } from 'react-native-svg';
import { useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateCreatorInvoice } from '@/lib/generateInvoice';

// ─── Constants ────────────────────────────────────────────────────────────────
const WOEVA_FEE = 0.05;
const STRIPE_PCT = 0.029;
const STRIPE_FIXED = 0.30;
const PLATFORM_FEE_PCT = 5;

// ─── Types ────────────────────────────────────────────────────────────────────
type DashTab = 'home' | 'events' | 'payouts' | 'stats';

type Member = {
  id: string; user_id: string; created_at: string;
  profile: { id: string; name: string; avatar_url: string | null } | null;
};

type EventRow = {
  id: string; title: string; date: string; time: string;
  going_count: number; cover_url: string | null; club_id: string | null;
  price: number; is_free: boolean; status: string;
  paid_count: number; gross: number; stripe_fee: number; woeva_fee: number; net: number;
};

type Club = { id: string; name: string; cover_url: string | null; logo_url: string | null };

type BillingInfo = {
  id: string; company_name: string; ico: string; dic: string | null;
  address: string; city: string; country: string;
};

type StripeAccount = {
  stripe_account_id: string; onboarding_complete: boolean; payouts_enabled: boolean;
};

type PayoutRecord = {
  id: string; amount: number; currency: string;
  status: 'paid' | 'in_transit' | 'pending' | 'failed';
  arrival_date: string; created: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return `€${n.toFixed(2)}`; }

function calcRevenue(price: number, count: number) {
  const gross = price * count;
  const stripe_fee = count > 0 ? gross * STRIPE_PCT + count * STRIPE_FIXED : 0;
  const woeva_fee = gross * WOEVA_FEE;
  const net = Math.max(0, gross - stripe_fee - woeva_fee);
  return { gross, stripe_fee, woeva_fee, net };
}

function isUpcoming(e: EventRow) { return new Date(`${e.date}T${e.time ?? '00:00'}`) >= new Date(); }

function RevenueChart({ events, range, width }: { events: EventRow[]; range: 'week' | 'month' | 'all'; width: number }) {
  const H = 110;
  const PAD = { t: 10, b: 24, l: 8, r: 8 };
  const W = width - PAD.l - PAD.r;

  // Build buckets
  const now = new Date();
  let buckets: { label: string; gross: number }[] = [];

  if (range === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('sk-SK', { weekday: 'short' });
      const gross = events.filter(e => e.date === key).reduce((s, e) => s + e.gross, 0);
      buckets.push({ label, gross });
    }
  } else if (range === 'month') {
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now); start.setDate(start.getDate() - i * 7 - 6);
      const end = new Date(now); end.setDate(end.getDate() - i * 7);
      const label = `W${4 - i}`;
      const gross = events.filter(e => { const d = new Date(e.date); return d >= start && d <= end; }).reduce((s, e) => s + e.gross, 0);
      buckets.push({ label, gross });
    }
  } else {
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('sk-SK', { month: 'short' });
      const gross = events.filter(e => {
        const ed = new Date(e.date);
        return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
      }).reduce((s, e) => s + e.gross, 0);
      buckets.push({ label, gross });
    }
  }

  const maxVal = Math.max(...buckets.map(b => b.gross), 1);
  const n = buckets.length;
  const step = W / (n - 1);

  const points = buckets.map((b, i) => ({
    x: PAD.l + i * step,
    y: PAD.t + (H - PAD.t - PAD.b) * (1 - b.gross / maxVal),
  }));

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = [
    `${points[0].x},${H - PAD.b}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${points[n - 1].x},${H - PAD.b}`,
  ].join(' ');

  const hasData = buckets.some(b => b.gross > 0);

  return (
    <View style={{ marginBottom: 20 }}>
      <Svg width={width} height={H}>
        <Defs>
          <SvgGrad id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.lime} stopOpacity="0.35" />
            <Stop offset="1" stopColor={Colors.lime} stopOpacity="0" />
          </SvgGrad>
        </Defs>
        {hasData && (
          <>
            <Polygon points={areaPoints} fill="url(#chartGrad)" />
            <Polyline points={linePoints} fill="none" stroke={Colors.lime} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => buckets[i].gross > 0 && (
              <Circle key={i} cx={p.x} cy={p.y} r="3.5" fill={Colors.lime} stroke={Colors.white} strokeWidth="1.5" />
            ))}
          </>
        )}
        {/* Baseline */}
        <Polyline points={`${PAD.l},${H - PAD.b} ${PAD.l + W},${H - PAD.b}`} fill="none" stroke={Colors.grayBorder} strokeWidth="1" />
      </Svg>
      {/* X labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAD.l }}>
        {buckets.map((b, i) => (
          <Text key={i} style={{ fontSize: 10, color: Colors.gray, textAlign: 'center', minWidth: 28 }}>{b.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40;

  const [activeTab, setActiveTab] = useState<DashTab>('home');
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Billing form
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [bCompany, setBCompany] = useState('');
  const [bIco, setBIco] = useState('');
  const [bDic, setBDic] = useState('');
  const [bAddress, setBAddress] = useState('');
  const [bCity, setBCity] = useState('');
  const [bCountry, setBCountry] = useState('Slovakia');
  const [savingBilling, setSavingBilling] = useState(false);

  // Events tab
  const [eventsFilter, setEventsFilter] = useState<'upcoming' | 'past'>('upcoming');

  // Stats tab
  const [statsRange, setStatsRange] = useState<'week' | 'month' | 'all'>('all');

  useFocusEffect(useCallback(() => { load(); }, [user]));

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: clubData } = await supabase
      .from('clubs').select('id, name, cover_url, logo_url')
      .eq('creator_id', user.id).limit(1).maybeSingle();

    setClub(clubData ?? null);

    const [
      { data: eventsData },
      { data: billingData },
      { data: stripeData },
    ] = await Promise.all([
      supabase.from('events')
        .select('id, title, date, time, going_count, cover_url, club_id, price, is_free, status')
        .eq('creator_id', user.id).order('date', { ascending: false }),
      supabase.from('creator_billing').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('stripe_accounts')
        .select('stripe_account_id, onboarding_complete, payouts_enabled')
        .eq('user_id', user.id).maybeSingle(),
    ]);

    setBilling(billingData ?? null);
    if (billingData) {
      setBCompany(billingData.company_name ?? '');
      setBIco(billingData.ico ?? '');
      setBDic(billingData.dic ?? '');
      setBAddress(billingData.address ?? '');
      setBCity(billingData.city ?? '');
      setBCountry(billingData.country ?? 'Slovakia');
    }
    setStripeAccount(stripeData ?? null);

    if (clubData?.id) {
      const { data: membersData } = await supabase
        .from('club_members')
        .select('id, user_id, created_at, profile:profiles(id, name, avatar_url)')
        .eq('club_id', clubData.id).eq('status', 'approved')
        .order('created_at', { ascending: false });
      setMembers((membersData ?? []) as Member[]);
    }

    if (eventsData && eventsData.length > 0) {
      const { data: paidAtts } = await supabase
        .from('event_attendees').select('event_id')
        .in('event_id', eventsData.map(e => e.id)).eq('paid', true);

      const paidCounts: Record<string, number> = {};
      (paidAtts ?? []).forEach((a: any) => { paidCounts[a.event_id] = (paidCounts[a.event_id] ?? 0) + 1; });

      setEvents(eventsData.map(e => {
        const pc = e.is_free ? 0 : (paidCounts[e.id] ?? 0);
        return { ...e, paid_count: pc, ...calcRevenue(e.price ?? 0, pc) };
      }) as EventRow[]);
    } else {
      setEvents([]);
    }

    setLoading(false);
  }

  async function saveBilling() {
    if (!bCompany.trim() || !bIco.trim() || !bAddress.trim() || !bCity.trim()) return;
    setSavingBilling(true);
    const payload = {
      user_id: user!.id, company_name: bCompany.trim(), ico: bIco.trim(),
      dic: bDic.trim() || null, address: bAddress.trim(),
      city: bCity.trim(), country: bCountry.trim() || 'Slovakia',
    };
    if (billing?.id) {
      await supabase.from('creator_billing').update(payload).eq('id', billing.id);
    } else {
      await supabase.from('creator_billing').insert(payload);
    }
    setBilling({ ...payload, id: billing?.id ?? '' } as BillingInfo);
    setSavingBilling(false);
    setShowBillingModal(false);
  }

  async function connectStripe() {
    setConnectingStripe(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await supabase.functions.invoke('create-connect-account', {
        body: { return_url: 'woeva://dashboard' },
      });
      if (res.data?.already_connected) {
        setStripeAccount(s => s ? { ...s, onboarding_complete: true } : s);
        Alert.alert('Already connected', 'Your Stripe account is already set up.');
        setConnectingStripe(false);
        return;
      }
      if (res.data?.url) {
        await WebBrowser.openAuthSessionAsync(res.data.url, 'woeva://dashboard');
        await checkStripeStatus();
      }
    } catch (e) {
      Alert.alert('Error', 'Could not connect to Stripe. Try again.');
    }
    setConnectingStripe(false);
  }

  async function checkStripeStatus() {
    setCheckingStatus(true);
    const res = await supabase.functions.invoke('check-connect-status', {});
    if (res.data?.connected) {
      setStripeAccount(s => s ? { ...s, onboarding_complete: true, payouts_enabled: res.data.payouts_enabled } : s);
      if (res.data.payouts) setPayouts(res.data.payouts);
    }
    setCheckingStatus(false);
  }

  async function downloadInvoice() {
    if (!billing) return;
    const month = new Date().toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
    const invoiceNum = `W-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const paidEvents = events.filter(e => !e.is_free && e.paid_count > 0);
    const html = generateCreatorInvoice(billing, paidEvents, month, invoiceNum);

    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoiceNum}` });
    } catch {
      Alert.alert('PDF unavailable', 'Install expo-print and expo-sharing to download invoices:\nnpx expo install expo-print expo-sharing');
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const now = new Date();
  const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const d365 = new Date(now); d365.setFullYear(d365.getFullYear() - 1);
  const new7d = members.filter(m => new Date(m.created_at) >= d7).length;
  const new30d = members.filter(m => new Date(m.created_at) >= d30).length;
  const new1y = members.filter(m => new Date(m.created_at) >= d365).length;

  const totalGross = events.reduce((s, e) => s + e.gross, 0);
  const totalNet = events.reduce((s, e) => s + e.net, 0);
  const weekGross = events.filter(e => new Date(e.date) >= d7).reduce((s, e) => s + e.gross, 0);
  const monthGross = events.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.gross, 0);
  const weekNet = events.filter(e => new Date(e.date) >= d7).reduce((s, e) => s + e.net, 0);
  const monthNet = events.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.net, 0);

  const upcomingEvents = events.filter(isUpcoming);
  const pastEvents = events.filter(e => !isUpcoming(e));
  const displayedEvents = eventsFilter === 'upcoming' ? upcomingEvents : pastEvents;

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.topBar}><BackButton /><Text style={s.pageTitle}>Dashboard</Text><View style={{ width: 36 }} /></View>
        <ActivityIndicator style={{ marginTop: 80 }} color={Colors.black} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Billing Form Modal ──────────────────────────────────────────────── */}
      <Modal visible={showBillingModal} animationType="slide" transparent onRequestClose={() => setShowBillingModal(false)}>
        <View style={s.modalOverlay}>
          <ScrollView style={s.billingSheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={s.billingSheetHandle} />
            <Text style={s.billingSheetTitle}>Fakturačné údaje</Text>
            <Text style={s.billingSheetSub}>Tieto údaje sa zobrazia na tvojich faktúrach. Vyžadované pred pripojením Stripe.</Text>

            <View style={s.billingForm}>
              <Input label="Názov firmy / meno" value={bCompany} onChangeText={setBCompany} placeholder="Moje s.r.o." />
              <Input label="IČO" value={bIco} onChangeText={setBIco} placeholder="12345678" />
              <Input label="DIČ (nepovinné)" value={bDic} onChangeText={setBDic} placeholder="SK2012345678" />
              <Input label="Adresa" value={bAddress} onChangeText={setBAddress} placeholder="Hlavná 1" />
              <View style={s.billingRow}>
                <View style={{ flex: 1 }}>
                  <Input label="Mesto" value={bCity} onChangeText={setBCity} placeholder="Bratislava" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Krajina" value={bCountry} onChangeText={setBCountry} placeholder="Slovakia" />
                </View>
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 8 }}>
              <Button label="Uložiť" onPress={saveBilling} loading={savingBilling}
                disabled={!bCompany.trim() || !bIco.trim() || !bAddress.trim() || !bCity.trim()} variant="black" />
              <Button label="Zrušiť" onPress={() => setShowBillingModal(false)} variant="ghost" />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        key={activeTab}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <BackButton />
          <Text style={s.pageTitle}>Dashboard</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── HOME ──────────────────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <>
            {/* Quick overview strip */}
            <View style={s.overviewStrip}>
              {[
                { label: 'Events', val: events.length },
                { label: 'Attendees', val: events.reduce((sum, e) => sum + e.going_count, 0) },
                { label: 'Members', val: members.length },
                { label: 'Revenue', val: fmt(totalGross) },
              ].map(item => (
                <View key={item.label} style={s.overviewItem}>
                  <Text style={s.overviewVal}>{item.val}</Text>
                  <Text style={s.overviewLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Club card */}
            {club && (
              <TouchableOpacity style={s.clubCard} onPress={() => router.push(`/club/${club.id}` as any)} activeOpacity={0.85}>
                {club.cover_url
                  ? <Image source={{ uri: club.cover_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                  : club.logo_url
                    ? <View style={[StyleSheet.absoluteFill as any, { backgroundColor: '#000' }]}>
                        <Image source={{ uri: club.logo_url }} style={[StyleSheet.absoluteFill as any, { opacity: 0.35 }]} resizeMode="cover" />
                      </View>
                    : <View style={[StyleSheet.absoluteFill as any, { backgroundColor: '#000' }]} />
                }
                <Svg style={StyleSheet.absoluteFill as any} preserveAspectRatio="none">
                  <Defs><SvgGrad id="g1" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#000" stopOpacity="0.05" />
                    <Stop offset="1" stopColor="#000" stopOpacity="0.82" />
                  </SvgGrad></Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#g1)" />
                </Svg>
                <View style={s.clubCardContent}>
                  <Text style={s.clubCardLabel}>Your club</Text>
                  <Text style={s.clubCardName}>{club.name}</Text>
                </View>
                <TouchableOpacity style={s.clubEditBtn} onPress={() => router.push(`/club/${club.id}/edit` as any)} activeOpacity={0.8}>
                  <Text style={s.clubEditBtnText}>Edit</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            {/* Members overview */}
            {members.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Members</Text>
                <View style={s.statsGrid}>
                  <View style={[s.statCard, s.statCardLarge]}>
                    <Text style={s.statNumLarge}>{members.length}</Text>
                    <Text style={s.statLabel}>Total</Text>
                  </View>
                  <View style={s.statsSmall}>
                    {[['7 days', new7d], ['30 days', new30d], ['1 year', new1y]].map(([label, val]) => (
                      <View key={label as string} style={s.statCardSmall}>
                        <Text style={s.statLabel}>{label}</Text>
                        <Text style={s.statNumSmall}>+{val}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Earnings overview */}
            {totalGross > 0 && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 24 }]}>Earnings</Text>
                <View style={s.earningsRow}>
                  {[['This week', weekGross, weekNet], ['This month', monthGross, monthNet], ['All time', totalGross, totalNet]].map(([label, gross, net]) => (
                    <View key={label as string} style={s.earningsCard}>
                      <Text style={s.earningsLabel}>{label}</Text>
                      <Text style={s.earningsGross}>{fmt(gross as number)}</Text>
                      <Text style={s.earningsNet}>net {fmt(net as number)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 24 }]}>Upcoming events</Text>
                <View style={{ gap: 10 }}>
                  {upcomingEvents.slice(0, 5).map(e => (
                    <TouchableOpacity key={e.id} style={s.upcomingCard}
                      onPress={() => router.push(`/event/${e.id}` as any)} activeOpacity={0.85}>
                      {e.cover_url
                        ? <Image source={{ uri: e.cover_url }} style={s.upcomingCover} />
                        : <View style={[s.upcomingCover, s.upcomingCoverFallback]}>
                            <Text style={s.upcomingCoverInitial}>{e.title.charAt(0).toUpperCase()}</Text>
                          </View>
                      }
                      <View style={s.upcomingBody}>
                        <Text style={s.upcomingTitle} numberOfLines={1}>{e.title}</Text>
                        <Text style={s.upcomingDate}>
                          {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {e.time ? `  ·  ${e.time.slice(0, 5)}` : ''}
                        </Text>
                        <View style={s.upcomingMeta}>
                          <View style={s.upcomingAttendees}>
                            <Text style={s.upcomingAttendeesNum}>{e.going_count}</Text>
                            <Text style={s.upcomingAttendeesLabel}> going</Text>
                          </View>
                          {!e.is_free && e.gross > 0 && <Text style={s.upcomingRevenue}>{fmt(e.gross)}</Text>}
                        </View>
                      </View>
                      <View style={s.upcomingActions}>
                        <TouchableOpacity style={s.upcomingActionBtn}
                          onPress={ev => { ev.stopPropagation(); router.push(`/event/${e.id}/edit` as any); }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Text style={s.upcomingActionEdit}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.upcomingActionBtn, s.upcomingActionCancelBtn]}
                          onPress={ev => {
                            ev.stopPropagation();
                            Alert.alert('Cancel event', `Cancel "${e.title}"?`, [
                              { text: 'No', style: 'cancel' },
                              { text: 'Cancel event', style: 'destructive', onPress: async () => {
                                await supabase.from('events').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', e.id);
                                // Notify attendees
                                const { data: attendees } = await supabase
                                  .from('event_attendees').select('user_id').eq('event_id', e.id);
                                if (attendees && attendees.length > 0) {
                                  await supabase.from('notifications').insert(attendees.map(a => ({
                                    user_id: a.user_id,
                                    type: 'cancelled',
                                    title: `${e.title} was cancelled`,
                                    body: 'The creator cancelled this event.',
                                    data: { event_id: e.id },
                                    read: false,
                                  })));
                                }
                                setEvents(prev => prev.map(x => x.id === e.id ? { ...x, status: 'cancelled' } : x));
                              }},
                            ]);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Text style={s.upcomingActionCancel}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── EVENTS ────────────────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <>
            <View style={s.segment}>
              {(['upcoming', 'past'] as const).map(f => (
                <TouchableOpacity key={f} style={[s.segmentItem, eventsFilter === f && s.segmentItemActive]}
                  onPress={() => setEventsFilter(f)} activeOpacity={0.8}>
                  <Text style={[s.segmentText, eventsFilter === f && s.segmentTextActive]}>
                    {f === 'upcoming' ? `Upcoming (${upcomingEvents.length})` : `Past (${pastEvents.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {displayedEvents.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>No {eventsFilter} events</Text>
                <Text style={s.emptySub}>{eventsFilter === 'upcoming' ? 'Create an event to see it here.' : 'Your past events will appear here.'}</Text>
              </View>
            ) : (
              <View style={s.listCard}>
                {displayedEvents.map((e, i) => {
                  const d = new Date(e.date + 'T00:00:00');
                  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <TouchableOpacity key={e.id} style={[s.listRow, i < displayedEvents.length - 1 && s.listRowBorder]}
                      onPress={() => router.push(`/event/${e.id}` as any)} activeOpacity={0.7}>
                      {e.cover_url
                        ? <Image source={{ uri: e.cover_url }} style={s.listAvatar} />
                        : <View style={[s.listAvatar, s.listAvatarFallback]}><Text style={s.listAvatarInitial}>{e.title.charAt(0).toUpperCase()}</Text></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                        <Text style={s.listSub}>{dateStr}</Text>
                        {!e.is_free && <Text style={s.listRevenue}>{e.paid_count} tickets · {fmt(e.gross)} gross</Text>}
                      </View>
                      {e.status === 'cancelled' && <View style={s.cancelledBadge}><Text style={s.cancelledBadgeText}>Cancelled</Text></View>}
                      {!e.is_free && e.gross > 0 && e.status !== 'cancelled' && (
                        <View style={s.goingBadge}>
                          <Text style={s.goingNum}>{e.going_count}</Text>
                          <Text style={s.goingLabel}>going</Text>
                        </View>
                      )}
                      {(e.is_free || e.gross === 0) && e.status !== 'cancelled' && (
                        <View style={s.goingBadge}>
                          <Text style={s.goingNum}>{e.going_count}</Text>
                          <Text style={s.goingLabel}>going</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── PAYOUTS ───────────────────────────────────────────────────────── */}
        {activeTab === 'payouts' && (
          <>
            {/* Step 1: Billing info */}
            <View style={s.payoutSection}>
              <View style={s.payoutStepHeader}>
                <View style={[s.payoutStepDot, billing && s.payoutStepDotDone]}>
                  {billing ? <Text style={s.payoutStepCheck}>✓</Text> : <Text style={s.payoutStepNum}>1</Text>}
                </View>
                <Text style={s.payoutStepTitle}>Fakturačné údaje</Text>
                <TouchableOpacity onPress={() => setShowBillingModal(true)}>
                  <Text style={s.payoutStepEdit}>{billing ? 'Upraviť' : 'Nastaviť'}</Text>
                </TouchableOpacity>
              </View>
              {billing && (
                <View style={s.billingPreview}>
                  <Text style={s.billingPreviewMain}>{billing.company_name}</Text>
                  <Text style={s.billingPreviewSub}>IČO: {billing.ico}{billing.dic ? ` · DIČ: ${billing.dic}` : ''}</Text>
                  <Text style={s.billingPreviewSub}>{billing.address}, {billing.city}</Text>
                </View>
              )}
            </View>

            {/* Step 2: Stripe Connect */}
            <View style={[s.payoutSection, !billing && s.payoutSectionDisabled]}>
              <View style={s.payoutStepHeader}>
                <View style={[s.payoutStepDot, stripeAccount?.onboarding_complete && s.payoutStepDotDone]}>
                  {stripeAccount?.onboarding_complete
                    ? <Text style={s.payoutStepCheck}>✓</Text>
                    : <Text style={s.payoutStepNum}>2</Text>
                  }
                </View>
                <Text style={s.payoutStepTitle}>Stripe Connect</Text>
                {stripeAccount?.onboarding_complete && (
                  <View style={s.connectedPill}><Text style={s.connectedPillText}>Connected</Text></View>
                )}
              </View>
              {!stripeAccount?.onboarding_complete && (
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Text style={s.stripeInfo}>
                    Platby od účastníkov idú priamo na tvoj bankový účet. Woeva si účtuje {PLATFORM_FEE_PCT}% platformový poplatok (zahŕňa Stripe poplatky). Výplaty prebiehajú automaticky každý pondelok.
                  </Text>
                  <Button
                    label={connectingStripe ? 'Otvára sa...' : 'Pripojiť Stripe'}
                    onPress={connectStripe}
                    loading={connectingStripe}
                    disabled={!billing || connectingStripe}
                    variant="black"
                  />
                  {stripeAccount && (
                    <Button label={checkingStatus ? 'Kontrola...' : 'Skontrolovať stav'} onPress={checkStripeStatus}
                      loading={checkingStatus} variant="ghost" />
                  )}
                </View>
              )}
              {stripeAccount?.onboarding_complete && (
                <View style={s.stripeStatusRow}>
                  <View style={[s.stripeStatusDot, { backgroundColor: stripeAccount.payouts_enabled ? Colors.lime : '#FF9500' }]} />
                  <Text style={s.stripeStatusText}>
                    {stripeAccount.payouts_enabled ? 'Výplaty aktívne · každý pondelok' : 'Výplaty sa aktivujú po overení'}
                  </Text>
                </View>
              )}
            </View>

            {/* Earnings summary */}
            {stripeAccount?.onboarding_complete && (
              <>
                <Text style={s.sectionTitle}>Zárobky</Text>
                <View style={s.earningsGrid}>
                  {[
                    { label: 'Tento týždeň', gross: weekGross, net: weekNet },
                    { label: 'Tento mesiac', gross: monthGross, net: monthNet },
                    { label: 'Celkovo', gross: totalGross, net: totalNet },
                  ].map(item => (
                    <View key={item.label} style={s.earningsGridCard}>
                      <Text style={s.earningsGridLabel}>{item.label}</Text>
                      <Text style={s.earningsGridGross}>{fmt(item.gross)}</Text>
                      <Text style={s.earningsGridSub}>brutto</Text>
                      <View style={s.earningsDivider} />
                      <Text style={s.earningsGridNet}>{fmt(item.net)}</Text>
                      <Text style={s.earningsGridSub}>netto</Text>
                    </View>
                  ))}
                </View>

                {/* Per-event breakdown */}
                {events.filter(e => !e.is_free && e.paid_count > 0).length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>Per event</Text>
                    <View style={s.listCard}>
                      {events.filter(e => !e.is_free && e.paid_count > 0).map((e, i, arr) => (
                        <View key={e.id} style={[s.eventBreakdownRow, i < arr.length - 1 && s.listRowBorder]}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                            <Text style={s.listSub}>{e.paid_count} tickets · Stripe {fmt(e.stripe_fee)} · Woeva {fmt(e.woeva_fee)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.breakdownGross}>{fmt(e.gross)}</Text>
                            <Text style={s.breakdownNet}>{fmt(e.net)} netto</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Payout history */}
                {payouts.length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>História výplat</Text>
                    <View style={s.listCard}>
                      {payouts.map((p, i) => {
                        const arrival = new Date(p.arrival_date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' });
                        const statusColor = p.status === 'paid' ? Colors.lime : p.status === 'in_transit' ? '#FF9500' : Colors.gray;
                        return (
                          <View key={p.id} style={[s.listRow, i < payouts.length - 1 && s.listRowBorder]}>
                            <View style={[s.payoutStatusDot, { backgroundColor: statusColor }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.listName}>{fmt(p.amount)}</Text>
                              <Text style={s.listSub}>{p.status === 'paid' ? 'Doručená' : p.status === 'in_transit' ? 'Na ceste' : 'Čaká'} · {arrival}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Download invoice */}
                <TouchableOpacity style={s.invoiceBtn} onPress={downloadInvoice}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={s.invoiceBtnText}>Stiahnuť faktúru (PDF)</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        {activeTab === 'stats' && (() => {
          const rangeCutoff = statsRange === 'week' ? d7 : statsRange === 'month' ? d30 : null;
          const filtered = rangeCutoff ? events.filter(e => new Date(e.date) >= rangeCutoff) : events;
          const fGross = filtered.reduce((sum, e) => sum + e.gross, 0);
          const fStripe = filtered.reduce((sum, e) => sum + e.stripe_fee, 0);
          const fWoeva = filtered.reduce((sum, e) => sum + e.woeva_fee, 0);
          const fNet = filtered.reduce((sum, e) => sum + e.net, 0);

          return (
            <>
              {/* Range selector */}
              <View style={s.segment}>
                {([['week', 'This week'], ['month', 'This month'], ['all', 'All time']] as const).map(([key, label]) => (
                  <TouchableOpacity key={key} style={[s.segmentItem, statsRange === key && s.segmentItemActive]}
                    onPress={() => setStatsRange(key)} activeOpacity={0.8}>
                    <Text style={[s.segmentText, statsRange === key && s.segmentTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Revenue chart */}
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>Revenue</Text>
                <RevenueChart events={events} range={statsRange} width={chartWidth - 32} />
              </View>

              <View style={s.statsOverview}>
                {[
                  { label: 'Events', val: filtered.length },
                  { label: 'Tickets sold', val: filtered.reduce((sum, e) => sum + e.paid_count, 0) },
                  { label: 'Free events', val: filtered.filter(e => e.is_free).length },
                  { label: 'Paid events', val: filtered.filter(e => !e.is_free).length },
                  { label: 'Attendees', val: filtered.reduce((sum, e) => sum + e.going_count, 0) },
                  { label: 'Club members', val: members.length },
                ].map(item => (
                  <View key={item.label} style={s.statsOverviewCard}>
                    <Text style={s.statsOverviewNum}>{item.val}</Text>
                    <Text style={s.statsOverviewLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {fGross > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 24 }]}>Revenue</Text>
                  <View style={s.revenueCard}>
                    <View style={s.revenueRow}>
                      <Text style={s.revenueLabel}>Gross revenue</Text>
                      <Text style={s.revenueVal}>{fmt(fGross)}</Text>
                    </View>
                    <View style={s.revenueRow}>
                      <Text style={s.revenueLabel}>Stripe fees (est.)</Text>
                      <Text style={[s.revenueVal, { color: Colors.gray }]}>- {fmt(fStripe)}</Text>
                    </View>
                    <View style={s.revenueRow}>
                      <Text style={s.revenueLabel}>Woeva fee (5%)</Text>
                      <Text style={[s.revenueVal, { color: Colors.gray }]}>- {fmt(fWoeva)}</Text>
                    </View>
                    <View style={[s.revenueRow, { borderTopWidth: 1.5, borderTopColor: Colors.black, marginTop: 8, paddingTop: 12 }]}>
                      <Text style={[s.revenueLabel, { fontWeight: '800', fontFamily: Fonts.extrabold }]}>Net to you</Text>
                      <Text style={[s.revenueVal, { fontWeight: '800', fontFamily: Fonts.extrabold }]}>{fmt(fNet)}</Text>
                    </View>
                  </View>
                </>
              )}

              {filtered.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 24 }]}>Top events by attendance</Text>
                  <View style={s.listCard}>
                    {[...filtered].sort((a, b) => b.going_count - a.going_count).slice(0, 5).map((e, i, arr) => (
                      <View key={e.id} style={[s.listRow, i < arr.length - 1 && s.listRowBorder]}>
                        <Text style={s.rankNum}>{i + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                          <Text style={s.listSub}>{e.going_count} attendees</Text>
                        </View>
                        {!e.is_free && <Text style={s.eventRevenue}>{fmt(e.gross)}</Text>}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {filtered.length === 0 && (
                <View style={s.emptyBox}>
                  <Text style={s.emptyTitle}>No data</Text>
                  <Text style={s.emptySub}>No events in this period.</Text>
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>

      {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom + 4 }]}>
        {([
          { key: 'home', label: 'Home', icon: 'home' },
          { key: 'events', label: 'Events', icon: 'calendar' },
          { key: 'payouts', label: 'Payouts', icon: 'euro' },
          { key: 'stats', label: 'Stats', icon: 'bar' },
        ] as { key: DashTab; label: string; icon: string }[]).map(tab => {
          const active = activeTab === tab.key;
          const color = active ? Colors.black : Colors.gray;
          return (
            <TouchableOpacity key={tab.key} style={s.bottomNavItem} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                {tab.icon === 'home' && <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />}
                {tab.icon === 'calendar' && <><Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={active ? 2.5 : 1.8} /><Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" /></>}
                {tab.icon === 'euro' && <><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={active ? 2.5 : 1.8} /><Path d="M15.5 8.5A5 5 0 1 0 15.5 15.5M7 10.5h6M7 13.5h6" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" /></>}
                {tab.icon === 'bar' && <Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />}
              </Svg>
              <Text style={[s.bottomNavLabel, active && s.bottomNavLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 16 },
  pageTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  // Club card
  clubCard: { height: 130, borderRadius: 20, overflow: 'hidden', marginBottom: 24, backgroundColor: '#000' },
  clubCardContent: { position: 'absolute', bottom: 14, left: 16 },
  clubCardLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  clubCardName: { fontSize: 19, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white },
  clubEditBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  clubEditBtnText: { fontSize: 12, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },

  // Overview strip
  overviewStrip: { flexDirection: 'row', backgroundColor: Colors.grayLight, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 6, marginBottom: 20, justifyContent: 'space-around' },
  overviewItem: { alignItems: 'center', flex: 1 },
  overviewVal: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  overviewLabel: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { backgroundColor: Colors.grayLight, borderRadius: 16, padding: 14, alignItems: 'center', justifyContent: 'center' },
  statCardLarge: { width: 100, gap: 4 },
  statsSmall: { flex: 1, gap: 8 },
  statCardSmall: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statNumLarge: { fontSize: 34, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statNumSmall: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  statLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },

  // Earnings row (home)
  earningsRow: { flexDirection: 'row', gap: 10 },
  earningsCard: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 12, gap: 2 },
  earningsLabel: { fontSize: 10, fontWeight: '600', color: Colors.gray, letterSpacing: 0.5, textTransform: 'uppercase' },
  earningsGross: { fontSize: 16, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black, marginTop: 4 },
  earningsNet: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },

  // List card
  listCard: { backgroundColor: Colors.grayLight, borderRadius: 18, paddingHorizontal: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  listAvatar: { width: 40, height: 40, borderRadius: 10 },
  listAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  listAvatarInitial: { fontSize: 16, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  listName: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  listSub: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  listRevenue: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  eventRevenue: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },

  // Upcoming event cards (home tab)
  upcomingCard: { backgroundColor: Colors.grayLight, borderRadius: 16, flexDirection: 'row', overflow: 'hidden', alignItems: 'center' },
  upcomingCover: { width: 70, height: 70 },
  upcomingCoverFallback: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  upcomingCoverInitial: { fontSize: 22, fontWeight: '800', color: Colors.white },
  upcomingBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  upcomingTitle: { fontSize: 14, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  upcomingDate: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  upcomingMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  upcomingAttendees: { flexDirection: 'row', alignItems: 'baseline' },
  upcomingAttendeesNum: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  upcomingAttendeesLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  upcomingRevenue: { fontSize: 12, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  upcomingActions: { flexDirection: 'column', gap: 4, paddingRight: 12 },
  upcomingActionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.white, alignItems: 'center' },
  upcomingActionCancelBtn: { backgroundColor: '#FFE8E8' },
  upcomingActionEdit: { fontSize: 11, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  upcomingActionCancel: { fontSize: 11, fontWeight: '600', color: '#CC3333', fontFamily: Fonts.semibold },

  // Events tab
  segment: { flexDirection: 'row', backgroundColor: Colors.grayLight, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentItemActive: { backgroundColor: Colors.white },
  segmentText: { fontSize: 13, fontWeight: '500', color: Colors.gray, fontFamily: Fonts.medium },
  segmentTextActive: { color: Colors.black, fontWeight: '700', fontFamily: Fonts.bold },
  cancelledBadge: { backgroundColor: '#FFE5E5', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  cancelledBadgeText: { fontSize: 10, fontWeight: '700', color: '#CC3333' },
  goingBadge: { alignItems: 'center', minWidth: 34 },
  goingNum: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  goingLabel: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.regular },
  emptyBox: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  emptySub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center' },

  // Payouts
  payoutSection: { backgroundColor: Colors.grayLight, borderRadius: 18, padding: 16, marginBottom: 12 },
  payoutSectionDisabled: { opacity: 0.4 },
  payoutStepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  payoutStepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.grayBorder, alignItems: 'center', justifyContent: 'center' },
  payoutStepDotDone: { backgroundColor: Colors.lime },
  payoutStepNum: { fontSize: 13, fontWeight: '700', color: Colors.gray },
  payoutStepCheck: { fontSize: 13, fontWeight: '700', color: Colors.black },
  payoutStepTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  payoutStepEdit: { fontSize: 13, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  billingPreview: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.grayBorder, gap: 2 },
  billingPreviewMain: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  billingPreviewSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  stripeInfo: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 19 },
  stripeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.grayBorder },
  stripeStatusDot: { width: 8, height: 8, borderRadius: 4 },
  stripeStatusText: { fontSize: 13, color: Colors.black, fontFamily: Fonts.regular },
  connectedPill: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  connectedPillText: { fontSize: 11, fontWeight: '700', color: Colors.black },
  payoutStatusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  earningsGrid: { flexDirection: 'row', gap: 10 },
  earningsGridCard: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  earningsGridLabel: { fontSize: 10, fontWeight: '600', color: Colors.gray, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  earningsGridGross: { fontSize: 18, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black, marginTop: 6 },
  earningsGridNet: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  earningsGridSub: { fontSize: 10, color: Colors.gray },
  earningsDivider: { height: 1, backgroundColor: Colors.grayBorder, width: '100%', marginVertical: 6 },
  eventBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  breakdownGross: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  breakdownNet: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'right' },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 20, paddingVertical: 14, backgroundColor: Colors.grayLight, borderRadius: 14 },
  invoiceBtnText: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },

  // Chart
  chartCard: { backgroundColor: Colors.grayLight, borderRadius: 18, padding: 16, marginBottom: 16 },
  chartTitle: { fontSize: 11, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },

  // Stats
  statsOverview: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statsOverviewCard: { width: '47%', backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, gap: 4 },
  statsOverviewNum: { fontSize: 28, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statsOverviewLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  revenueCard: { backgroundColor: Colors.grayLight, borderRadius: 16, padding: 16, gap: 0 },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  revenueLabel: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular },
  revenueVal: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  rankNum: { width: 24, fontSize: 14, fontWeight: '700', color: Colors.gray, fontFamily: Fonts.bold, textAlign: 'center' },

  // Billing modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  billingSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '90%' },
  billingSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 20 },
  billingSheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold, marginBottom: 6 },
  billingSheetSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 19, marginBottom: 20 },
  billingForm: { gap: 14, marginBottom: 16 },
  billingRow: { flexDirection: 'row', gap: 12 },

  // Bottom nav
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.grayBorder, paddingTop: 10 },
  bottomNavItem: { flex: 1, alignItems: 'center', gap: 3 },
  bottomNavLabel: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.regular },
  bottomNavLabelActive: { color: Colors.black, fontWeight: '600', fontFamily: Fonts.semibold },
});
