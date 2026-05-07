import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput, Platform, FlatList,
} from 'react-native';
// expo-camera requires a native build — safe lazy import
let _expoCamera: any = null;
try { _expoCamera = require('expo-camera'); } catch {}
const SafeCameraView: any = _expoCamera?.CameraView ?? null;
function useSafeCameraPermissions(): [{ granted: boolean } | null, () => Promise<any>] {
  if (_expoCamera?.useCameraPermissions) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return _expoCamera.useCameraPermissions();
  }
  return [null, async () => {}];
}
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
import { notify } from '@/lib/notify';
import { useTranslations } from '@/context/LanguageContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const WOEVA_FEE = 0.05;
const STRIPE_PCT = 0.029;
const STRIPE_FIXED = 0.30;
const PLATFORM_FEE_PCT = 5;

// ─── Types ────────────────────────────────────────────────────────────────────
type DashTab = 'home' | 'events' | 'payouts' | 'stats' | 'scan';

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

type Club = { id: string; name: string; cover_url: string | null; logo_url: string | null; creator_id: string };

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

function EventChart({ events, range, width, getValue, color, gradId }: {
  events: EventRow[]; range: 'week' | 'month' | 'all'; width: number;
  getValue: (e: EventRow) => number; color: string; gradId: string;
}) {
  const H = 110;
  const PAD = { t: 10, b: 24, l: 8, r: 8 };
  const W = width - PAD.l - PAD.r;
  const now = new Date();
  let buckets: { label: string; val: number }[] = [];

  if (range === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const val = events.filter(e => e.date === key).reduce((s, e) => s + getValue(e), 0);
      buckets.push({ label, val });
    }
  } else if (range === 'month') {
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now); start.setDate(start.getDate() - i * 7 - 6);
      const end = new Date(now); end.setDate(end.getDate() - i * 7);
      const val = events.filter(e => { const d = new Date(e.date); return d >= start && d <= end; }).reduce((s, e) => s + getValue(e), 0);
      buckets.push({ label: `W${4 - i}`, val });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const val = events.filter(e => {
        const ed = new Date(e.date);
        return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
      }).reduce((s, e) => s + getValue(e), 0);
      buckets.push({ label, val });
    }
  }

  const maxVal = Math.max(...buckets.map(b => b.val), 1);
  const n = buckets.length;
  const step = W / (n - 1);
  const points = buckets.map((b, i) => ({
    x: PAD.l + i * step,
    y: PAD.t + (H - PAD.t - PAD.b) * (1 - b.val / maxVal),
  }));
  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = [`${points[0].x},${H - PAD.b}`, ...points.map(p => `${p.x},${p.y}`), `${points[n - 1].x},${H - PAD.b}`].join(' ');
  const hasData = buckets.some(b => b.val > 0);

  return (
    <View style={{ marginBottom: 4 }}>
      <Svg width={width} height={H}>
        <Defs>
          <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGrad>
        </Defs>
        {hasData && (
          <>
            <Polygon points={areaPoints} fill={`url(#${gradId})`} />
            <Polyline points={linePoints} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => buckets[i].val > 0 && (
              <Circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} stroke={Colors.white} strokeWidth="1.5" />
            ))}
          </>
        )}
        <Polyline points={`${PAD.l},${H - PAD.b} ${PAD.l + W},${H - PAD.b}`} fill="none" stroke={Colors.grayBorder} strokeWidth="1" />
      </Svg>
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
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40;

  const [activeTab, setActiveTab] = useState<DashTab>('home');
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
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
  const [eventsFilter, setEventsFilter] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  // Stats tab
  const [statsRange, setStatsRange] = useState<'week' | 'month' | 'all'>('all');

  // Attendees modal
  const [attendeesEvent, setAttendeesEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // Payouts intro gate
  const [showPayoutsSetup, setShowPayoutsSetup] = useState(false);

  // Club settings sheet
  const [showClubSettings, setShowClubSettings] = useState(false);
  const [clubAdmins, setClubAdmins] = useState<{ user_id: string; name: string; avatar_url: string | null }[]>([]);
  const [notifJoin, setNotifJoin] = useState(true);
  const [notifLeave, setNotifLeave] = useState(true);
  const [notifChat, setNotifChat] = useState(false);

  // Invite admin
  const [showInviteAdmin, setShowInviteAdmin] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [invitingAdmin, setInvitingAdmin] = useState(false);

  // Check-ins: eventId → Set of userId
  const [checkedIn, setCheckedIn] = useState<Record<string, Set<string>>>({});

  function markCheckedIn(eventId: string, userId: string) {
    setCheckedIn(prev => {
      const s = new Set(prev[eventId] ?? []);
      s.add(userId);
      return { ...prev, [eventId]: s };
    });
    supabase.from('check_ins').upsert({ event_id: eventId, user_id: userId }).then(() => {});
  }

  // Reload members when selected club changes
  React.useEffect(() => {
    const id = selectedClubId ?? clubs[0]?.id;
    if (id) loadMembers(id);
    else setMembers([]);
  }, [selectedClubId, clubs.length]);

  async function openClubSettings() {
    const targetClub = selectedClub ?? clubs[0];
    if (!targetClub) return;
    const { data } = await supabase
      .from('club_members')
      .select('user_id, profile:profiles(name, avatar_url)')
      .eq('club_id', targetClub.id)
      .eq('role', 'admin')
      .eq('status', 'approved');
    setClubAdmins(((data ?? []) as any[]).map(m => ({
      user_id: m.user_id,
      name: m.profile?.name ?? '',
      avatar_url: m.profile?.avatar_url ?? null,
    })));
    setShowClubSettings(true);
  }

  async function removeAdmin(userId: string) {
    const targetClub = selectedClub ?? clubs[0];
    if (!targetClub || userId === user?.id) return;
    Alert.alert(t.club.removeAdmin, t.club.removeAdminMsg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.club.remove, style: 'destructive', onPress: async () => {
        await supabase.from('club_members')
          .update({ role: 'member' })
          .eq('club_id', targetClub.id).eq('user_id', userId);
        setClubAdmins(prev => prev.filter(a => a.user_id !== userId));
      }},
    ]);
  }

  async function searchInvite(q: string) {
    setInviteQuery(q);
    if (q.trim().length < 2) { setInviteResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, name, avatar_url, email')
      .ilike('email', `%${q.trim()}%`).limit(6);
    setInviteResults((data ?? []) as any[]);
  }

  async function inviteAdmin(profileId: string, profileName: string) {
    const targetClub = clubs.find(c => c.id === selectedClubId) ?? clubs[0];
    if (!targetClub) return;

    Alert.alert(
      t.club.confirmInvite(profileName),
      t.club.confirmInviteMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.club.sendInvite,
          onPress: async () => {
            setInvitingAdmin(true);
            // Insert as pending — they must accept
            await supabase.from('club_members').upsert({
              club_id: targetClub.id, user_id: profileId, role: 'admin', status: 'pending',
            }, { onConflict: 'club_id,user_id' });
            await supabase.from('notifications').insert({
              user_id: profileId, type: 'admin_invite',
              title: `Admin invite: ${targetClub.name}`,
              body: `You've been invited to co-manage ${targetClub.name}. Tap to accept or decline.`,
              data: { club_id: targetClub.id, action: 'admin_invite' },
            });
            notify.adminInvite({
              inviteeId: profileId,
              inviteeName: profileName,
              inviterName: profile?.name ?? user?.email ?? 'Someone',
              clubName: targetClub.name,
              clubId: targetClub.id,
            });
            setInvitingAdmin(false);
            setShowInviteAdmin(false);
            setInviteQuery('');
            setInviteResults([]);
            Alert.alert(t.club.inviteSent, t.club.inviteSentMsg(profileName));
          },
        },
      ]
    );
  }

  // QR scan
  const [cameraPermission, requestCameraPermission] = useSafeCameraPermissions();
  const [scannedTicket, setScannedTicket] = useState<{ eventTitle: string; userName: string; avatar_url: string | null; valid: boolean; eventId: string; userId: string } | null>(null);
  const [scanProcessing, setScanProcessing] = useState(false);

  useFocusEffect(useCallback(() => {
    load();
    if (user) {
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('read', false)
        .then(({ count }) => setUnreadNotifs(count ?? 0));
    }
  }, [user]));

  async function loadMembers(clubId: string) {
    const { data: membersData } = await supabase
      .from('club_members')
      .select('id, user_id, created_at, profile:profiles(id, name, avatar_url)')
      .eq('club_id', clubId).eq('status', 'approved')
      .order('created_at', { ascending: false });
    setMembers((membersData ?? []) as unknown as Member[]);
  }

  async function load() {
    if (!user) return;
    setLoading(true);

    // Fetch clubs user owns
    const { data: ownedClubs } = await supabase
      .from('clubs').select('id, name, cover_url, logo_url, creator_id')
      .eq('creator_id', user.id);

    // Fetch clubs user is admin of (but didn't create)
    const { data: adminMemberships } = await supabase
      .from('club_members')
      .select('club:clubs(id, name, cover_url, logo_url, creator_id)')
      .eq('user_id', user.id).eq('role', 'admin').eq('status', 'approved');

    const adminClubs: Club[] = ((adminMemberships ?? []) as any[])
      .map(m => m.club).filter(Boolean);

    const allClubs: Club[] = [...(ownedClubs ?? [])];
    for (const ac of adminClubs) {
      if (!allClubs.find(c => c.id === ac.id)) allClubs.push(ac);
    }
    setClubs(allClubs);

    const clubIds = allClubs.map(c => c.id);

    const [
      { data: eventsData },
      { data: billingData },
      { data: stripeData },
    ] = await Promise.all([
      clubIds.length > 0
        ? supabase.from('events')
            .select('id, title, date, time, going_count, cover_url, club_id, price, is_free, status')
            .or(`creator_id.eq.${user.id},club_id.in.(${clubIds.join(',')})`)
            .order('date', { ascending: false })
        : supabase.from('events')
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

    const firstClubId = allClubs[0]?.id;
    if (firstClubId) await loadMembers(firstClubId);

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
        Alert.alert(t.dashboard.alreadyConnected, t.dashboard.alreadyConnectedMsg);
        setConnectingStripe(false);
        return;
      }
      if (res.data?.url) {
        await WebBrowser.openAuthSessionAsync(res.data.url, 'woeva://dashboard');
        await checkStripeStatus();
      }
    } catch (e) {
      Alert.alert(t.common.error, t.dashboard.stripeError);
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

  async function openAttendees(event: EventRow) {
    setAttendeesEvent(event);
    setLoadingAttendees(true);
    const [{ data: attData }, { data: ciData }] = await Promise.all([
      supabase.from('event_attendees')
        .select('profile:profiles(id, name, avatar_url)')
        .eq('event_id', event.id),
      supabase.from('check_ins')
        .select('user_id')
        .eq('event_id', event.id),
    ]);
    setAttendees(((attData ?? []) as any).map((a: any) => a.profile).filter(Boolean));
    // Merge DB check-ins into local state
    const dbCheckedIn = new Set((ciData ?? []).map((c: any) => c.user_id));
    if (dbCheckedIn.size > 0) {
      setCheckedIn(prev => {
        const existing = new Set(prev[event.id] ?? []);
        dbCheckedIn.forEach(id => existing.add(id));
        return { ...prev, [event.id]: existing };
      });
    }
    setLoadingAttendees(false);
  }

  async function handleQrScan({ data: qrData }: { data: string }) {
    if (scanProcessing) return;
    setScanProcessing(true);
    try {
      const parts = qrData.split(':');
      if (parts.length < 4 || parts[0] !== 'woeva' || parts[1] !== 'event') {
        setScannedTicket({ eventTitle: 'Invalid QR', userName: '', avatar_url: null, valid: false, eventId: '', userId: '' });
        return;
      }
      const eventId = parts[2];
      const userId = parts[3];
      const matchedEvent = events.find(e => e.id === eventId);
      const { data: att } = await supabase
        .from('event_attendees')
        .select('profile:profiles(id, name, avatar_url)')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      const profile = (att as any)?.profile;
      setScannedTicket({
        eventTitle: matchedEvent?.title ?? 'Event',
        userName: profile?.name ?? 'Unknown',
        avatar_url: profile?.avatar_url ?? null,
        valid: !!att,
        eventId,
        userId,
      });
      if (att) markCheckedIn(eventId, userId);
    } finally {
      setScanProcessing(false);
    }
  }

  async function downloadInvoice() {
    if (!billing) return;
    const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const invoiceNum = `W-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const paidEvents = events.filter(e => !e.is_free && e.paid_count > 0);
    const html = generateCreatorInvoice(billing, paidEvents, month, invoiceNum);

    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoiceNum}` });
    } catch {
      Alert.alert(t.dashboard.pdfUnavailable, 'Install expo-print and expo-sharing to download invoices:\nnpx expo install expo-print expo-sharing');
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

  const selectedClub = clubs.find(c => c.id === selectedClubId) ?? null;
  const viewEvents = selectedClubId ? events.filter(e => e.club_id === selectedClubId) : events;

  const totalGross = viewEvents.reduce((s, e) => s + e.gross, 0);
  const totalNet = viewEvents.reduce((s, e) => s + e.net, 0);
  const weekGross = viewEvents.filter(e => new Date(e.date) >= d7).reduce((s, e) => s + e.gross, 0);
  const monthGross = viewEvents.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.gross, 0);
  const weekNet = viewEvents.filter(e => new Date(e.date) >= d7).reduce((s, e) => s + e.net, 0);
  const monthNet = viewEvents.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.net, 0);

  const upcomingEvents = viewEvents.filter(e => isUpcoming(e) && e.status !== 'cancelled');
  const pastEvents = viewEvents.filter(e => !isUpcoming(e) && e.status !== 'cancelled');
  const cancelledEvents = viewEvents.filter(e => e.status === 'cancelled');
  const displayedEvents = eventsFilter === 'upcoming' ? upcomingEvents : eventsFilter === 'past' ? pastEvents : cancelledEvents;

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.topBar}><BackButton /><Text style={s.pageTitle}>{t.dashboard.dashboard}</Text><View style={{ width: 36 }} /></View>
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
            <Text style={s.billingSheetTitle}>{t.dashboard.billingDetails}</Text>
            <Text style={s.billingSheetSub}>{t.dashboard.billingDetailsSub}</Text>

            <View style={s.billingForm}>
              <Input label={t.dashboard.companyName} value={bCompany} onChangeText={setBCompany} placeholder="My Company Ltd." />
              <Input label={t.dashboard.companyId} value={bIco} onChangeText={setBIco} placeholder="12345678" />
              <Input label={t.dashboard.taxId} value={bDic} onChangeText={setBDic} placeholder="SK2012345678" />
              <Input label={t.dashboard.streetAddress} value={bAddress} onChangeText={setBAddress} placeholder="123 Main Street" />
              <View style={s.billingRow}>
                <View style={{ flex: 1 }}>
                  <Input label={t.dashboard.cityLabel} value={bCity} onChangeText={setBCity} placeholder="Bratislava" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={t.dashboard.country} value={bCountry} onChangeText={setBCountry} placeholder="Slovakia" />
                </View>
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 8 }}>
              <Button label={t.dashboard.save} onPress={saveBilling} loading={savingBilling}
                disabled={!bCompany.trim() || !bIco.trim() || !bAddress.trim() || !bCity.trim()} variant="black" />
              <Button label={t.dashboard.cancelLabel} onPress={() => setShowBillingModal(false)} variant="ghost" />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        key={activeTab}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          {activeTab === 'scan'
            ? <TouchableOpacity onPress={() => setActiveTab('home')} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 12H5M12 5l-7 7 7 7" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            : <BackButton />
          }
          <Text style={s.pageTitle}>{activeTab === 'scan' ? t.dashboard.scanQR : t.dashboard.dashboard}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {clubs.some(c => c.creator_id === user?.id) && activeTab !== 'scan' && (
              <TouchableOpacity style={s.bellBtn} onPress={openClubSettings}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.bellBtn} onPress={() => router.push('/notifications' as any)}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              {unreadNotifs > 0 && <View style={s.bellDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Club switcher — only on relevant tabs, only if user has clubs */}
        {(activeTab === 'home' || activeTab === 'events' || activeTab === 'stats') && clubs.length > 0 && (
          <View style={s.viewFilter}>
            <TouchableOpacity
              style={[s.viewFilterChip, !selectedClubId && s.viewFilterChipActive]}
              onPress={() => setSelectedClubId(null)} activeOpacity={0.7}>
              <Text style={[s.viewFilterText, !selectedClubId && s.viewFilterTextActive]}>{t.home.all}</Text>
            </TouchableOpacity>
            {clubs.map(c => (
              <TouchableOpacity key={c.id}
                style={[s.viewFilterChip, selectedClubId === c.id && s.viewFilterChipActive]}
                onPress={() => setSelectedClubId(c.id)} activeOpacity={0.7}>
                <Text style={[s.viewFilterText, selectedClubId === c.id && s.viewFilterTextActive]} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── HOME ──────────────────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <>
            {/* Quick overview strip */}
            <View style={s.overviewStrip}>
              {[
                { label: t.dashboard.events, val: viewEvents.length },
                { label: t.dashboard.attendees, val: viewEvents.reduce((sum, e) => sum + e.going_count, 0) },
                { label: t.dashboard.members, val: members.length },
                { label: t.dashboard.revenue, val: fmt(totalGross) },
              ].map(item => (
                <View key={item.label} style={s.overviewItem}>
                  <Text style={s.overviewVal}>{item.val}</Text>
                  <Text style={s.overviewLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Club card */}
            {(() => {
              const displayClub = selectedClub ?? clubs[0] ?? null;
              if (!displayClub) return null;
              const isOwner = displayClub.creator_id === user?.id;
              return (
                <View style={s.clubCard}>
                  {displayClub.cover_url
                    ? <Image source={{ uri: displayClub.cover_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                    : displayClub.logo_url
                      ? <View style={[StyleSheet.absoluteFill as any, { backgroundColor: '#000' }]}>
                          <Image source={{ uri: displayClub.logo_url }} style={[StyleSheet.absoluteFill as any, { opacity: 0.35 }]} resizeMode="cover" />
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
                    <Text style={s.clubCardLabel}>{isOwner ? t.club.myClub : t.club.adminClub}</Text>
                    <Text style={s.clubCardName}>{displayClub.name}</Text>
                    <View style={s.clubCardActions}>
                      <TouchableOpacity style={s.clubCardActionBtn} onPress={() => router.push(`/club/${displayClub.id}` as any)} activeOpacity={0.8}>
                        <Text style={s.clubCardActionText}>{t.club.viewClub}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.clubCardActionBtn, s.clubCardActionBtnEdit]} onPress={() => router.push(`/club/${displayClub.id}/edit` as any)} activeOpacity={0.8}>
                        <Text style={[s.clubCardActionText, s.clubCardActionTextEdit]}>{t.common.edit}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Members overview */}
            {members.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t.dashboard.members}</Text>
                <View style={s.statsGrid}>
                  <View style={[s.statCard, s.statCardLarge]}>
                    <Text style={s.statNumLarge}>{members.length}</Text>
                    <Text style={s.statLabel}>{t.dashboard.total}</Text>
                  </View>
                  <View style={s.statsSmall}>
                    {[[t.dashboard.new7days, new7d], [t.dashboard.new30days, new30d], [t.dashboard.new1year, new1y]].map(([label, val]) => (
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
                <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.earnings}</Text>
                <View style={s.earningsRow}>
                  {[[t.dashboard.thisWeek, weekGross, weekNet], [t.dashboard.thisMonth, monthGross, monthNet], [t.dashboard.allTime, totalGross, totalNet]].map(([label, gross, net]) => (
                    <View key={label as string} style={s.earningsCard}>
                      <Text style={s.earningsLabel}>{label}</Text>
                      <Text style={s.earningsGross}>{fmt(gross as number)}</Text>
                      <Text style={s.earningsNet}>{t.dashboard.net(fmt(net as number))}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Empty state */}
            {viewEvents.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>{t.dashboard.noEvents}</Text>
                <Text style={s.emptySub}>
                  {selectedClubId ? t.dashboard.noEventsForClub(selectedClub?.name ?? '') : t.dashboard.createFirst}
                </Text>
              </View>
            )}

            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 12 }]}>{t.dashboard.upcomingEvents}</Text>
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
                            <Text style={s.upcomingAttendeesLabel}> {t.dashboard.going}</Text>
                          </View>
                          {!e.is_free && e.gross > 0 && <Text style={s.upcomingRevenue}>{fmt(e.gross)}</Text>}
                        </View>
                      </View>
                      <View style={s.upcomingActions}>
                        <TouchableOpacity style={s.upcomingActionBtn}
                          onPress={ev => { ev.stopPropagation(); router.push(`/event/${e.id}/edit` as any); }}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                          <Text style={s.upcomingActionEdit}>{t.dashboard.editBtn}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.upcomingActionBtn, s.upcomingActionPeopleBtn]}
                          onPress={ev => { ev.stopPropagation(); openAttendees(e); }}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                          <Text style={s.upcomingActionPeople}>{t.dashboard.peopleBtn}</Text>
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
              {([
                { key: 'upcoming', label: t.dashboard.upcomingCount(upcomingEvents.length) },
                { key: 'past', label: t.dashboard.pastCount(pastEvents.length) },
                { key: 'cancelled', label: t.dashboard.cancelledCount(cancelledEvents.length) },
              ] as const).map(f => (
                <TouchableOpacity key={f.key} style={[s.segmentItem, eventsFilter === f.key && s.segmentItemActive]}
                  onPress={() => setEventsFilter(f.key)} activeOpacity={0.8}>
                  <Text style={[s.segmentText, eventsFilter === f.key && s.segmentTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {displayedEvents.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>{t.dashboard.noEvents}</Text>
                <Text style={s.emptySub}>
                  {eventsFilter === 'upcoming' ? t.dashboard.createEventHere : eventsFilter === 'past' ? t.dashboard.pastEventsHere : t.dashboard.cancelledEventsHere}
                </Text>
              </View>
            ) : (
              <View style={s.listCard}>
                {displayedEvents.map((e, i) => {
                  const d = new Date(e.date + 'T00:00:00');
                  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  return (
                    <TouchableOpacity key={e.id} style={[s.listRow, i < displayedEvents.length - 1 && s.listRowBorder]}
                      onPress={() => openAttendees(e)} activeOpacity={0.7}>
                      {e.cover_url
                        ? <Image source={{ uri: e.cover_url }} style={s.listAvatar} />
                        : <View style={[s.listAvatar, s.listAvatarFallback]}><Text style={s.listAvatarInitial}>{e.title.charAt(0).toUpperCase()}</Text></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                        <Text style={s.listSub}>{dateStr}</Text>
                        {!e.is_free && <Text style={s.listRevenue}>{t.dashboard.ticketsGross(e.paid_count, fmt(e.gross))}</Text>}
                      </View>
                      {e.status === 'cancelled' && <View style={s.cancelledBadge}><Text style={s.cancelledBadgeText}>{t.dashboard.cancelled}</Text></View>}
                      {!e.is_free && e.gross > 0 && e.status !== 'cancelled' && (
                        <View style={s.goingBadge}>
                          <Text style={s.goingNum}>{e.going_count}</Text>
                          <Text style={s.goingLabel}>{t.dashboard.going}</Text>
                        </View>
                      )}
                      {(e.is_free || e.gross === 0) && e.status !== 'cancelled' && (
                        <View style={s.goingBadge}>
                          <Text style={s.goingNum}>{e.going_count}</Text>
                          <Text style={s.goingLabel}>{t.dashboard.going}</Text>
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
        {activeTab === 'payouts' && !showPayoutsSetup && (
          <View style={s.payoutsIntro}>
            <View style={s.payoutsIntroIcon}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M12 19V5M5 12l7-7 7 7" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M5 19h14" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={s.payoutsIntroTitle}>{t.dashboard.getPaidTitle}</Text>
            <Text style={s.payoutsIntroBody}>
              {t.dashboard.getPaidBody}
            </Text>
            <View style={s.payoutsIntroSteps}>
              <View style={s.payoutsIntroStep}>
                <View style={s.payoutsIntroStepNum}><Text style={s.payoutsIntroStepNumText}>1</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.payoutsIntroStepTitle}>{t.dashboard.billingInfoTitle}</Text>
                  <Text style={s.payoutsIntroStepSub}>{t.dashboard.billingInfoSub}</Text>
                </View>
              </View>
              <View style={s.payoutsIntroStep}>
                <View style={s.payoutsIntroStepNum}><Text style={s.payoutsIntroStepNumText}>2</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.payoutsIntroStepTitle}>{t.dashboard.stripeConnectTitle}</Text>
                  <Text style={s.payoutsIntroStepSub}>{t.dashboard.stripeConnectSub}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.payoutsIntroBtn} onPress={() => setShowPayoutsSetup(true)} activeOpacity={0.85}>
              <Text style={s.payoutsIntroBtnText}>{t.dashboard.continueSetup}</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'payouts' && showPayoutsSetup && (
          <>
            {/* Step 1: Billing info */}
            <View style={s.payoutSection}>
              <View style={s.payoutStepHeader}>
                <View style={[s.payoutStepDot, billing && s.payoutStepDotDone]}>
                  {billing ? <Text style={s.payoutStepCheck}>✓</Text> : <Text style={s.payoutStepNum}>1</Text>}
                </View>
                <Text style={s.payoutStepTitle}>{t.dashboard.fakturacneUdaje}</Text>
                <TouchableOpacity onPress={() => setShowBillingModal(true)}>
                  <Text style={s.payoutStepEdit}>{billing ? t.dashboard.upravit : t.dashboard.nastavit}</Text>
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
                  <View style={s.connectedPill}><Text style={s.connectedPillText}>{t.dashboard.connected}</Text></View>
                )}
              </View>
              {!stripeAccount?.onboarding_complete && (
                <View style={{ gap: 10, marginTop: 12 }}>
                  <Text style={s.stripeInfo}>
                    {t.dashboard.stripeInfo(PLATFORM_FEE_PCT)}
                  </Text>
                  <Button
                    label={connectingStripe ? t.dashboard.opening : t.dashboard.connectStripe}
                    onPress={connectStripe}
                    loading={connectingStripe}
                    disabled={!billing || connectingStripe}
                    variant="black"
                  />
                  {stripeAccount && (
                    <Button label={checkingStatus ? t.dashboard.checking : t.dashboard.checkStatus} onPress={checkStripeStatus}
                      loading={checkingStatus} variant="ghost" />
                  )}
                </View>
              )}
              {stripeAccount?.onboarding_complete && (
                <View style={s.stripeStatusRow}>
                  <View style={[s.stripeStatusDot, { backgroundColor: stripeAccount.payouts_enabled ? Colors.lime : '#FF9500' }]} />
                  <Text style={s.stripeStatusText}>
                    {stripeAccount.payouts_enabled ? t.dashboard.payoutsActive : t.dashboard.payoutsPending}
                  </Text>
                </View>
              )}
            </View>

            {/* Earnings summary */}
            {stripeAccount?.onboarding_complete && (
              <>
                <Text style={s.sectionTitle}>{t.dashboard.earnings}</Text>
                <View style={s.earningsGrid}>
                  {[
                    { label: t.dashboard.thisWeek, gross: weekGross, net: weekNet },
                    { label: t.dashboard.thisMonth, gross: monthGross, net: monthNet },
                    { label: t.dashboard.allTime, gross: totalGross, net: totalNet },
                  ].map(item => (
                    <View key={item.label} style={s.earningsGridCard}>
                      <Text style={s.earningsGridLabel}>{item.label}</Text>
                      <Text style={s.earningsGridGross}>{fmt(item.gross)}</Text>
                      <Text style={s.earningsGridSub}>{t.dashboard.gross}</Text>
                      <View style={s.earningsDivider} />
                      <Text style={s.earningsGridNet}>{fmt(item.net)}</Text>
                      <Text style={s.earningsGridSub}>{t.dashboard.netto}</Text>
                    </View>
                  ))}
                </View>

                {/* Per-event breakdown */}
                {events.filter(e => !e.is_free && e.paid_count > 0).length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.perEvent}</Text>
                    <View style={s.listCard}>
                      {events.filter(e => !e.is_free && e.paid_count > 0).map((e, i, arr) => (
                        <View key={e.id} style={[s.eventBreakdownRow, i < arr.length - 1 && s.listRowBorder]}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                            <Text style={s.listSub}>{e.paid_count} tickets · Stripe {fmt(e.stripe_fee)} · Woeva {fmt(e.woeva_fee)}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.breakdownGross}>{fmt(e.gross)}</Text>
                            <Text style={s.breakdownNet}>{fmt(e.net)} {t.dashboard.netto}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Payout history */}
                {payouts.length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.payoutHistory}</Text>
                    <View style={s.listCard}>
                      {payouts.map((p, i) => {
                        const arrival = new Date(p.arrival_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                        const statusColor = p.status === 'paid' ? Colors.lime : p.status === 'in_transit' ? '#FF9500' : Colors.gray;
                        return (
                          <View key={p.id} style={[s.listRow, i < payouts.length - 1 && s.listRowBorder]}>
                            <View style={[s.payoutStatusDot, { backgroundColor: statusColor }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={s.listName}>{fmt(p.amount)}</Text>
                              <Text style={s.listSub}>{p.status === 'paid' ? t.dashboard.payoutDelivered : p.status === 'in_transit' ? t.dashboard.payoutInTransit : t.dashboard.payoutPending} · {arrival}</Text>
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
                  <Text style={s.invoiceBtnText}>{t.dashboard.downloadInvoice}</Text>
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
                {([['week', t.dashboard.thisWeek], ['month', t.dashboard.thisMonth], ['all', t.dashboard.allTime]] as const).map(([key, label]) => (
                  <TouchableOpacity key={key} style={[s.segmentItem, statsRange === key && s.segmentItemActive]}
                    onPress={() => setStatsRange(key)} activeOpacity={0.8}>
                    <Text style={[s.segmentText, statsRange === key && s.segmentTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Attendance chart — primary */}
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>{t.dashboard.attendance}</Text>
                <EventChart events={viewEvents} range={statsRange} width={chartWidth - 32} getValue={e => e.going_count} color={Colors.black} gradId="attGrad" />
              </View>

              {/* Revenue chart — secondary, only if there's paid revenue */}
              {viewEvents.some(e => e.gross > 0) && (
                <View style={[s.chartCard, { marginTop: 12 }]}>
                  <Text style={s.chartTitle}>{t.dashboard.revenue}</Text>
                  <EventChart events={viewEvents} range={statsRange} width={chartWidth - 32} getValue={e => e.gross} color={Colors.lime} gradId="revGrad" />
                </View>
              )}

              <View style={s.statsOverview}>
                {[
                  { label: t.dashboard.events, val: filtered.length },
                  { label: t.dashboard.ticketsSold, val: filtered.reduce((sum, e) => sum + e.paid_count, 0) },
                  { label: t.dashboard.freeEvents, val: filtered.filter(e => e.is_free).length },
                  { label: t.dashboard.paidEvents, val: filtered.filter(e => !e.is_free).length },
                  { label: t.dashboard.attendees, val: filtered.reduce((sum, e) => sum + e.going_count, 0) },
                  { label: t.dashboard.clubMembers, val: members.length },
                ].map(item => (
                  <View key={item.label} style={s.statsOverviewCard}>
                    <Text style={s.statsOverviewNum}>{item.val}</Text>
                    <Text style={s.statsOverviewLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {fGross > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.revenue}</Text>
                  <View style={s.revenueCard}>
                    <View style={s.revenueRow}>
                      <Text style={s.revenueLabel}>{t.dashboard.grossRevenue}</Text>
                      <Text style={s.revenueVal}>{fmt(fGross)}</Text>
                    </View>
                    <View style={s.revenueRow}>
                      <Text style={s.revenueLabel}>{t.dashboard.stripeFees}</Text>
                      <Text style={[s.revenueVal, { color: Colors.gray }]}>- {fmt(fStripe)}</Text>
                    </View>
                    <View style={s.revenueRow}>
                      <Text style={s.revenueLabel}>{t.dashboard.woevaFee}</Text>
                      <Text style={[s.revenueVal, { color: Colors.gray }]}>- {fmt(fWoeva)}</Text>
                    </View>
                    <View style={[s.revenueRow, { borderTopWidth: 1.5, borderTopColor: Colors.black, marginTop: 8, paddingTop: 12 }]}>
                      <Text style={[s.revenueLabel, { fontWeight: '800', fontFamily: Fonts.extrabold }]}>{t.dashboard.netToYou}</Text>
                      <Text style={[s.revenueVal, { fontWeight: '800', fontFamily: Fonts.extrabold }]}>{fmt(fNet)}</Text>
                    </View>
                  </View>
                </>
              )}

              {filtered.length > 0 && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.topByAttendance}</Text>
                  <View style={s.listCard}>
                    {[...filtered].sort((a, b) => b.going_count - a.going_count).slice(0, 5).map((e, i, arr) => (
                      <View key={e.id} style={[s.listRow, i < arr.length - 1 && s.listRowBorder]}>
                        <Text style={s.rankNum}>{i + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                          <Text style={s.listSub}>{t.dashboard.attendeesCount(e.going_count)}</Text>
                        </View>
                        {!e.is_free && <Text style={s.eventRevenue}>{fmt(e.gross)}</Text>}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {filtered.length === 0 && (
                <View style={s.emptyBox}>
                  <Text style={s.emptyTitle}>{t.dashboard.noData}</Text>
                  <Text style={s.emptySub}>{t.dashboard.noPeriodEvents}</Text>
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>

      {/* ── SCAN ──────────────────────────────────────────────────────────── */}
      {activeTab === 'scan' && (
        <View style={[StyleSheet.absoluteFill, s.scanContainer, { top: insets.top + 60, bottom: 80 + insets.bottom }]}>
          {!cameraPermission?.granted ? (
            <View style={s.scanPermBox}>
              <Text style={s.scanPermTitle}>{t.dashboard.cameraNeeded}</Text>
              <Text style={s.scanPermSub}>{t.dashboard.cameraNeededSub}</Text>
              <TouchableOpacity style={s.scanPermBtn} onPress={requestCameraPermission}>
                <Text style={s.scanPermBtnText}>{t.dashboard.allowCamera}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {SafeCameraView && (
              <SafeCameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={scannedTicket || scanProcessing ? undefined : handleQrScan}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
            )}
              <View style={s.scanFrame}>
                <View style={s.scanCornerTL} /><View style={s.scanCornerTR} />
                <View style={s.scanCornerBL} /><View style={s.scanCornerBR} />
              </View>
              <Text style={s.scanHint}>{t.dashboard.pointCamera}</Text>
              {scannedTicket && (
                <View style={s.scanResult}>
                  <View style={s.scanResultTop}>
                    <View style={[s.scanResultDot, { backgroundColor: scannedTicket.valid ? Colors.lime : '#FF3B30' }]} />
                    <View style={s.scanResultAvatar}>
                      {scannedTicket.avatar_url
                        ? <Image source={{ uri: scannedTicket.avatar_url }} style={StyleSheet.absoluteFill as any} />
                        : <Text style={s.scanResultInitial}>{scannedTicket.userName.charAt(0).toUpperCase()}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.scanResultName}>{scannedTicket.userName}</Text>
                      <Text style={s.scanResultEvent} numberOfLines={1}>{scannedTicket.eventTitle}</Text>
                      <Text style={[s.scanResultStatus, { color: scannedTicket.valid ? '#22C55E' : '#FF3B30' }]}>
                        {scannedTicket.valid ? t.dashboard.validTicket : t.dashboard.notRegistered}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setScannedTicket(null)} style={s.scanResultClose}>
                      <Text style={{ fontSize: 18, color: Colors.gray }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {scannedTicket.valid && (
                    <TouchableOpacity
                      style={[s.scanCheckInBtn, checkedIn[scannedTicket.eventId]?.has(scannedTicket.userId) && s.scanCheckInBtnDone]}
                      onPress={() => markCheckedIn(scannedTicket.eventId, scannedTicket.userId)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.scanCheckInBtnText, checkedIn[scannedTicket.eventId]?.has(scannedTicket.userId) && { color: Colors.black }]}>
                        {checkedIn[scannedTicket.eventId]?.has(scannedTicket.userId) ? t.dashboard.checkedIn : t.dashboard.confirmArrival}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* ── Club Settings Modal ─────────────────────────────────────────────── */}
      <Modal visible={showClubSettings} transparent animationType="slide" onRequestClose={() => setShowClubSettings(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowClubSettings(false)}>
          <View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.billingSheetHandle} />
            <Text style={s.billingSheetTitle}>{t.dashboard.clubSettings}</Text>

            {/* Edit club */}
            <View style={s.settingsSection}>
              <Text style={s.settingsSectionTitle}>{t.dashboard.clubSection}</Text>
              <TouchableOpacity style={s.settingsRow} onPress={() => {
                setShowClubSettings(false);
                const c = selectedClub ?? clubs[0];
                if (c) router.push(`/club/${c.id}/edit` as any);
              }} activeOpacity={0.7}>
                <Text style={s.settingsRowLabel}>{t.dashboard.editClubDetails}</Text>
                <Text style={s.settingsRowArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Admins */}
            <View style={s.settingsSection}>
              <Text style={s.settingsSectionTitle}>{t.dashboard.admins.toUpperCase()}</Text>
              {clubAdmins.map(a => (
                <View key={a.user_id} style={s.settingsAdminRow}>
                  <View style={s.attendeeAvatar}>
                    {a.avatar_url ? <Image source={{ uri: a.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                    {!a.avatar_url && <Text style={s.attendeeInitial}>{a.name.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <Text style={[s.attendeeName, { flex: 1 }]}>{a.name}</Text>
                  {a.user_id === user?.id
                    ? <Text style={s.settingsOwnerBadge}>{t.club.owner}</Text>
                    : <TouchableOpacity onPress={() => removeAdmin(a.user_id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.settingsRemoveText}>{t.club.remove}</Text>
                      </TouchableOpacity>
                  }
                </View>
              ))}
              <TouchableOpacity style={s.settingsRow} onPress={() => { setShowInviteAdmin(true); }} activeOpacity={0.7}>
                <Text style={[s.settingsRowLabel, { color: Colors.black, fontWeight: '600' }]}>{t.dashboard.inviteAdminPlus}</Text>
              </TouchableOpacity>
            </View>

            {/* Creator notifications */}
            <View style={s.settingsSection}>
              <Text style={s.settingsSectionTitle}>{t.dashboard.myNotifications}</Text>
              {[
                { label: t.dashboard.someoneJoins, val: notifJoin, set: setNotifJoin },
                { label: t.dashboard.someoneLeaves, val: notifLeave, set: setNotifLeave },
                { label: t.dashboard.newChatMessages, val: notifChat, set: setNotifChat },
              ].map(item => (
                <View key={item.label} style={s.settingsToggleRow}>
                  <Text style={s.settingsRowLabel}>{item.label}</Text>
                  <TouchableOpacity
                    style={[s.toggle, item.val && s.toggleOn]}
                    onPress={() => item.set(v => !v)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.toggleThumb, item.val && s.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Invite Admin Modal ──────────────────────────────────────────────── */}
      <Modal visible={showInviteAdmin} transparent animationType="slide" onRequestClose={() => setShowInviteAdmin(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowInviteAdmin(false)}>
          <View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.billingSheetHandle} />
            <Text style={s.billingSheetTitle}>{t.club.inviteAdmin}</Text>
            <Text style={[s.listSub, { marginBottom: 12 }]}>{t.club.inviteAdminSub((selectedClub ?? clubs[0])?.name ?? '')}</Text>
            <TextInput
              style={s.inviteInput}
              value={inviteQuery}
              onChangeText={searchInvite}
              placeholder={t.club.inviteEmailPlaceholder}
              placeholderTextColor={Colors.gray}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            {inviteResults.map((r: any, i) => (
              <TouchableOpacity
                key={r.id}
                style={[s.attendeeRow, i < inviteResults.length - 1 && { borderBottomWidth: 1, borderColor: Colors.grayBorder }]}
                onPress={() => inviteAdmin(r.id, r.name)}
                activeOpacity={0.7}
                disabled={invitingAdmin}
              >
                <View style={s.attendeeAvatar}>
                  {r.avatar_url ? <Image source={{ uri: r.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                  {!r.avatar_url && <Text style={s.attendeeInitial}>{r.name.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.attendeeName}>{r.name}</Text>
                  {r.email && <Text style={s.listSub}>{r.email}</Text>}
                </View>
                <Text style={[s.listSub, { marginLeft: 'auto' }]}>{t.club.addArrow}</Text>
              </TouchableOpacity>
            ))}
            {inviteQuery.length >= 2 && inviteResults.length === 0 && (
              <Text style={[s.emptySub, { marginTop: 12 }]}>{t.club.notFound}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Attendees Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!attendeesEvent} transparent animationType="slide" onRequestClose={() => setAttendeesEvent(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setAttendeesEvent(null)}>
          <View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.billingSheetHandle} />
            <Text style={s.billingSheetTitle}>{attendeesEvent?.title}</Text>
            <Text style={[s.listSub, { marginBottom: 12 }]}>{attendeesEvent?.going_count} {t.dashboard.going}</Text>
            {loadingAttendees
              ? <ActivityIndicator color={Colors.black} />
              : <FlatList
                  data={attendees}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => {
                    const isIn = checkedIn[attendeesEvent?.id ?? '']?.has(item.id);
                    return (
                      <View style={s.attendeeRow}>
                        <View style={s.attendeeAvatar}>
                          {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                          {!item.avatar_url && <Text style={s.attendeeInitial}>{item.name.charAt(0).toUpperCase()}</Text>}
                        </View>
                        <Text style={s.attendeeName}>{item.name.split(' ')[0]}</Text>
                        {isIn
                          ? <View style={s.checkedInBadge}><Text style={s.checkedInBadgeText}>{t.dashboard.checkedIn}</Text></View>
                          : <TouchableOpacity style={s.checkInBtn} onPress={() => markCheckedIn(attendeesEvent!.id, item.id)} activeOpacity={0.7}>
                              <Text style={s.checkInBtnText}>{t.dashboard.checkIn}</Text>
                            </TouchableOpacity>
                        }
                      </View>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.grayBorder }} />}
                  ListEmptyComponent={<Text style={s.emptySub}>{t.dashboard.noAttendeesYet}</Text>}
                />
            }
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
      <View style={[s.bottomNavWrapper, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.bottomNavPill}>
          {([
            { key: 'home', label: t.dashboard.homeTab, icon: 'home' },
            { key: 'events', label: t.dashboard.events, icon: 'calendar' },
            { key: 'scan', label: t.dashboard.scanTab, icon: 'scan', center: true },
            { key: 'stats', label: t.dashboard.statsTab, icon: 'bar' },
            { key: 'payouts', label: t.dashboard.payoutsTab, icon: 'payout' },
          ] as { key: DashTab; label: string; icon: string; center?: boolean }[]).map(tab => {
            const active = activeTab === tab.key;
            const color = active ? Colors.black : 'rgba(0,0,0,0.35)';
            if (tab.center) {
              return (
                <TouchableOpacity key={tab.key} style={s.bottomNavScanBtn} onPress={() => setActiveTab(tab.key)} activeOpacity={0.85}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Rect x="3" y="3" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} />
                    <Rect x="15" y="3" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} />
                    <Rect x="3" y="15" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} />
                    <Path d="M15 17h3M17 15v3" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={tab.key} style={s.bottomNavItem} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  {tab.icon === 'home' && <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />}
                  {tab.icon === 'calendar' && <><Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={active ? 2.5 : 1.8} /><Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" /></>}
                  {tab.icon === 'bar' && <Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />}
                  {tab.icon === 'payout' && <><Path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" /><Path d="M5 19h14" stroke={color} strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" /></>}
                </Svg>
                <Text style={[s.bottomNavLabel, active && s.bottomNavLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  clubCard: { height: 150, borderRadius: 20, overflow: 'hidden', marginBottom: 24, backgroundColor: '#000' },
  clubCardContent: { position: 'absolute', bottom: 14, left: 16, right: 16 },
  clubCardLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  clubCardName: { fontSize: 19, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white, marginBottom: 10 },
  clubCardActions: { flexDirection: 'row', gap: 8 },
  clubCardActionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.18)' },
  clubCardActionBtnEdit: { backgroundColor: Colors.lime },
  clubCardActionText: { fontSize: 12, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },
  clubCardActionTextEdit: { color: Colors.black },

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
  bottomNavWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8, backgroundColor: Colors.white },
  bottomNavPill: { backgroundColor: '#E8E8E8', borderRadius: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 68 },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  bottomNavScanBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  bottomNavLabel: { fontSize: 10, color: 'rgba(0,0,0,0.4)', fontFamily: Fonts.regular },
  bottomNavLabelActive: { color: Colors.black, fontWeight: '600', fontFamily: Fonts.semibold },

  // View filter (All / Club / Individual)
  viewFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  viewFilterLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.medium, marginRight: 2 },
  viewFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight },
  viewFilterChipActive: { backgroundColor: Colors.black },
  viewFilterText: { fontSize: 12, fontWeight: '500', color: Colors.gray, fontFamily: Fonts.medium },
  viewFilterTextActive: { color: Colors.white, fontWeight: '700', fontFamily: Fonts.bold },
  inviteInput: { height: 44, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: Colors.black, marginBottom: 12 },
  settingsSection: { marginBottom: 20 },
  settingsSectionTitle: { fontSize: 11, fontWeight: '600', color: Colors.gray, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderColor: Colors.grayBorder },
  settingsRowLabel: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular },
  settingsRowArrow: { fontSize: 18, color: Colors.gray },
  settingsToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderColor: Colors.grayBorder },
  settingsAdminRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: Colors.grayBorder },
  settingsOwnerBadge: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  settingsRemoveText: { fontSize: 13, color: '#CC3333', fontFamily: Fonts.medium },

  // Payouts intro
  payoutsIntro: { paddingTop: 12, gap: 16 },
  payoutsIntroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  payoutsIntroTitle: { fontSize: 22, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold, letterSpacing: -0.3 },
  payoutsIntroBody: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 20 },
  payoutsIntroSteps: { gap: 14, backgroundColor: Colors.grayLight, borderRadius: 18, padding: 16 },
  payoutsIntroStep: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  payoutsIntroStepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  payoutsIntroStepNumText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  payoutsIntroStepTitle: { fontSize: 14, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, marginBottom: 3 },
  payoutsIntroStepSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  payoutsIntroBtn: { backgroundColor: Colors.black, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  payoutsIntroBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },

  // Attendees modal
  attendeesSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 16, maxHeight: '70%' },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  attendeeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  attendeeInitial: { fontSize: 16, fontWeight: '700', color: Colors.black },
  attendeeName: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },

  // People button (replaces Cancel)
  upcomingActionPeopleBtn: { backgroundColor: Colors.grayLight },
  upcomingActionPeople: { fontSize: 10, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },

  // QR scan tab
  scanContainer: { backgroundColor: '#000', overflow: 'hidden' },
  scanPermBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  scanPermTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
  scanPermSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontFamily: Fonts.regular },
  scanPermBtn: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  scanPermBtnText: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  scanFrame: { position: 'absolute', top: '30%', left: '15%', right: '15%', bottom: '35%' },
  scanCornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.lime, borderTopLeftRadius: 8 },
  scanCornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.lime, borderTopRightRadius: 8 },
  scanCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.lime, borderBottomLeftRadius: 8 },
  scanCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.lime, borderBottomRightRadius: 8 },
  scanHint: { position: 'absolute', bottom: 100, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: Fonts.regular },
  scanResult: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  scanResultTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scanResultDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  scanResultAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  scanResultInitial: { fontSize: 20, fontWeight: '700', color: Colors.black },
  scanResultName: { fontSize: 16, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  scanResultEvent: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  scanResultStatus: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.semibold, marginTop: 4 },
  scanResultClose: { padding: 8 },
  scanCheckInBtn: { backgroundColor: Colors.black, borderRadius: 50, paddingVertical: 13, alignItems: 'center' },
  scanCheckInBtnDone: { backgroundColor: Colors.lime },
  scanCheckInBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },

  // Attendees check-in
  checkedInBadge: { backgroundColor: '#E8FAF0', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5 },
  checkedInBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  checkInBtn: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6 },
  checkInBtnText: { fontSize: 11, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },

  // Toggle switch (used in club settings)
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' as const },

  // Back button in topbar
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bellBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', borderWidth: 1.5, borderColor: Colors.white },
});
