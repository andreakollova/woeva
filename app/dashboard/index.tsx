import React, { useState, useCallback, useMemo, useRef } from 'react';
import { setStatusBarStyle } from 'expo-status-bar';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Image, Alert, ActivityIndicator, Modal, TextInput, Platform, FlatList, KeyboardAvoidingView, RefreshControl, Share, PanResponder, Animated as RNAnimated, Easing,
} from 'react-native';
// expo-camera requires a native build - safe lazy import
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
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, Rect, Polyline, Polygon, Text as SvgText, G } from 'react-native-svg';
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
const WOEVA_FEE_PCT = 0.04;      // 4% Woeva platform fee
const WOEVA_FEE_FIXED = 0.50;    // €0.50 Woeva fixed fee per ticket
const STRIPE_PCT = 0.015;        // 1.5% Stripe EU fee
const STRIPE_FIXED = 0.25;       // €0.25 Stripe fixed fee

// ─── Payment method icons ──────────────────────────────────────────────────────
function PayMethodIcon({ method }: { method: 'visa' | 'mc' | 'amex' | 'apple' | 'gpay' }) {
  if (method === 'visa') return (
    <Svg width={52} height={34} viewBox="0 0 52 34">
      <Rect width={52} height={34} rx={6} fill="white" stroke="#E2E8F0" strokeWidth={1.5} />
      {/* VISA wordmark paths */}
      <Path d="M19.5 22.5l2.1-12h3.3l-2.1 12h-3.3z" fill="#1A1F71" />
      <Path d="M32.2 10.8c-.65-.24-1.67-.5-2.95-.5-3.25 0-5.54 1.63-5.56 3.97-.03 1.73 1.63 2.7 2.88 3.27 1.28.59 1.71.97 1.7 1.49-.01.81-.02 1.17-1.48 1.17-1.38 0-2.15-.21-3.3-.7l-.45-.2-.49 2.87c.82.36 2.33.67 3.9.68 3.67 0 6.05-1.71 6.08-4.35.01-1.45-.91-2.55-2.9-3.46-1.21-.59-1.95-.98-1.94-1.57 0-.53.63-1.09 1.98-1.09 1.13-.02 1.95.23 2.59.48l.31.14.47-2.76z" fill="#1A1F71" />
      <Path d="M36.5 18.5c.27-.69 1.31-3.36 1.31-3.36-.02.03.27-.7.44-1.15l.22 1.04s.63 2.88.76 3.47H36.5zm3.84-7.97h-2.54c-.79 0-1.38.21-1.73.99l-4.9 11.01h3.67l.73-1.9h4.48l.41 1.9h3.24l-3.36-12z" fill="#1A1F71" />
      <Path d="M16.8 10.5l-3.22 8.18-.34-1.65c-.6-1.92-2.46-4.01-4.54-5.05l2.94 10.52h3.69l5.49-12h-4.02z" fill="#1A1F71" />
      <Path d="M10.5 10.5H4.93l-.06.28c4.34 1.05 7.21 3.57 8.4 6.6l-1.21-5.84c-.21-.82-.79-1.01-1.56-1.04z" fill="#F9A533" />
    </Svg>
  );
  if (method === 'mc') return (
    <Svg width={52} height={34} viewBox="0 0 52 34">
      <Rect width={52} height={34} rx={6} fill="white" stroke="#E2E8F0" strokeWidth={1.5} />
      <Circle cx={20} cy={17} r={10} fill="#EB001B" />
      <Circle cx={32} cy={17} r={10} fill="#F79E1B" />
      {/* Overlap blend area */}
      <Path d="M26 9.3a10 10 0 0 1 0 15.4A10 10 0 0 1 26 9.3z" fill="#FF5F00" />
    </Svg>
  );
  if (method === 'amex') return (
    <Svg width={52} height={34} viewBox="0 0 52 34">
      <Rect width={52} height={34} rx={6} fill="#016FD0" />
      <SvgText x="26" y="22" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="white" fontFamily="Arial, Helvetica, sans-serif" letterSpacing={2}>AMEX</SvgText>
    </Svg>
  );
  if (method === 'apple') return (
    <Svg width={64} height={34} viewBox="0 0 64 34">
      <Rect width={64} height={34} rx={6} fill="black" />
      {/* Apple logo — official path scaled to fit */}
      <G transform="translate(8, 7.5) scale(0.73)">
        <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="white" />
      </G>
      <SvgText x="40" y="22" textAnchor="middle" fontSize="12" fill="white" fontFamily="Arial, sans-serif" fontWeight="300">Pay</SvgText>
    </Svg>
  );
  // gpay — 3-colour ring G (opening at top-right) + blue bar
  const cx = 16, cy = 17, ro = 8, ri = 4.5;
  return (
    <Svg width={64} height={34} viewBox="0 0 64 34">
      <Rect width={64} height={34} rx={6} fill="white" stroke="#E2E8F0" strokeWidth={1.5} />
      {/* Red arc: right→bottom (0°→90°) */}
      <Path d={`M${cx+ro} ${cy} A${ro} ${ro} 0 0 1 ${cx} ${cy+ro} L${cx} ${cy+ri} A${ri} ${ri} 0 0 0 ${cx+ri} ${cy} Z`} fill="#EA4335" />
      {/* Yellow arc: bottom→left (90°→180°) */}
      <Path d={`M${cx} ${cy+ro} A${ro} ${ro} 0 0 1 ${cx-ro} ${cy} L${cx-ri} ${cy} A${ri} ${ri} 0 0 0 ${cx} ${cy+ri} Z`} fill="#FBBC05" />
      {/* Green arc: left→top (180°→270°) */}
      <Path d={`M${cx-ro} ${cy} A${ro} ${ro} 0 0 1 ${cx} ${cy-ro} L${cx} ${cy-ri} A${ri} ${ri} 0 0 0 ${cx-ri} ${cy} Z`} fill="#34A853" />
      {/* Blue cap: top→top-right (~270°→315°) */}
      <Path d={`M${cx} ${cy-ro} A${ro} ${ro} 0 0 1 ${cx+5.7} ${cy-5.7} L${cx+3.2} ${cy-3.2} A${ri} ${ri} 0 0 0 ${cx} ${cy-ri} Z`} fill="#4285F4" />
      {/* Blue horizontal bar */}
      <Rect x={cx} y={cy - 2.2} width={ro + 0.5} height={4.4} fill="#4285F4" />
      <SvgText x="43" y="22" textAnchor="middle" fontSize="12" fill="#5F6368" fontFamily="Arial, sans-serif" fontWeight="500">Pay</SvgText>
    </Svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DashTab = 'home' | 'payouts' | 'stats' | 'scan' | 'coordinator';

type Member = {
  id: string; user_id: string; created_at: string;
  profile: { id: string; name: string; avatar_url: string | null } | null;
};

type EventRow = {
  id: string; title: string; date: string; time: string;
  going_count: number; cover_url: string | null; cover_urls?: string[] | null; club_id: string | null;
  creator_id: string; capacity?: number | null;
  price: number; is_free: boolean; status: string;
  is_recurring?: boolean; recurring_end_date?: string | null;
  paid_count: number; online_count: number; door_count: number; scan_count: number;
  gross: number; onlineGross: number; doorGross: number; stripe_fee: number; woeva_fee: number; onlineNet: number; net: number;
  _startDate?: string;
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

// Strip invisible/zero-width unicode chars that sneak in from web copy-paste
function sanitize(s: string) {
  return s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E\u00A0]/g, ' ').replace(/\s+/g, ' ').trimStart();
}

// Real attendee count
function realGoing(e: { going_count: number; creator_id: string; capacity?: number | null }, userId: string) {
  return e.going_count;
}

function goingLabel(n: number, lang: string): string {
  if (lang !== 'sk') return 'going';
  if (n >= 2 && n <= 4) return 'idú';
  return 'ide';
}

function calcRevenue(price: number, onlineCount: number, doorCount: number) {
  const onlineGross = price * onlineCount;
  const doorGross = price * doorCount;
  const gross = onlineGross + doorGross;

  // Application fee per ticket — must match create-payment-intent edge function exactly:
  // 4% + €0.50 per ticket
  const woevaFeePerTicket = onlineCount > 0 ? Math.round((price * WOEVA_FEE_PCT + WOEVA_FEE_FIXED) * 100) / 100 : 0;
  const woeva_fee = Math.round(woevaFeePerTicket * onlineCount * 100) / 100;

  // Stripe fee is paid by the platform (Woeva), not deducted from vendor payout in destination charges
  // Shown for transparency only
  const stripe_fee = onlineCount > 0 ? Math.round((onlineGross * STRIPE_PCT + onlineCount * STRIPE_FIXED) * 100) / 100 : 0;

  // Vendor's actual Stripe payout = what they receive per ticket after application fee
  const onlineNet = Math.max(0, Math.round((onlineGross - woeva_fee) * 100) / 100);

  // Total = Stripe payout + at-door cash (at-door has no fees)
  const net = Math.round((onlineNet + doorGross) * 100) / 100;

  return { gross, onlineGross, doorGross, stripe_fee, woeva_fee, onlineNet, net };
}

function isUpcoming(e: EventRow) {
  if (e.is_recurring && e.recurring_end_date) {
    return new Date(e.recurring_end_date + 'T23:59:59') >= new Date();
  }
  return new Date(`${e.date}T${e.time ?? '00:00'}`) >= new Date();
}

function expandDashboardRows(rows: EventRow[], occurrenceCounts?: Record<string, number>): EventRow[] {
  const result: EventRow[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 3);
  for (const row of rows) {
    if (!row.is_recurring) { result.push(row); continue; }
    const startDate = new Date(row.date + 'T00:00:00');
    const endDate = row.recurring_end_date ? new Date(row.recurring_end_date + 'T00:00:00') : maxDate;
    const cap = endDate < maxDate ? endDate : maxDate;
    let current = new Date(startDate);
    while (current < today) current.setDate(current.getDate() + 7);
    while (current <= cap) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const syntheticId = `${row.id}_${dateStr}`;
      const occCount = occurrenceCounts
        ? (occurrenceCounts[syntheticId] ?? occurrenceCounts[`${row.id}_${dateStr}`] ?? 0)
        : row.going_count;
      result.push({ ...row, id: syntheticId, date: dateStr, _startDate: row.date, going_count: occCount });
      current = new Date(current);
      current.setDate(current.getDate() + 7);
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function getRotatingCover(e: EventRow): string | null {
  const covers = e.cover_urls?.length ? e.cover_urls : (e.cover_url ? [e.cover_url] : []);
  if (!covers.length) return null;
  if (!e.is_recurring || covers.length === 1) return covers[0];
  const start = new Date((e._startDate ?? e.date) + 'T00:00:00');
  const occ = new Date(e.date + 'T00:00:00');
  const weekIndex = Math.max(0, Math.round((occ.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  return covers[weekIndex % covers.length];
}

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
  const { t, lang } = useTranslations();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40;
  const { tab: tabParam, openEvent: openEventParam, selectClub: selectClubParam } = useLocalSearchParams<{ tab?: string; openEvent?: string; selectClub?: string }>();

  const [activeTab, setActiveTab] = useState<DashTab>((['home','payouts','stats','scan','coordinator'].includes(tabParam as string) ? tabParam as DashTab : 'home'));
  const scanOriginRef = useRef<DashTab>('home');
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const pillsScrollRef = useRef<any>(null);
  const carouselRef = useRef<any>(null);
  const pillLayoutsRef = useRef<number[]>([]);
  const isScrollingProgrammatically = useRef(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [coordEvents, setCoordEvents] = useState<EventRow[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(null);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showFeeInfo, setShowFeeInfo] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'month'>('all');
  const [payoutPage, setPayoutPage] = useState(0);

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
  const [occurrenceCounts, setOccurrenceCounts] = useState<Record<string, number>>({});

  // Payouts intro gate — auto-open setup if arrived via tab=payouts param
  const [showPayoutsSetup, setShowPayoutsSetup] = useState(tabParam === 'payouts');

  // Club settings sheet
  const [showClubSettings, setShowClubSettings] = useState(false);
  const [clubAdmins, setClubAdmins] = useState<{ user_id: string; name: string; avatar_url: string | null }[]>([]);
  const [notifJoin, setNotifJoin] = useState(true);
  const [notifLeave, setNotifLeave] = useState(true);
  const [notifChat, setNotifChat] = useState(profile?.notif_chat ?? true);

  // Invite admin
  const [showInviteAdmin, setShowInviteAdmin] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [invitingAdmin, setInvitingAdmin] = useState(false);

  // Coordinator invite
  const [showCoordInvite, setShowCoordInvite] = useState(false);
  const [coordScope, setCoordScope] = useState<'event' | 'club'>('event');
  const [coordQuery, setCoordQuery] = useState('');
  const [coordResults, setCoordResults] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);

  // Coordinator mode (user is coordinator but not admin of any club)
  const [myCoordinations, setMyCoordinations] = useState<{ id: string; club_id: string; event_id: string | null; club_name: string; event_title: string | null }[]>([]);

  // Animated bottom sheet refs for modals
  const SHEET_INIT = 900;
  const sheetOpen = (y: RNAnimated.Value) => RNAnimated.timing(y, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  const sheetClose = (y: RNAnimated.Value, cb: () => void) => RNAnimated.timing(y, { toValue: SHEET_INIT, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => { cb(); y.setValue(SHEET_INIT); });
  const sheetSnap = (y: RNAnimated.Value) => RNAnimated.timing(y, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

  const attendeesSheetY = useRef(new RNAnimated.Value(SHEET_INIT)).current;
  const attendeesListOffset = useRef(0);
  const attendeesPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    // Capture phase: intercept downward swipe only when list is scrolled to the top
    onMoveShouldSetPanResponderCapture: (_, { dy, dx }) =>
      attendeesListOffset.current <= 0 && dy > 5 && Math.abs(dy) > Math.abs(dx),
    onMoveShouldSetPanResponder: (_, { dy, dx }) =>
      attendeesListOffset.current <= 0 && dy > 5 && Math.abs(dy) > Math.abs(dx),
    onPanResponderMove: (_, { dy }) => { if (dy > 0) attendeesSheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) { sheetClose(attendeesSheetY, () => setAttendeesEvent(null)); }
      else { sheetSnap(attendeesSheetY); }
    },
  })).current;
  // Dedicated handle pan — starts immediately so the drag pill always works
  const attendeesHandlePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) attendeesSheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) sheetClose(attendeesSheetY, () => setAttendeesEvent(null));
      else sheetSnap(attendeesSheetY);
    },
  })).current;

  const clubSettingsSheetY = useRef(new RNAnimated.Value(SHEET_INIT)).current;
  const clubSettingsPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dy, dx }) => dy > 8 && Math.abs(dy) > Math.abs(dx),
    onPanResponderMove: (_, { dy }) => { if (dy > 0) clubSettingsSheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) { sheetClose(clubSettingsSheetY, () => setShowClubSettings(false)); }
      else { sheetSnap(clubSettingsSheetY); }
    },
  })).current;

  const inviteAdminSheetY = useRef(new RNAnimated.Value(SHEET_INIT)).current;
  const inviteAdminPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) inviteAdminSheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) { sheetClose(inviteAdminSheetY, () => { setShowInviteAdmin(false); setInviteQuery(''); setInviteResults([]); }); }
      else { sheetSnap(inviteAdminSheetY); }
    },
  })).current;

  const coordInviteSheetY = useRef(new RNAnimated.Value(SHEET_INIT)).current;
  const coordInvitePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dy, dx }) => dy > 8 && Math.abs(dy) > Math.abs(dx),
    onPanResponderMove: (_, { dy }) => { if (dy > 0) coordInviteSheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) { sheetClose(coordInviteSheetY, () => { setShowCoordInvite(false); setCoordQuery(''); setCoordResults([]); }); }
      else { sheetSnap(coordInviteSheetY); }
    },
  })).current;

  function closeAttendees() { sheetClose(attendeesSheetY, () => setAttendeesEvent(null)); }
  function closeClubSettings() { sheetClose(clubSettingsSheetY, () => setShowClubSettings(false)); }
  function closeInviteAdmin() { sheetClose(inviteAdminSheetY, () => { setShowInviteAdmin(false); setInviteQuery(''); setInviteResults([]); }); }
  function closeCoordInvite() { sheetClose(coordInviteSheetY, () => { setShowCoordInvite(false); setCoordQuery(''); setCoordResults([]); }); }
  function openCoordInvite() {
    setCoordScope('event'); setCoordQuery(''); setCoordResults([]);
    coordInviteSheetY.setValue(SHEET_INIT); setShowCoordInvite(true); sheetOpen(coordInviteSheetY);
  }

  // Check-ins: eventId → Set of userId
  const [checkedIn, setCheckedIn] = useState<Record<string, Set<string>>>({});

  function markCheckedIn(eventId: string, userId: string) {
    setCheckedIn(prev => {
      if (prev[eventId]?.has(userId)) return prev;
      const s = new Set(prev[eventId] ?? []);
      s.add(userId);
      return { ...prev, [eventId]: s };
    });
    setEvents(prev => prev.map(e =>
      e.id === eventId && !(checkedIn[eventId]?.has(userId))
        ? { ...e, scan_count: (e.scan_count ?? 0) + 1 }
        : e
    ));
    supabase.from('check_ins').upsert({ event_id: eventId, user_id: userId }).then(() => {});
  }

  function unmarkCheckedIn(eventId: string, userId: string) {
    setCheckedIn(prev => {
      const s = new Set(prev[eventId] ?? []);
      s.delete(userId);
      return { ...prev, [eventId]: s };
    });
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, scan_count: Math.max(0, (e.scan_count ?? 1) - 1) } : e
    ));
    supabase.from('check_ins').delete().eq('event_id', eventId).eq('user_id', userId).then(() => {});
  }

  // Realtime check-ins: sync across multiple admins/coordinators
  React.useEffect(() => {
    const eventIds = events.map(e => e.id);
    if (eventIds.length === 0) return;
    const ch = supabase
      .channel(`checkins_${eventIds.join('_').slice(0, 50)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_ins' }, (payload: any) => {
        const { event_id, user_id } = payload.new;
        if (!eventIds.includes(event_id)) return;
        setCheckedIn(prev => {
          if (prev[event_id]?.has(user_id)) return prev;
          const s = new Set(prev[event_id] ?? []);
          s.add(user_id);
          return { ...prev, [event_id]: s };
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'check_ins' }, (payload: any) => {
        const { event_id, user_id } = payload.old;
        if (!eventIds.includes(event_id)) return;
        setCheckedIn(prev => {
          const s = new Set(prev[event_id] ?? []);
          s.delete(user_id);
          return { ...prev, [event_id]: s };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [events.length]);

  // Realtime attendees: update going count for ALL events (admin + coordinator)
  React.useEffect(() => {
    const ids = [...events.map(e => e.id), ...coordEvents.map(e => e.id)];
    if (ids.length === 0) return;
    const ch = supabase
      .channel('dashboard_attendees')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_attendees' }, (payload: any) => {
        const eid = payload.new?.event_id;
        if (!ids.includes(eid)) return;
        const bump = (e: EventRow) => e.id === eid ? { ...e, going_count: (e.going_count ?? 0) + 1, paid_count: (e.paid_count ?? 0) + 1 } : e;
        setEvents(prev => prev.map(bump));
        setCoordEvents(prev => prev.map(bump));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_attendees' }, (payload: any) => {
        const eid = payload.old?.event_id;
        if (!ids.includes(eid)) return;
        const dec = (e: EventRow) => e.id === eid ? { ...e, going_count: Math.max(0, (e.going_count ?? 1) - 1), paid_count: Math.max(0, (e.paid_count ?? 1) - 1) } : e;
        setEvents(prev => prev.map(dec));
        setCoordEvents(prev => prev.map(dec));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [events.length, coordEvents.length]);

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
    clubSettingsSheetY.setValue(SHEET_INIT);
    setShowClubSettings(true);
    sheetOpen(clubSettingsSheetY);
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

  async function searchCoord(q: string) {
    setCoordQuery(q);
    if (q.trim().length < 2) { setCoordResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, name, avatar_url').ilike('name', `%${q.trim()}%`).neq('id', user!.id).limit(6);
    setCoordResults((data ?? []) as any[]);
  }

  async function addCoordinator(profileId: string, profileName: string) {
    if (!attendeesEvent) return;
    const clubId = attendeesEvent.club_id;
    if (!clubId) return;
    await supabase.from('coordinators').upsert({ club_id: clubId, event_id: null, user_id: profileId, invited_by: user!.id, status: 'active' }, { onConflict: 'club_id,event_id,user_id' });
    const clubName = clubs.find(c => c.id === clubId)?.name ?? 'klub';
    await supabase.from('notifications').insert({ user_id: profileId, type: 'coordinator_invite', title: 'Bol/a si pridaný/á ako koordinátor', body: `Koordinátor pre: ${clubName}`, data: { club_id: clubId, action: 'coordinator_invite' } });
    closeCoordInvite();
    Alert.alert('Koordinátor pridaný', profileName);
  }

  async function shareCoordFromAttendees() {
    if (!attendeesEvent || !user) return;
    const clubId = attendeesEvent.club_id;
    if (!clubId) return;
    const clubName = clubs.find(c => c.id === clubId)?.name ?? '';
    try {
      const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const { data } = await supabase.from('pending_invites').insert({
        club_id: clubId,
        role: 'coordinator',
        event_id: null,
        invited_by: user.id,
        club_name: clubName,
        inviter_name: myProfile?.name ?? '',
      }).select('token').single();
      if (!data?.token) throw new Error('no token');
      const url = `https://woeva.com/invite?token=${data.token}`;
      await Share.share({
        message: lang === 'sk'
          ? `${myProfile?.name ?? 'Niekto'} ťa pozýva ako koordinátora pre klub "${clubName}" vo Woeva. Prijmi pozvánku: ${url}`
          : `${myProfile?.name ?? 'Someone'} invited you as a coordinator for "${clubName}" on Woeva: ${url}`,
        url,
      });
    } catch {
      Alert.alert(lang === 'sk' ? 'Chyba' : 'Error', lang === 'sk' ? 'Nepodarilo sa vytvoriť pozvánku.' : 'Failed to create invite.');
    }
  }

  async function searchInvite(q: string) {
    setInviteQuery(q);
    if (q.trim().length < 2) { setInviteResults([]); return; }
    const term = q.trim();
    const { data } = await supabase.from('profiles').select('id, name, avatar_url')
      .ilike('name', `%${term}%`)
      .neq('id', user!.id)
      .limit(8);
    // exclude already-admins
    const existingIds = new Set(clubAdmins.map(a => a.user_id));
    setInviteResults(((data ?? []) as any[]).filter(r => !existingIds.has(r.id)));
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
            // Insert as pending - they must accept
            await supabase.from('club_members').upsert({
              club_id: targetClub.id, user_id: profileId, role: 'admin', status: 'pending',
            }, { onConflict: 'club_id,user_id' });
            await supabase.from('notifications').insert({
              user_id: profileId, type: 'admin_invite',
              title: `Pozvánka: ${targetClub.name}`,
              body: `Bol/a si pozvaný/á spravovať klub ${targetClub.name}. Klepni pre prijatie alebo odmietnutie.`,
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
    setStatusBarStyle('dark');
    load();
    if (user) {
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('read', false)
        .then(({ count }) => setUnreadNotifs(count ?? 0));
    }
  }, [user]));

  // When arriving via tab=payouts with no billing, auto-open billing sheet after data loads
  // Also skip intro if billing is already set up
  React.useEffect(() => {
    if (!loading) {
      if (billing) setShowPayoutsSetup(true);
      else if (tabParam === 'payouts') setTimeout(() => setShowBillingModal(true), 500);
      // Auto-open attendees for coordinator invite flow
      if (openEventParam) {
        const ev = events.find(e => e.id === openEventParam || e.id.startsWith(openEventParam));
        if (ev) setTimeout(() => openAttendees(ev), 400);
      }
      // Auto-select club from param (admin invite flow)
      if (selectClubParam) {
        if (clubs.find(c => c.id === selectClubParam)) {
          setSelectedClubId(selectClubParam);
        } else {
          // Club not loaded yet (race condition after invite acceptance) — retry
          setTimeout(() => load(), 1000);
        }
      }
    }
  }, [loading]);

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
      .from('clubs').select('id, name, cover_url, logo_url, creator_id, member_count')
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

    // Fetch coordinator assignments for this user
    const { data: coordData } = await supabase
      .from('coordinators')
      .select('id, club_id, event_id, club:clubs(name), event:events(title, date)')
      .eq('user_id', user.id).eq('status', 'active');
    const coordList = ((coordData ?? []) as any[]).map(c => ({
      id: c.id, club_id: c.club_id, event_id: c.event_id ?? null,
      club_name: c.club?.name ?? '', event_title: c.event?.title ?? null,
    }));
    setMyCoordinations(coordList);

    // Load coordinator events (always, regardless of clubs)
    if (coordList.length > 0) {
      const specificIds = coordList.filter(c => c.event_id).map(c => c.event_id as string);
      const coordClubIds = [...new Set(coordList.map(c => c.club_id))];
      const today = new Date().toISOString().split('T')[0];
      let coordEvs: any[] = [];
      if (specificIds.length > 0) {
        const { data: ev } = await supabase.from('events').select('id, title, date, time, going_count, cover_url, cover_urls, club_id, creator_id, price, is_free, status, capacity, is_recurring').in('id', specificIds).neq('status', 'cancelled');
        coordEvs = [...(ev ?? [])];
      }
      if (coordClubIds.length > 0) {
        const { data: clEv } = await supabase.from('events').select('id, title, date, time, going_count, cover_url, cover_urls, club_id, creator_id, price, is_free, status, capacity, is_recurring').in('club_id', coordClubIds).gte('date', today).neq('status', 'cancelled').order('date', { ascending: true });
        for (const e of (clEv ?? [])) { if (!coordEvs.find(x => x.id === e.id)) coordEvs.push(e); }
      }
      if (coordEvs.length > 0) {
        const [{ data: ciData }, { data: attData }] = await Promise.all([
          supabase.from('check_ins').select('event_id, user_id').in('event_id', coordEvs.map(e => e.id)),
          supabase.from('event_attendees').select('event_id').in('event_id', coordEvs.map(e => e.id)),
        ]);
        const initCI: Record<string, Set<string>> = {};
        (ciData ?? []).forEach((ci: any) => { if (!initCI[ci.event_id]) initCI[ci.event_id] = new Set(); initCI[ci.event_id].add(ci.user_id); });
        setCheckedIn(prev => ({ ...prev, ...initCI }));
        // Count real attendees per event
        const attCounts: Record<string, number> = {};
        (attData ?? []).forEach((a: any) => { attCounts[a.event_id] = (attCounts[a.event_id] ?? 0) + 1; });
        setCoordEvents(coordEvs.map(e => ({ ...e, paid_count: Math.max(attCounts[e.id] ?? 0, e.going_count ?? 0), going_count: Math.max(attCounts[e.id] ?? 0, e.going_count ?? 0), online_count: 0, door_count: 0, scan_count: 0, net_revenue: 0, platform_fee: 0, gross_revenue: 0 })) as EventRow[]);
      } else {
        setCoordEvents(coordEvs.map(e => ({ ...e, paid_count: e.going_count ?? 0, online_count: 0, door_count: 0, scan_count: 0, net_revenue: 0, platform_fee: 0, gross_revenue: 0 })) as EventRow[]);
      }
    }

    const clubIds = allClubs.map(c => c.id);

    const [
      { data: eventsData },
      { data: billingData },
      { data: stripeData },
    ] = await Promise.all([
      clubIds.length > 0
        ? supabase.from('events')
            .select('id, title, date, time, going_count, cover_url, cover_urls, club_id, creator_id, price, is_free, status, is_recurring, recurring_end_date, capacity')
            .or(`and(creator_id.eq.${user.id},club_id.is.null),club_id.in.(${clubIds.join(',')})`)
            .order('date', { ascending: false })
        : supabase.from('events')
            .select('id, title, date, time, going_count, cover_url, cover_urls, club_id, creator_id, price, is_free, status, is_recurring, recurring_end_date, capacity')
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
    if (stripeData) setShowPayoutsSetup(true);

    // Auto-sync Stripe status if account exists but not yet marked complete
    if (stripeData?.stripe_account_id && !stripeData.onboarding_complete) {
      supabase.functions.invoke('check-connect-status', {}).then(res => {
        if (res.data?.connected) {
          supabase.from('stripe_accounts')
            .select('stripe_account_id, onboarding_complete, payouts_enabled')
            .eq('user_id', user.id).maybeSingle()
            .then(({ data }) => { if (data) setStripeAccount(data); });
        }
      });
    }

    const firstClubId = allClubs[0]?.id;
    if (firstClubId) await loadMembers(firstClubId);

    const BOT_ID = '00000000-0000-0000-0000-000000000001';
    if (eventsData && eventsData.length > 0) {
      const { data: allAtts } = await supabase
        .from('event_attendees').select('event_id, user_id, payment_intent_id, paid, occurrence_date')
        .in('event_id', eventsData.map(e => e.id));

      const onlineCounts: Record<string, number> = {};
      const doorCounts: Record<string, number> = {};
      const totalCounts: Record<string, number> = {};
      const newOccurrenceCounts: Record<string, number> = {};
      (allAtts ?? []).forEach((a: any) => {
        if (a.user_id === BOT_ID) return;
        totalCounts[a.event_id] = (totalCounts[a.event_id] ?? 0) + 1;
        // Per-occurrence count for recurring events
        const occKey = a.occurrence_date ? `${a.event_id}_${a.occurrence_date}` : a.event_id;
        newOccurrenceCounts[occKey] = (newOccurrenceCounts[occKey] ?? 0) + 1;
        if (a.paid) {
          if (a.payment_intent_id) {
            onlineCounts[a.event_id] = (onlineCounts[a.event_id] ?? 0) + 1;
          } else {
            doorCounts[a.event_id] = (doorCounts[a.event_id] ?? 0) + 1;
          }
        }
      });
      setOccurrenceCounts(newOccurrenceCounts);

      const { data: checkInsData } = await supabase
        .from('check_ins').select('event_id, user_id')
        .in('event_id', eventsData.map(e => e.id));
      const scanCounts: Record<string, number> = {};
      (checkInsData ?? []).forEach((ci: any) => {
        scanCounts[ci.event_id] = (scanCounts[ci.event_id] ?? 0) + 1;
      });
      const initCheckedIn: Record<string, Set<string>> = {};
      (checkInsData ?? []).forEach((ci: any) => {
        if (!initCheckedIn[ci.event_id]) initCheckedIn[ci.event_id] = new Set();
        initCheckedIn[ci.event_id].add(ci.user_id);
      });
      setCheckedIn(prev => ({ ...prev, ...initCheckedIn }));

      setEvents(eventsData.map(e => {
        const isFree = e.is_free || (e.price ?? 0) === 0;
        const oc = isFree ? 0 : (onlineCounts[e.id] ?? 0);
        const dc = isFree ? 0 : (doorCounts[e.id] ?? 0);
        const tc = totalCounts[e.id] ?? 0;
        return { ...e, going_count: isFree ? tc : e.going_count, paid_count: oc + dc, online_count: oc, door_count: dc, scan_count: scanCounts[e.id] ?? 0, ...calcRevenue(e.price ?? 0, oc, dc) };
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
      const res = await supabase.functions.invoke('create-connect-account', {
        body: { return_url: 'https://woeva.com/stripe-success' },
      });

      if (res.error) {
        // Try to extract actual error body from the response context
        const ctx = (res.error as any)?.context;
        const detail = ctx?.error ?? ctx?.message ?? res.error.message ?? t.dashboard.stripeError;
        Alert.alert(t.common.error, detail);
        setConnectingStripe(false);
        return;
      }

      if (res.data?.already_connected) {
        setStripeAccount(s => s ? { ...s, onboarding_complete: true } : s);
        Alert.alert(t.dashboard.alreadyConnected, t.dashboard.alreadyConnectedMsg);
        setConnectingStripe(false);
        return;
      }

      if (res.data?.error) {
        Alert.alert(t.common.error, res.data.error);
        setConnectingStripe(false);
        return;
      }

      if (res.data?.url) {
        await WebBrowser.openBrowserAsync(res.data.url);
        await checkStripeStatus();
      } else {
        Alert.alert(t.common.error, t.dashboard.stripeError);
      }
    } catch (e: any) {
      Alert.alert(t.common.error, e?.message ?? t.dashboard.stripeError);
    }
    setConnectingStripe(false);
  }

  async function checkStripeStatus() {
    setCheckingStatus(true);
    const res = await supabase.functions.invoke('check-connect-status', {});
    if (res.data?.connected) {
      // Reload from DB so state reflects what the edge function just wrote
      const { data } = await supabase.from('stripe_accounts')
        .select('stripe_account_id, onboarding_complete, payouts_enabled')
        .eq('user_id', user!.id).maybeSingle();
      if (data) setStripeAccount(data);
      if (res.data.payouts) setPayouts(res.data.payouts);
    }
    setCheckingStatus(false);
  }

  async function openAttendees(event: EventRow) {
    attendeesSheetY.setValue(SHEET_INIT);
    setAttendeesEvent(event);
    sheetOpen(attendeesSheetY);
    setLoadingAttendees(true);
    // For recurring events the id is synthetic: "realUUID_YYYY-MM-DD"
    // UUIDs contain only hyphens, so the first underscore separates uuid from date
    const underIdx = event.id.indexOf('_');
    const realId = underIdx > 0 ? event.id.slice(0, underIdx) : event.id;
    const occurrenceDate = underIdx > 0 ? event.id.slice(underIdx + 1) : null;

    let attQuery = supabase.from('event_attendees').select('user_id').eq('event_id', realId);
    if (occurrenceDate) {
      attQuery = (attQuery as any).or(`occurrence_date.eq.${occurrenceDate},occurrence_date.is.null`);
    }

    const [{ data: attData }, { data: ciData }] = await Promise.all([
      attQuery,
      supabase.from('check_ins').select('user_id').eq('event_id', realId),
    ]);
    const userIds = (attData ?? []).map((a: any) => a.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles').select('id, name, avatar_url').in('id', userIds);
      setAttendees((profileData ?? []) as any);
    } else {
      setAttendees([]);
    }
    // Merge DB check-ins into local state
    const dbCheckedIn = new Set((ciData ?? []).map((c: any) => c.user_id));
    setCheckedIn(prev => {
      const existing = new Set(prev[event.id] ?? []);
      dbCheckedIn.forEach(id => existing.add(id));
      return { ...prev, [event.id]: existing };
    });
    setLoadingAttendees(false);
  }

  async function exportAttendeesPdf() {
    if (!attendeesEvent) return;
    const sorted = [...attendees].sort((a, b) => a.name.localeCompare(b.name));
    const checkedInSet = checkedIn[attendeesEvent.id] ?? new Set();
    const dateStr = new Date(attendeesEvent.date + 'T00:00:00').toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const rows = sorted.map((att, i) => {
      const confirmed = checkedInSet.has(att.id);
      return `<tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:10px 8px;color:#888;font-size:13px;width:36px;">${i + 1}</td>
        <td style="padding:10px 8px;font-size:14px;font-weight:600;color:#0a0a0a;">${att.name.split(' ')[0]}</td>
        <td style="padding:10px 8px;text-align:right;">
          <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;${confirmed ? 'background:#e8faf0;color:#16a34a;' : 'background:#f5f5f5;color:#888;'}">
            ${confirmed ? (lang === 'sk' ? 'Potvrdený' : 'Confirmed') : (lang === 'sk' ? 'Nepotvrdený' : 'Not confirmed')}
          </span>
        </td>
      </tr>`;
    }).join('');

    const confirmedCount = sorted.filter(a => checkedInSet.has(a.id)).length;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #0a0a0a; }
        h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
        .sub { color: #888; font-size: 13px; margin-bottom: 24px; }
        .stats { display: flex; gap: 24px; margin-bottom: 24px; padding: 16px; background: #f8f8f8; border-radius: 12px; }
        .stat { display: flex; flex-direction: column; }
        .stat-val { font-size: 20px; font-weight: 800; }
        .stat-lbl { font-size: 11px; color: #888; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; }
        thead th { text-align: left; font-size: 11px; color: #888; padding: 8px; border-bottom: 2px solid #eee; text-transform: uppercase; letter-spacing: 0.5px; }
        .footer { margin-top: 32px; font-size: 11px; color: #bbb; text-align: center; }
      </style></head><body>
      <h1>${attendeesEvent.title}</h1>
      <p class="sub">${dateStr}${attendeesEvent.time ? ' · ' + attendeesEvent.time.slice(0, 5) : ''}</p>
      <div class="stats">
        <div class="stat"><span class="stat-val">${sorted.length}</span><span class="stat-lbl">${lang === 'sk' ? 'Celkom' : 'Total'}</span></div>
        <div class="stat"><span class="stat-val" style="color:#16a34a;">${confirmedCount}</span><span class="stat-lbl">${lang === 'sk' ? 'Potvrdených' : 'Confirmed'}</span></div>
        <div class="stat"><span class="stat-val" style="color:#888;">${sorted.length - confirmedCount}</span><span class="stat-lbl">${lang === 'sk' ? 'Nepotvrdených' : 'Pending'}</span></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>${lang === 'sk' ? 'Meno' : 'Name'}</th><th style="text-align:right;">${lang === 'sk' ? 'Príchod' : 'Attendance'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="footer">Woeva · ${new Date().toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US')}</p>
    </body></html>`;

    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `${attendeesEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_ucastnici.pdf`;
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Chyba', 'Nepodarilo sa exportovať PDF.');
    }
  }

  async function handleQrScan({ data: qrData }: { data: string }) {
    if (scanProcessing) return;
    setScanProcessing(true);
    try {
      const parts = qrData.split(':');
      if (parts.length < 4 || parts[0] !== 'woeva' || parts[1] !== 'event') {
        setScannedTicket({ eventTitle: 'Neplatný QR kód', userName: '', avatar_url: null, valid: false, eventId: '', userId: '' });
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
        userName: profile?.name?.split(' ')[0] ?? 'Unknown',
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

  async function downloadInvoiceForMonth(monthKey: string, monthLabel: string, monthEvents: EventRow[]) {
    if (!billing) return;
    const [year, month] = monthKey.split('-').map(Number);
    const invoiceNum = `W-${year}-${String(month).padStart(2, '0')}`;
    const invoiceEvents = monthEvents.map(e => ({
      title: e.title,
      date: e.date,
      paid_count: e.paid_count,
      gross: e.onlineGross,
      stripe_fee: e.stripe_fee,
      woeva_fee: e.woeva_fee,
      net: e.onlineNet,
    }));
    const html = generateCreatorInvoice(billing, invoiceEvents, monthLabel, invoiceNum);
    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${invoiceNum}` });
    } catch {
      Alert.alert(t.dashboard.pdfUnavailable, 'Install expo-print and expo-sharing to download invoices:\nnpx expo install expo-print expo-sharing');
    }
  }

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

  // ── Derived data ─────────────────────────────────────────────────────────────
  const now = new Date();
  const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now.getFullYear(), now.getMonth(), 1); // začiatok aktuálneho mesiaca
  const d365 = new Date(now); d365.setFullYear(d365.getFullYear() - 1);
  const new7d = members.filter(m => new Date(m.created_at) >= d7).length;
  const new30d = members.filter(m => new Date(m.created_at) >= d30).length;
  const new1y = members.filter(m => new Date(m.created_at) >= d365).length;

  const selectedClub = clubs.find(c => c.id === selectedClubId) ?? null;
  const viewEvents = selectedClubId === '__individual__'
    ? events.filter(e => !e.club_id)
    : selectedClubId
      ? events.filter(e => e.club_id === selectedClubId)
      : events;

  const totalGross = viewEvents.reduce((s, e) => s + e.gross, 0);
  const totalOnlineNet = viewEvents.reduce((s, e) => s + e.onlineNet, 0);
  const totalDoorGross = viewEvents.reduce((s, e) => s + e.doorGross, 0);
  const totalNet = viewEvents.reduce((s, e) => s + e.net, 0);
  const weekGross = viewEvents.filter(e => new Date(e.date) >= d7).reduce((s, e) => s + e.gross, 0);
  const monthGross = viewEvents.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.gross, 0);
  const monthOnlineNet = viewEvents.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.onlineNet, 0);
  const weekNet = viewEvents.filter(e => new Date(e.date) >= d7).reduce((s, e) => s + e.net, 0);
  const monthNet = viewEvents.filter(e => new Date(e.date) >= d30).reduce((s, e) => s + e.net, 0);

  const monthlyEarnings = useMemo(() => {
    const map: Record<string, { key: string; label: string; gross: number; net: number; events: EventRow[] }> = {};
    viewEvents.filter(e => !e.is_free && e.onlineGross > 0).forEach(e => {
      const d = new Date(e.date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) { const raw = d.toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { month: 'long', year: 'numeric' }); map[key] = { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), gross: 0, net: 0, events: [] }; }
      map[key].gross += e.onlineGross;
      map[key].net += e.onlineNet;
      map[key].events.push(e);
    });
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
  }, [viewEvents, lang]);

  const rawUpcoming = viewEvents.filter(e => isUpcoming(e) && e.status !== 'cancelled');
  const upcomingEvents = expandDashboardRows(rawUpcoming, occurrenceCounts);
  const pastEvents = viewEvents.filter(e => !isUpcoming(e) && e.status !== 'cancelled');
  const cancelledEvents = viewEvents.filter(e => e.status === 'cancelled');
  const displayedEvents = eventsFilter === 'upcoming' ? upcomingEvents : eventsFilter === 'past' ? pastEvents : cancelledEvents;

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={[s.topBar, { paddingHorizontal: 20 }]}><BackButton /><Text style={s.pageTitle}>{t.dashboard.dashboard}</Text><View style={{ width: 36 }} /></View>
        <ActivityIndicator style={{ marginTop: 80 }} color={Colors.black} />
      </View>
    );
  }

  // ── Coordinator mode: coordinator tab OR scan from coordinator ──
  if ((activeTab === 'coordinator' || (activeTab === 'scan' && scanOriginRef.current === 'coordinator')) && myCoordinations.length > 0) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.topBar}>
          {activeTab === 'scan'
            ? <TouchableOpacity onPress={() => { setScannedTicket(null); setActiveTab(scanOriginRef.current); }} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 12H5M12 5l-7 7 7 7" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            : <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/' as any)} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 12H5M12 5l-7 7 7 7" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>}
          <Text style={s.pageTitle}>Koordinátor</Text>
          <View style={{ width: 36 }} />
        </View>

        {activeTab !== 'scan' && (
          <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={Colors.black} />}>
            {coordEvents.length === 0
              ? <Text style={s.emptySub}>Zatiaľ žiadne eventy na koordináciu.</Text>
              : coordEvents.sort((a, b) => b.date.localeCompare(a.date)).reverse().sort((a, b) => {
                  // Upcoming first, then past
                  const today = new Date().toISOString().slice(0, 10);
                  const aUp = a.date >= today ? 0 : 1;
                  const bUp = b.date >= today ? 0 : 1;
                  if (aUp !== bUp) return aUp - bUp;
                  return a.date.localeCompare(b.date);
                }).map(e => {
                  const scanCount = checkedIn[e.id]?.size ?? 0;
                  const goingCount = Math.max(e.going_count ?? 0, e.paid_count ?? 0);
                  const dateFmt = new Date(e.date + 'T00:00:00').toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <View key={e.id} style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.grayBorder }}>
                      {/* Top: cover + info + share icon */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.grayLight }} onPress={() => router.push(`/event/${e.id}` as any)} activeOpacity={0.7}>
                          {(e.cover_url || ((e as any).cover_urls?.[0])) && <Image source={{ uri: e.cover_url ?? (e as any).cover_urls[0] }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />}
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => openAttendees(e)} activeOpacity={0.7}>
                          <Text style={[s.listName, { fontSize: 16 }]} numberOfLines={1}>{e.title}</Text>
                          <Text style={s.listSub}>{dateFmt}{e.time ? ` · ${e.time.slice(0, 5)}` : ''}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                            <Text style={{ fontSize: 12, color: Colors.gray, fontFamily: Fonts.medium }}>{goingCount} {goingLabel(goingCount, lang)}</Text>
                            <Text style={{ fontSize: 12, color: scanCount > 0 ? '#22C55E' : Colors.gray, fontWeight: '600', fontFamily: Fonts.semibold }}>✓ {scanCount}/{goingCount}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { Share.share({ message: `https://woeva.com/share-event?id=${e.id}` }); }} hitSlop={8} activeOpacity={0.7} style={{ padding: 6 }}>
                          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </TouchableOpacity>
                      </View>
                      {/* Bottom: scan + attendees */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.black, borderRadius: 10, paddingVertical: 9 }}
                          onPress={() => { scanOriginRef.current = 'coordinator'; setActiveTab('scan'); }} activeOpacity={0.7}
                        >
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold }}>Skenovať</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.grayLight, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 }}
                          onPress={() => openAttendees(e)} activeOpacity={0.7}
                        >
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            <Circle cx={9} cy={7} r={4} stroke={Colors.black} strokeWidth={2} />
                          </Svg>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
            }
          </ScrollView>
        )}

        {/* Scan tab - same as admin */}
        {activeTab === 'scan' && (
          <View style={[StyleSheet.absoluteFill, s.scanContainer, { top: insets.top + 60, bottom: 80 + insets.bottom }]}>
            {!cameraPermission?.granted ? (
              <View style={s.scanPermBox}>
                <Text style={s.scanPermText}>{t.dashboard.cameraPermissionNeeded}</Text>
                <TouchableOpacity style={s.scanPermBtn} onPress={requestCameraPermission} activeOpacity={0.8}>
                  <Text style={s.scanPermBtnText}>{t.dashboard.allowCamera}</Text>
                </TouchableOpacity>
              </View>
            ) : SafeCameraView ? (
              <SafeCameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={scannedTicket ? undefined : async (result: any) => {
                  const raw: string = result.data ?? result.value ?? '';
                  if (!raw.startsWith('woeva:')) return;
                  const parts = raw.split(':');
                  const type = parts[1];
                  if (type === 'ticket') {
                    const ticketId = parts[2];
                    const { data: ticket } = await supabase.from('tickets').select('id, event_id, user_id, profile:profiles(name, avatar_url), event:events(title)').eq('id', ticketId).maybeSingle();
                    if (!ticket) { setScannedTicket({ eventTitle: '?', userName: t.dashboard.unknownTicket, avatar_url: null, valid: false, eventId: '', userId: '' }); return; }
                    setScannedTicket({ eventTitle: (ticket as any).event?.title ?? '?', userName: (ticket as any).profile?.name ?? '?', avatar_url: (ticket as any).profile?.avatar_url ?? null, valid: true, eventId: ticket.event_id, userId: ticket.user_id });
                    markCheckedIn(ticket.event_id, ticket.user_id);
                    setTimeout(() => setScannedTicket(null), 1200);
                  } else if (type === 'event') {
                    const eventId = parts[2]; const userId = parts[3];
                    const { data: ev } = await supabase.from('events').select('title').eq('id', eventId).maybeSingle();
                    const { data: prof } = await supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle();
                    const isValid = !!ev;
                    setScannedTicket({ eventTitle: ev?.title ?? '?', userName: prof?.name ?? '?', avatar_url: (prof as any)?.avatar_url ?? null, valid: isValid, eventId, userId });
                    if (isValid) { markCheckedIn(eventId, userId); setTimeout(() => setScannedTicket(null), 1200); }
                  }
                }}
              />
            ) : null}
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
                  <TouchableOpacity onPress={() => setScannedTicket(null)} style={s.scanResultClose}><Text style={{ fontSize: 20, color: Colors.gray }}>✕</Text></TouchableOpacity>
                </View>
                {scannedTicket.valid && (
                  <TouchableOpacity
                    style={[s.scanCheckInBtn, checkedIn[scannedTicket.eventId]?.has(scannedTicket.userId) && s.scanCheckInBtnDone]}
                    onPress={() => {
                      if (checkedIn[scannedTicket!.eventId]?.has(scannedTicket!.userId)) { setScannedTicket(null); return; }
                      markCheckedIn(scannedTicket!.eventId, scannedTicket!.userId);
                      setTimeout(() => setScannedTicket(null), 1200);
                    }} activeOpacity={0.8}>
                    <Text style={s.scanCheckInBtnText}>
                      {checkedIn[scannedTicket.eventId]?.has(scannedTicket.userId) ? t.dashboard.checkedIn : t.dashboard.confirmArrival}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Bottom nav - coordinator: centered Home + Eventy + Scan */}
        <View style={[s.bottomNavWrapper, { paddingBottom: insets.bottom + 8 }]}>
          <View style={[s.bottomNavPill, { justifyContent: 'center', gap: 32 }]}>
            <TouchableOpacity style={s.bottomNavItem} onPress={() => router.push('/(tabs)' as any)} activeOpacity={0.7}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" stroke="rgba(0,0,0,0.35)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={s.bottomNavLabel}>{t.dashboard.homeTab}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.bottomNavItem} onPress={() => setActiveTab('home')} activeOpacity={0.7}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M3 6h18M3 12h18M3 18h18" stroke={activeTab === 'home' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={activeTab === 'home' ? 2.5 : 1.8} strokeLinecap="round" />
              </Svg>
              <Text style={[s.bottomNavLabel, activeTab === 'home' && s.bottomNavLabelActive]}>Eventy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.bottomNavItem} onPress={() => { scanOriginRef.current = 'coordinator'; setActiveTab('scan'); }} activeOpacity={0.7}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="3" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={2} />
                <Rect x="15" y="3" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={2} />
                <Rect x="3" y="15" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={2} />
                <Path d="M15 17h3M17 15v3" stroke={activeTab === 'scan' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={[s.bottomNavLabel, activeTab === 'scan' && s.bottomNavLabelActive]}>Skenovať</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Attendees modal - coordinator version (no invite coordinator button) */}
        <Modal visible={!!attendeesEvent} transparent animationType="none" onRequestClose={closeAttendees}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={closeAttendees} />
            <RNAnimated.View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: attendeesSheetY }] }]} {...attendeesPan.panHandlers}>
              <View {...attendeesHandlePan.panHandlers} style={{ paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}><View style={s.billingSheetHandle} /></View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={s.billingSheetTitle}>{attendeesEvent?.title}</Text>
                  <Text style={s.listSub}>{(() => { const n = attendeesEvent ? Math.max(attendeesEvent.going_count ?? 0, attendeesEvent.paid_count ?? 0, attendees.length) : 0; return `${n} ${goingLabel(n, lang)}`; })()}</Text>
                </View>
              </View>
              {/* Scan QR button — coordinator only */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.black, borderRadius: 14, paddingVertical: 12, marginTop: 12 }}
                onPress={() => { closeAttendees(); setTimeout(() => { scanOriginRef.current = 'coordinator'; setActiveTab('scan'); }, 350); }}
                activeOpacity={0.7}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M8 7h2v2H8zM14 7h2v2h-2zM8 13h2v2H8zM14 13h2v2h-2z" fill={Colors.white} />
                </Svg>
                <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white }}>Skenovať QR</Text>
              </TouchableOpacity>

              {loadingAttendees
                ? <ActivityIndicator color={Colors.black} style={{ marginTop: 24 }} />
                : <>
                    <Text style={{ fontSize: 13, fontFamily: Fonts.medium, color: Colors.gray, marginTop: 12, marginBottom: 2, marginLeft: 2 }}>Účastníci</Text>
                    <FlatList
                      data={[...attendees].sort((a, b) => (b.id === user?.id ? 1 : 0) - (a.id === user?.id ? 1 : 0))}
                      keyExtractor={i => i.id}
                      style={{ marginTop: 4 }}
                      onScroll={e => { attendeesListOffset.current = e.nativeEvent.contentOffset.y; }}
                      scrollEventThrottle={16}
                      renderItem={({ item, index }) => {
                        const isIn = checkedIn[attendeesEvent?.id ?? '']?.has(item.id);
                        const isMe = item.id === user?.id;
                        return (
                          <View style={s.attendeeRow}>
                            <Text style={s.attendeeIndex}>{index + 1}</Text>
                            <View style={s.attendeeAvatar}>
                              {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                              {!item.avatar_url && <Text style={s.attendeeInitial}>{(item.name || '?').charAt(0).toUpperCase()}</Text>}
                            </View>
                            <Text style={[s.attendeeName, { flex: 1 }]}>{(item.name || '').split(' ')[0]}</Text>
                            {isMe
                              ? <View style={s.meBadge}><Text style={s.meBadgeText}>ja</Text></View>
                              : isIn
                                ? <TouchableOpacity style={s.checkedInBadge} activeOpacity={0.7} onPress={() => { Alert.alert(t.dashboard.checkedIn, t.dashboard.undoCheckInConfirm ?? 'Zrušiť?', [{ text: 'Vrátiť sa', style: 'cancel' }, { text: 'Zrušiť', style: 'destructive', onPress: () => unmarkCheckedIn(attendeesEvent!.id, item.id) }]); }}>
                                    <Text style={s.checkedInBadgeText}>{t.dashboard.checkedIn}</Text>
                                  </TouchableOpacity>
                                : <TouchableOpacity style={s.checkInBtn} onPress={() => markCheckedIn(attendeesEvent!.id, item.id)} activeOpacity={0.7}>
                                    <Text style={s.checkInBtnText}>{t.dashboard.checkIn}</Text>
                                  </TouchableOpacity>
                            }
                          </View>
                        );
                      }}
                      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.grayBorder }} />}
                      ListEmptyComponent={<Text style={[s.emptySub, { marginTop: 24 }]}>{t.dashboard.noAttendeesYet}</Text>}
                    />
                  </>
              }
            </RNAnimated.View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Billing Form Modal ──────────────────────────────────────────────── */}
      <Modal visible={showBillingModal} animationType="slide" transparent onRequestClose={() => setShowBillingModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <ScrollView style={s.billingSheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
              <View style={s.billingSheetHandle} />
              <Text style={s.billingSheetTitle}>{t.dashboard.billingDetails}</Text>
              <Text style={s.billingSheetSub}>{t.dashboard.billingDetailsSub}</Text>

              <View style={s.billingForm}>
                <Input label={t.dashboard.companyName} value={bCompany} onChangeText={v => setBCompany(sanitize(v))} placeholder="Moja spoločnosť s.r.o." />
                <Input label={t.dashboard.companyId} value={bIco} onChangeText={v => setBIco(sanitize(v))} placeholder="12345678" />
                <Input label={t.dashboard.taxId} value={bDic} onChangeText={v => setBDic(sanitize(v))} placeholder="SK2012345678" />
                <Input label={t.dashboard.streetAddress} value={bAddress} onChangeText={v => setBAddress(sanitize(v))} placeholder="Hlavná 1, Bratislava" />
                <View style={s.billingRow}>
                  <View style={{ flex: 1 }}>
                    <Input label={t.dashboard.cityLabel} value={bCity} onChangeText={v => setBCity(sanitize(v))} placeholder="Bratislava" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label={t.dashboard.country} value={bCountry} onChangeText={v => setBCountry(sanitize(v))} placeholder="Slovensko" />
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <ScrollView
        key={activeTab}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.black} />}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          {activeTab === 'scan'
            ? <TouchableOpacity onPress={() => { setScannedTicket(null); setActiveTab('home'); }} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 12H5M12 5l-7 7 7 7" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            : <BackButton />
          }
          <Text style={s.pageTitle} pointerEvents="none">{activeTab === 'scan' ? t.dashboard.scanQR : t.dashboard.dashboard}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {clubs.length > 0 && activeTab !== 'scan' && (
              <TouchableOpacity style={s.bellBtn} onPress={() => {
                const club = selectedClub ?? clubs[0];
                if (!club) return;
                if (!selectedClubId || selectedClubId === '__individual__') {
                  const clubIdx = clubs.findIndex(c => c.id === club.id);
                  const cw = screenWidth - 72;
                  isScrollingProgrammatically.current = true;
                  carouselRef.current?.scrollTo({ x: (clubIdx + 1) * (cw + 12), animated: true });
                  const pillX = pillLayoutsRef.current[clubIdx + 1] ?? 0;
                  pillsScrollRef.current?.scrollTo({ x: Math.max(0, pillX - 20), animated: true });
                  setSelectedClubId(club.id);
                  setTimeout(() => {
                    isScrollingProgrammatically.current = false;
                    router.push(`/club/${club.id}/settings` as any);
                  }, 400);
                } else {
                  router.push(`/club/${club.id}/settings` as any);
                }
              }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={Colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Club switcher - only on relevant tabs, only if user has clubs */}
        {(activeTab === 'home' || activeTab === 'stats') && clubs.length > 0 && (
          <ScrollView
            ref={pillsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.viewFilter}
            style={{ marginHorizontal: -20, marginBottom: 20 }}
            contentInset={{ left: 20, right: 20 }}
            contentOffset={{ x: -20, y: 0 }}
          >
            <TouchableOpacity
              style={[s.viewFilterChip, !selectedClubId && s.viewFilterChipActive]}
              onLayout={e => { pillLayoutsRef.current[0] = e.nativeEvent.layout.x; }}
              onPress={() => { setSelectedClubId(null); const cw = screenWidth - 72; carouselRef.current?.scrollTo({ x: 0, animated: true }); }} activeOpacity={0.7}>
              <Text style={[s.viewFilterText, !selectedClubId && s.viewFilterTextActive]}>{t.home.all}</Text>
            </TouchableOpacity>
            {clubs.map((c, ci) => (
              <TouchableOpacity key={c.id}
                style={[s.viewFilterChip, selectedClubId === c.id && s.viewFilterChipActive]}
                onLayout={e => { pillLayoutsRef.current[ci + 1] = e.nativeEvent.layout.x; }}
                onPress={() => { setSelectedClubId(c.id); const cw = screenWidth - 72; carouselRef.current?.scrollTo({ x: (ci + 1) * (cw + 12), animated: true }); }} activeOpacity={0.7}>
                <Text style={[s.viewFilterText, selectedClubId === c.id && s.viewFilterTextActive]} numberOfLines={1}>{c.creator_id !== user?.id ? `${c.name} (správca)` : c.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.viewFilterChip, selectedClubId === '__individual__' && s.viewFilterChipActive]}
              onLayout={e => { pillLayoutsRef.current[clubs.length + 1] = e.nativeEvent.layout.x; }}
              onPress={() => { setSelectedClubId('__individual__'); const cw = screenWidth - 72; carouselRef.current?.scrollTo({ x: (clubs.length + 1) * (cw + 12), animated: true }); }} activeOpacity={0.7}>
              <Text style={[s.viewFilterText, selectedClubId === '__individual__' && s.viewFilterTextActive]}>Individual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.viewFilterAdd}
              onPress={() => router.push('/club/create')}
              activeOpacity={0.7}>
              <Text style={s.viewFilterAddText}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── HOME ──────────────────────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <>
            {/* Quick overview strip */}
            <View style={s.overviewStrip}>
              {[
                { label: t.dashboard.events, val: String(viewEvents.length) },
                { label: t.dashboard.attendees, val: String(viewEvents.reduce((sum, e) => sum + (e.is_free ? realGoing(e, user!.id) : e.paid_count), 0)) },
                { label: t.dashboard.members, val: String(clubs.reduce((sum, c) => sum + ((c as any).member_count ?? 0), 0)) },
              ].map(item => (
                <View key={item.label} style={s.overviewItem}>
                  <Text style={s.overviewVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{item.val}</Text>
                  <Text style={s.overviewLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Club cards carousel */}
            {clubs.length > 0 && (() => {
              const CARD_WIDTH = screenWidth - 72;
              const CARD_GAP = 12;
              const allItems = [
                { type: 'all' as const },
                ...clubs.map(c => ({ type: 'club' as const, data: c })),
                { type: 'individual' as const },
              ];
              return (
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_WIDTH + CARD_GAP}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 20, gap: CARD_GAP }}
                  style={{ marginHorizontal: -20, marginBottom: 24 }}
                  contentOffset={{ x: 0, y: 0 }}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    if (isScrollingProgrammatically.current) return;
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
                    const item = allItems[idx];
                    if (!item) return;
                    if (item.type === 'all') setSelectedClubId(null);
                    else if (item.type === 'individual') setSelectedClubId('__individual__');
                    else setSelectedClubId(item.data.id);
                    const pillX = pillLayoutsRef.current[idx] ?? 0;
                    pillsScrollRef.current?.scrollTo({ x: Math.max(0, pillX - 20), animated: true });
                  }}
                  onMomentumScrollEnd={() => { isScrollingProgrammatically.current = false; }}
                >
                  {/* Overview card */}
                  <View style={[s.clubCard, { width: CARD_WIDTH, backgroundColor: Colors.black, justifyContent: 'center', paddingHorizontal: 20 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, marginBottom: 6 }}>{t.dashboard.overviewLabel}</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.lime, fontFamily: Fonts.extrabold, letterSpacing: -0.5 }}>{t.dashboard.myClubsLabel}</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{t.dashboard.clubsAllStats(clubs.length)}</Text>
                  </View>

                  {/* Individual club cards */}
                  {clubs.map(c => {
                    const isOwner = c.creator_id === user?.id;
                    return (
                      <View key={c.id} style={[s.clubCard, { width: CARD_WIDTH }]}>
                        {c.cover_url
                          ? <Image source={{ uri: c.cover_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                          : c.logo_url
                            ? <View style={[StyleSheet.absoluteFill as any, { backgroundColor: '#000' }]}>
                                <Image source={{ uri: c.logo_url }} style={[StyleSheet.absoluteFill as any, { opacity: 0.35 }]} resizeMode="cover" />
                              </View>
                            : <View style={[StyleSheet.absoluteFill as any, { backgroundColor: '#000' }]} />
                        }
                        <Svg style={StyleSheet.absoluteFill as any} preserveAspectRatio="none">
                          <Defs><SvgGrad id={`g_${c.id}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#000" stopOpacity="0.05" />
                            <Stop offset="1" stopColor="#000" stopOpacity="0.82" />
                          </SvgGrad></Defs>
                          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#g_${c.id})`} />
                        </Svg>
                        <View style={s.clubCardContent}>
                          <Text style={s.clubCardLabel}>{isOwner ? t.club.myClub : t.club.adminClub}</Text>
                          <Text style={s.clubCardName}>{c.name}</Text>
                          <View style={s.clubCardActions}>
                            <TouchableOpacity style={s.clubCardActionBtn} onPress={() => router.push(`/club/${c.id}` as any)} activeOpacity={0.8}>
                              <Text style={s.clubCardActionText}>{t.club.viewClub}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.clubCardActionBtn, s.clubCardActionBtnEdit]} onPress={() => router.push(`/club/${c.id}/edit` as any)} activeOpacity={0.8}>
                              <Text style={[s.clubCardActionText, s.clubCardActionTextEdit]}>{t.common.edit}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* Individual events card */}
                  {(() => {
                    const initials = (profile?.name ?? 'Me').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                    const individualCount = events.filter(e => !e.club_id).length;
                    return (
                      <View style={[s.clubCard, { width: CARD_WIDTH, backgroundColor: '#111', justifyContent: 'center', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
                        {profile?.avatar_url
                          ? <Image source={{ uri: profile.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colors.white }} />
                          : <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.black }}>{initials}</Text>
                            </View>
                        }
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, marginBottom: 4 }}>{t.dashboard.individualLabel}</Text>
                          <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.white, fontFamily: Fonts.extrabold, letterSpacing: -0.3 }} numberOfLines={1}>{profile?.name ?? 'Me'}</Text>
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{t.dashboard.eventsCount(individualCount)}</Text>
                        </View>
                      </View>
                    );
                  })()}
                </ScrollView>
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


            {/* Event list with segment tabs */}
            <View style={s.segment}>
              {([
                { key: 'upcoming', label: t.dashboard.upcoming, count: upcomingEvents.length },
                { key: 'past', label: t.dashboard.past, count: pastEvents.length },
                { key: 'cancelled', label: t.dashboard.cancelledTab, count: cancelledEvents.length },
              ] as const).map(f => (
                <TouchableOpacity key={f.key} style={[s.segmentItem, eventsFilter === f.key && s.segmentItemActive]}
                  onPress={() => setEventsFilter(f.key)} activeOpacity={0.8}>
                  <Text style={[s.segmentText, eventsFilter === f.key && s.segmentTextActive]}>
                    {f.label}<Text style={s.segmentCount}> ({f.count})</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {displayedEvents.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>{eventsFilter === 'upcoming' ? t.dashboard.noUpcomingEvents : t.dashboard.noEvents}</Text>
                <Text style={s.emptySub}>
                  {eventsFilter === 'upcoming'
                    ? (selectedClubId ? t.dashboard.noEventsForClub(selectedClub?.name ?? '') : t.dashboard.createEventHere)
                    : eventsFilter === 'past' ? t.dashboard.pastEventsHere : t.dashboard.cancelledEventsHere}
                </Text>
                {eventsFilter === 'upcoming' && (
                  <TouchableOpacity
                    style={{ marginTop: 16, backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12 }}
                    onPress={() => router.push('/event/create/step2')}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.black }}>+ {lang === 'sk' ? 'Vytvoriť event' : 'Create Event'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={s.listCard}>
                {displayedEvents.map((e, i) => {
                  const d = new Date(e.date + 'T00:00:00');
                  const dateStr = d.toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const dateLine = e.time ? `${dateStr} · ${e.time.slice(0, 5)}` : dateStr;
                  const going = e.is_free ? realGoing(e, user!.id) : e.paid_count;
                  return (
                    <View key={e.id} style={[s.listRow, i < displayedEvents.length - 1 && s.listRowBorder]}>
                      {/* Tappable left: cover + title → navigate to event */}
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                        onPress={() => { const uid = e.id.indexOf('_') > 0 ? e.id.slice(0, e.id.indexOf('_')) : e.id; router.push(`/event/${uid}` as any); }}
                        activeOpacity={0.7}
                      >
                        {getRotatingCover(e)
                          ? <Image source={{ uri: getRotatingCover(e)! }} style={s.listAvatar} />
                          : <View style={[s.listAvatar, s.listAvatarFallback]}><Text style={s.listAvatarInitial}>{e.title.charAt(0).toUpperCase()}</Text></View>
                        }
                        <View style={{ flex: 1 }}>
                          <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                          <Text style={s.listSub}>{dateLine}{e.capacity != null ? `  ·  ${going}/${e.capacity}` : ''}</Text>
                          {going > 0 && (
                            <Text style={s.listRevenue}>
                              {lang === 'sk' ? 'Naskenované' : 'Scanned'} {e.scan_count}/{going}{(e.price ?? 0) > 0 ? `  ·  €${Number(e.price).toFixed(2)}` : ''}
                            </Text>
                          )}
                          {going === 0 && (e.price ?? 0) > 0 && <Text style={s.listRevenue}>€{Number(e.price).toFixed(2)}</Text>}
                        </View>
                      </TouchableOpacity>
                      {e.status === 'cancelled' && <View style={s.cancelledBadge}><Text style={s.cancelledBadgeText}>{t.dashboard.cancelled}</Text></View>}
                      {e.status !== 'cancelled' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <TouchableOpacity style={s.goingBadge} onPress={() => openAttendees(e)} activeOpacity={0.7}>
                            <Text style={s.goingNum}>{going}</Text>
                            <Text style={s.goingLabel}>{goingLabel(going, lang)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.shareBtn}
                            onPress={() => Share.share({ url: `https://woeva.com/share-event?id=${e.id}`, message: `https://woeva.com/share-event?id=${e.id}` })}
                            hitSlop={8}
                          >
                            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                              <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                          </TouchableOpacity>
                          {/* People icon → open attendees */}
                          <TouchableOpacity style={s.shareBtn} onPress={() => openAttendees(e)} hitSlop={8}>
                            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                              <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              <Circle cx="9" cy="7" r="4" stroke={Colors.gray} strokeWidth={2} />
                              <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── EVENTS ────────────────────────────────────────────────────────── */}

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
            <TouchableOpacity style={s.payoutsIntroBtn} onPress={() => {
              setShowPayoutsSetup(true);
              if (!billing) setTimeout(() => setShowBillingModal(true), 400);
            }} activeOpacity={0.85}>
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
                <View style={{ gap: 12, marginTop: 14 }}>
                  {/* Why connect */}
                  <Text style={s.stripeIntro}>
                    {lang === 'sk'
                      ? 'Umožni účastníkom platiť za eventy priamo v appke.'
                      : 'Let attendees pay for your events directly in the app.'}
                  </Text>

                  {/* Payment method icons */}
                  <View style={s.payMethodRow}>
                    <PayMethodIcon method="visa" />
                    <PayMethodIcon method="mc" />
                    <PayMethodIcon method="amex" />
                    <PayMethodIcon method="apple" />
                    <PayMethodIcon method="gpay" />
                  </View>

                  {/* Fee dropdown */}
                  <TouchableOpacity style={s.feeToggle} onPress={() => setShowFeeInfo(v => !v)} activeOpacity={0.7}>
                    <Text style={s.feeToggleText}>
                      {lang === 'sk' ? 'O poplatkoch (4 % + €0,50 / lístok)' : 'About fees (4% + €0.50 / ticket)'}
                    </Text>
                    <Text style={s.feeToggleArrow}>{showFeeInfo ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {showFeeInfo && (
                    <View style={s.feeBox}>
                      {(lang === 'sk' ? [
                        ['Woeva (4 % + €0,50 / lístok)', 'Servisný poplatok za každý predaný online lístok.'],
                        ['Stripe', 'Poplatok za spracovanie platby kartou, Apple Pay, Google Pay — hradí Woeva.'],
                        ['Výplaty', 'Automaticky každý pondelok na tvoj bankový účet.'],
                      ] : [
                        ['Woeva (4% + €0.50 / ticket)', 'Service fee per online ticket sold.'],
                        ['Stripe', 'Card processing fee — Visa, Mastercard, Apple Pay, Google Pay — covered by Woeva.'],
                        ['Payouts', 'Automatically every Monday to your bank account.'],
                      ]).map(([label, val]) => (
                        <View key={label} style={s.feeRow}>
                          <Text style={s.feeLabel}>{label}</Text>
                          <Text style={s.feeVal}>{val}</Text>
                        </View>
                      ))}
                      <Text style={s.feeExampleText}>
                        {lang === 'sk'
                          ? 'Príklad: lístok za €10 → poplatok €0,90'
                          : 'Example: €10 ticket → €0.90 fee'}
                      </Text>
                    </View>
                  )}

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
                  <Text style={s.stripeStatusText}>
                    {stripeAccount.payouts_enabled ? t.dashboard.payoutsActive : t.dashboard.payoutsPending}
                  </Text>
                </View>
              )}
            </View>

            {/* Weekly payouts list — FIRST */}
            {stripeAccount?.onboarding_complete && (() => {
              const now = new Date();
              const todayDay = now.getDay();
              const daysToMon = todayDay === 0 ? 6 : todayDay - 1;
              const currentMonday = new Date(now); currentMonday.setDate(now.getDate() - daysToMon); currentMonday.setHours(0,0,0,0);
              const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

              const weekMap: Record<string, { net: number; isCurrent: boolean; monDate: Date; sunDate: Date }> = {};
              viewEvents.filter(e => !e.is_free && e.onlineNet > 0).forEach(e => {
                const d = new Date(e.date + 'T00:00:00');
                const day = d.getDay();
                const offset = day === 0 ? 6 : day - 1;
                const mon = new Date(d); mon.setDate(d.getDate() - offset); mon.setHours(0,0,0,0);
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                const key = mon.toISOString().slice(0, 10);
                if (!weekMap[key]) weekMap[key] = {
                  net: 0, isCurrent: mon.getTime() === currentMonday.getTime(), monDate: mon, sunDate: sun,
                };
                weekMap[key].net += e.onlineNet;
              });

              const allWeeksUnfiltered = Object.entries(weekMap).sort(([a],[b]) => b.localeCompare(a));
              if (allWeeksUnfiltered.length === 0) return null;
              let allWeeks = payoutFilter === 'month'
                ? allWeeksUnfiltered.filter(([,w]) => w.monDate >= monthStart)
                : allWeeksUnfiltered;

              const PAGE = 5;
              const totalPages = Math.ceil(allWeeks.length / PAGE);
              const page = Math.min(payoutPage, totalPages - 1);
              const pageWeeks = allWeeks.slice(page * PAGE, page * PAGE + PAGE);
              const locale = lang === 'sk' ? 'sk-SK' : 'en-US';
              const fmtDay = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

              return (
                <>
                  <View style={s.payoutHeader}>
                    <Text style={s.sectionTitle}>{t.dashboard.payoutsTab}</Text>
                    <View style={s.payoutFilterRow}>
                      {(['all', 'month'] as const).map(f => (
                        <TouchableOpacity key={f}
                          style={[s.payoutFilterChip, payoutFilter === f && s.payoutFilterChipActive]}
                          onPress={() => { setPayoutFilter(f); setPayoutPage(0); }} activeOpacity={0.7}>
                          <Text style={[s.payoutFilterText, payoutFilter === f && s.payoutFilterTextActive]}>
                            {f === 'all' ? t.dashboard.payoutAllTime : t.dashboard.payoutThisMonth}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View>
                    {pageWeeks.map(([key, w], idx) => (
                      <View key={key} style={[s.payoutRow, idx > 0 && s.payoutRowBorder]}>
                        <View style={[s.payoutDot, w.isCurrent ? s.payoutDotPending : s.payoutDotDone]} />
                        <Text style={s.payoutRowDate} numberOfLines={1}>{fmtDay(w.monDate)} – {fmtDay(w.sunDate)}</Text>
                        <Text style={[s.payoutRowStatus, w.isCurrent ? s.payoutRowStatusPending : s.payoutRowStatusDone]}>
                          {w.isCurrent ? t.dashboard.payoutPendingLabel : t.dashboard.payoutProcessed}
                        </Text>
                        <Text style={s.payoutRowAmount}>{fmt(w.net)}</Text>
                      </View>
                    ))}
                  </View>
                  {totalPages > 1 && (
                    <View style={s.payoutPagination}>
                      <TouchableOpacity onPress={() => setPayoutPage(p => Math.max(0, p - 1))} disabled={page === 0} style={[s.payoutPageBtn, page === 0 && { opacity: 0.3 }]}>
                        <Text style={s.payoutPageBtnText}>← Prev</Text>
                      </TouchableOpacity>
                      <Text style={s.payoutPageInfo}>{page + 1} / {totalPages}</Text>
                      <TouchableOpacity onPress={() => setPayoutPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={[s.payoutPageBtn, page === totalPages - 1 && { opacity: 0.3 }]}>
                        <Text style={s.payoutPageBtnText}>Next →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={s.payoutNote}>{t.dashboard.payoutNote}</Text>
                </>
              );
            })()}

            {/* Earnings summary — SECOND */}
            {stripeAccount?.onboarding_complete && (
              <>
                <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.earnings}</Text>

                {/* Big earnings card */}
                <View style={s.earningsCard}>
                  <View style={s.earningsCardTop}>
                    <View>
                      <Text style={s.earningsCardLabel}>{t.dashboard.onlineEarnings}</Text>
                      <Text style={s.earningsCardAmount}>{fmt(totalOnlineNet)}</Text>
                    </View>
                  </View>
                  {totalDoorGross > 0 && (
                    <View style={[s.earningsCardMonth, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 10 }]}>
                      <Text style={[s.earningsCardMonthText, { color: 'rgba(255,255,255,0.5)' }]}>{lang === 'sk' ? 'Celkovo vr. na mieste' : 'Total incl. at door'}: {fmt(totalNet)} · {t.dashboard.atDoor}: {fmt(totalDoorGross)}</Text>
                    </View>
                  )}
                  {monthGross > 0 && (
                    <View style={s.earningsCardMonth}>
                      <View style={s.earningsCardMonthDot} />
                      <Text style={s.earningsCardMonthText}>{t.dashboard.thisMonthNet(fmt(monthOnlineNet))}</Text>
                    </View>
                  )}
                </View>

                {/* Invoices row */}
                <TouchableOpacity
                  style={s.invoicesRow}
                  onPress={() => router.push('/dashboard/invoices')}
                  activeOpacity={0.8}
                >
                  <View style={s.invoicesRowIcon}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text style={s.invoicesRowLabel}>{t.dashboard.invoicesLabel}</Text>
                  {monthlyEarnings.length > 0 && (
                    <View style={s.invoicesRowBadge}>
                      <Text style={s.invoicesRowBadgeText}>{monthlyEarnings.length}</Text>
                    </View>
                  )}
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto' }}>
                    <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>

                {/* Per-event breakdown */}
                {viewEvents.filter(e => (e.price ?? 0) > 0 && e.paid_count > 0).length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.perEvent}</Text>
                    <View style={s.listCard}>
                      {viewEvents.filter(e => (e.price ?? 0) > 0 && e.paid_count > 0).map((e, i, arr) => (
                        <View key={e.id} style={[s.eventBreakdownRow, i < arr.length - 1 && s.listRowBorder]}>
                          {(e.cover_url || (e as any).cover_urls?.[0]) ? (
                            <Image
                              source={{ uri: e.cover_url || (e as any).cover_urls?.[0] }}
                              style={s.breakdownThumb}
                            />
                          ) : (
                            <View style={[s.breakdownThumb, { backgroundColor: Colors.grayLight }]} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                            <Text style={s.listSub}>
                              {e.online_count > 0 ? `${t.dashboard.onlineTickets}: ${e.online_count}` : ''}
                              {e.online_count > 0 && e.door_count > 0 ? ' · ' : ''}
                              {e.door_count > 0 ? `${t.dashboard.atDoor}: ${e.door_count}` : ''}
                              {e.online_count > 0 ? ` · Woeva ${fmt(e.woeva_fee)}` : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.breakdownGross}>{fmt(e.onlineGross > 0 ? e.onlineGross : e.gross)}</Text>
                            <Text style={s.breakdownNet}>{fmt(e.onlineGross > 0 ? e.onlineNet : e.net)} {t.dashboard.netto}</Text>
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
                        const arrival = new Date(p.arrival_date).toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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

              {/* Attendance chart - primary */}
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>{t.dashboard.attendance}</Text>
                <EventChart events={viewEvents} range={statsRange} width={chartWidth - 32} getValue={e => e.is_free ? realGoing(e, user!.id) : e.paid_count} color={Colors.black} gradId="attGrad" />
              </View>

              {/* Revenue chart - secondary, only if there's paid revenue */}
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
                  { label: t.dashboard.onlineTickets, val: filtered.reduce((sum, e) => sum + e.online_count, 0) },
                  { label: t.dashboard.atDoor, val: filtered.reduce((sum, e) => sum + e.door_count, 0) },
                  { label: t.dashboard.freeEvents, val: filtered.filter(e => e.is_free).length },
                  { label: t.dashboard.paidEvents, val: filtered.filter(e => !e.is_free).length },
                  { label: t.dashboard.attendees, val: filtered.reduce((sum, e) => sum + realGoing(e, user!.id), 0) },
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
                    {(() => {
                      const fOnline = filtered.reduce((sum, e) => sum + e.price * e.online_count, 0);
                      const fDoor = filtered.reduce((sum, e) => sum + e.price * e.door_count, 0);
                      return (
                        <>
                          {fOnline > 0 && (
                            <View style={s.revenueRow}>
                              <Text style={s.revenueLabel}>{t.dashboard.onlineTickets}</Text>
                              <Text style={s.revenueVal}>{fmt(fOnline)}</Text>
                            </View>
                          )}
                          {fDoor > 0 && (
                            <View style={s.revenueRow}>
                              <Text style={s.revenueLabel}>{t.dashboard.atDoor}</Text>
                              <Text style={s.revenueVal}>{fmt(fDoor)}</Text>
                            </View>
                          )}
                          <View style={s.revenueRow}>
                            <Text style={s.revenueLabel}>{t.dashboard.grossRevenue}</Text>
                            <Text style={s.revenueVal}>{fmt(fGross)}</Text>
                          </View>
                          <View style={s.revenueRow}>
                            <Text style={s.revenueLabel}>{t.dashboard.woevaFee}</Text>
                            <Text style={[s.revenueVal, { color: Colors.gray }]}>- {fmt(fWoeva)}</Text>
                          </View>
                          <View style={[s.revenueRow, { borderTopWidth: 1.5, borderTopColor: Colors.black, marginTop: 8, paddingTop: 12 }]}>
                            <Text style={[s.revenueLabel, { fontWeight: '800', fontFamily: Fonts.extrabold }]}>{t.dashboard.netToYou}</Text>
                            <Text style={[s.revenueVal, { fontWeight: '800', fontFamily: Fonts.extrabold }]}>{fmt(fNet)}</Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                </>
              )}

              {(() => {
                const realCount = (e: EventRow) => e.is_free ? realGoing(e, user!.id) : e.paid_count;
                const topEvents = [...viewEvents]
                  .filter(e => e.status !== 'cancelled')
                  .sort((a, b) => realCount(b) - realCount(a))
                  .slice(0, 5);
                return topEvents.length > 0 ? (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 24 }]}>{t.dashboard.topByAttendance}</Text>
                    <View style={s.listCard}>
                      {topEvents.map((e, i, arr) => (
                        <View key={e.id} style={[s.listRow, i < arr.length - 1 && s.listRowBorder]}>
                          <Text style={s.rankNum}>{i + 1}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.listName} numberOfLines={1}>{e.title}</Text>
                            <Text style={s.listSub}>{t.dashboard.attendeesCount(realCount(e))}</Text>
                          </View>
                          {e.gross > 0 && <Text style={s.eventRevenue}>{fmt(e.gross)}</Text>}
                        </View>
                      ))}
                    </View>
                  </>
                ) : null;
              })()}

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
                      onPress={() => {
                        if (checkedIn[scannedTicket!.eventId]?.has(scannedTicket!.userId)) { setScannedTicket(null); return; }
                        markCheckedIn(scannedTicket!.eventId, scannedTicket!.userId);
                        setTimeout(() => setScannedTicket(null), 1200);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={s.scanCheckInBtnText}>
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
      <Modal visible={showClubSettings} transparent animationType="none" onRequestClose={closeClubSettings}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={closeClubSettings} />
          <RNAnimated.View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 24, transform: [{ translateY: clubSettingsSheetY }] }]} {...clubSettingsPan.panHandlers}>
            <View style={{ paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}>
              <View style={s.billingSheetHandle} />
            </View>
            <Text style={s.billingSheetTitle}>{t.dashboard.clubSettings}</Text>

            {/* Admins */}
            <View style={s.settingsSection}>
              <Text style={s.settingsSectionTitle}>{t.dashboard.admins.toUpperCase()}</Text>
              {clubAdmins.map(a => (
                <View key={a.user_id} style={s.settingsAdminRow}>
                  <View style={s.attendeeAvatar}>
                    {a.avatar_url ? <Image source={{ uri: a.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                    {!a.avatar_url && <Text style={s.attendeeInitial}>{(a.name || '?').charAt(0).toUpperCase()}</Text>}
                  </View>
                  <Text style={[s.attendeeName, { flex: 1 }]}>{a.name.split(' ')[0]}</Text>
                  {a.user_id === user?.id
                    ? <Text style={s.settingsOwnerBadge}>{t.club.owner}</Text>
                    : <TouchableOpacity onPress={() => removeAdmin(a.user_id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={s.settingsRemoveText}>{t.club.remove}</Text>
                      </TouchableOpacity>
                  }
                </View>
              ))}
              <TouchableOpacity style={s.settingsRow} onPress={() => { closeClubSettings(); setTimeout(() => { inviteAdminSheetY.setValue(SHEET_INIT); setShowInviteAdmin(true); sheetOpen(inviteAdminSheetY); }, 280); }} activeOpacity={0.7}>
                <Text style={[s.settingsRowLabel, { color: Colors.black, fontWeight: '600' }]}>{t.dashboard.inviteAdminPlus}</Text>
              </TouchableOpacity>
            </View>

            {/* Creator notifications */}
            <View style={s.settingsSection}>
              <Text style={s.settingsSectionTitle}>{t.dashboard.myNotifications}</Text>
              {[
                { label: t.dashboard.someoneJoins, val: notifJoin, set: setNotifJoin },
                { label: t.dashboard.someoneLeaves, val: notifLeave, set: setNotifLeave },
                { label: t.dashboard.newChatMessages, val: notifChat, set: (v: boolean | ((prev: boolean) => boolean)) => {
                    const next = typeof v === 'function' ? v(notifChat) : v;
                    setNotifChat(next);
                    if (user) supabase.from('profiles').update({ notif_chat: next }).eq('id', user.id);
                  }},
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
          </RNAnimated.View>
        </View>
      </Modal>

      {/* ── Invite Admin Modal ──────────────────────────────────────────────── */}
      <Modal visible={showInviteAdmin} transparent animationType="none" onRequestClose={closeInviteAdmin}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={closeInviteAdmin} />
          <RNAnimated.View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: inviteAdminSheetY }] }]}>
            <View
              {...inviteAdminPan.panHandlers}
              style={{ paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}
            >
              <View style={s.billingSheetHandle} />
            </View>
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
                  {!r.avatar_url && <Text style={s.attendeeInitial}>{(r.name || '?').charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.attendeeName}>{(r.name || '').split(' ')[0]}</Text>
                  {r.email && <Text style={s.listSub}>{r.email}</Text>}
                </View>
                <Text style={[s.listSub, { marginLeft: 'auto' }]}>{t.club.addArrow}</Text>
              </TouchableOpacity>
            ))}
            {inviteQuery.length >= 2 && inviteResults.length === 0 && (
              <Text style={[s.emptySub, { marginTop: 12 }]}>{t.club.notFound}</Text>
            )}
          </RNAnimated.View>
        </View>
      </Modal>

      {/* ── Attendees Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!attendeesEvent} transparent animationType="none" onRequestClose={closeAttendees}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={closeAttendees} />
          <RNAnimated.View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: attendeesSheetY }] }]} {...attendeesPan.panHandlers}>
            {/* Handle */}
            <View {...attendeesHandlePan.panHandlers} style={{ paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}>
              <View style={s.billingSheetHandle} />
            </View>
            {/* Title — full width */}
            <Text style={s.billingSheetTitle}>{attendeesEvent?.title}</Text>

            {loadingAttendees
              ? <ActivityIndicator color={Colors.black} style={{ marginTop: 24 }} />
              : <>
                  {/* Divider + Účastníci row */}
                  <View style={{ height: 1, backgroundColor: Colors.grayLight, marginTop: 14, marginBottom: 10 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontFamily: Fonts.medium, color: Colors.gray }}>Účastníci</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.black }} />
                      <Text style={{ fontSize: 13, fontFamily: Fonts.medium, color: Colors.black }}>
                        {(() => { const n = attendeesEvent ? (attendeesEvent.is_free ? realGoing(attendeesEvent, user!.id) : attendeesEvent.paid_count) : 0; return `${n} ${goingLabel(n, lang)}`; })()}
                      </Text>
                    </View>
                  </View>
                  <FlatList
                    data={[...attendees].sort((a, b) => (b.id === user?.id ? 1 : 0) - (a.id === user?.id ? 1 : 0))}
                    keyExtractor={i => i.id}
                    onScroll={e => { attendeesListOffset.current = e.nativeEvent.contentOffset.y; }}
                    scrollEventThrottle={16}
                    renderItem={({ item, index }) => {
                      const isIn = checkedIn[attendeesEvent?.id ?? '']?.has(item.id);
                      const isMe = item.id === user?.id;
                      return (
                        <View style={s.attendeeRow}>
                          <Text style={s.attendeeIndex}>{index + 1}</Text>
                          <View style={s.attendeeAvatar}>
                            {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                            {!item.avatar_url && <Text style={s.attendeeInitial}>{(item.name || '?').charAt(0).toUpperCase()}</Text>}
                          </View>
                          <Text style={[s.attendeeName, { flex: 1 }]}>{(item.name || '').split(' ')[0]}</Text>
                          {isMe
                            ? <View style={s.meBadge}><Text style={s.meBadgeText}>ja</Text></View>
                            : isIn
                              ? <TouchableOpacity style={s.checkedInBadge} activeOpacity={0.7} onPress={() => {
                                  Alert.alert(t.dashboard.checkedIn, t.dashboard.undoCheckInConfirm ?? 'Zrušiť potvrdenie príchodu?', [
                                    { text: 'Vrátiť sa', style: 'cancel' },
                                    { text: 'Zrušiť', style: 'destructive', onPress: () => unmarkCheckedIn(attendeesEvent!.id, item.id) },
                                  ]);
                                }}>
                                  <Text style={s.checkedInBadgeText}>{t.dashboard.checkedIn}</Text>
                                </TouchableOpacity>
                              : <TouchableOpacity style={s.checkInBtn} onPress={() => markCheckedIn(attendeesEvent!.id, item.id)} activeOpacity={0.7}>
                                  <Text style={s.checkInBtnText}>{t.dashboard.checkIn}</Text>
                                </TouchableOpacity>
                          }
                        </View>
                      );
                    }}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.grayBorder }} />}
                    ListEmptyComponent={<Text style={[s.emptySub, { marginTop: 24 }]}>{t.dashboard.noAttendeesYet}</Text>}
                  />
                </>
            }

            {/* Divider + bottom row: Add coordinator (left) + PDF (right) */}
            {attendeesEvent?.club_id && clubs.some(c => c.id === attendeesEvent?.club_id) && (
              <>
                <View style={{ height: 1, backgroundColor: Colors.grayLight, marginTop: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}>
                  <TouchableOpacity onPress={shareCoordFromAttendees} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} activeOpacity={0.7}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' }}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 5v14M5 12h14" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" />
                      </Svg>
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: Fonts.medium, color: Colors.black }}>Pridať koordinátora</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' }} onPress={() => { closeAttendees(); setTimeout(() => setActiveTab('scan'), 350); }} activeOpacity={0.7}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M8 7h2v2H8zM14 7h2v2h-2zM8 13h2v2H8zM14 13h2v2h-2z" fill={Colors.black} />
                      </Svg>
                    </TouchableOpacity>
                    {attendees.length > 0 && (
                      <TouchableOpacity style={s.exportBtn} onPress={exportAttendeesPdf} activeOpacity={0.7}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          <Path d="M7 10l5 5 5-5M12 15V3" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={s.exportBtnText}>PDF</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}
          </RNAnimated.View>
        </View>
      </Modal>

      {/* ── Coordinator Invite Modal ─────────────────────────────────────────── */}
      <Modal visible={showCoordInvite} transparent animationType="none" onRequestClose={closeCoordInvite}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={closeCoordInvite} />
          <RNAnimated.View style={[s.attendeesSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: coordInviteSheetY }] }]} {...coordInvitePan.panHandlers}>
            <View style={{ paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}><View style={s.billingSheetHandle} /></View>
            <Text style={s.billingSheetTitle}>Pridať koordinátora</Text>
            <Text style={[s.listSub, { marginBottom: 16 }]}>Koordinátor môže skenovať QR kódy a potvrdzovať vstupy na všetkých eventoch klubu.</Text>
            {/* Search */}
            <TextInput
              style={s.inviteInput}
              value={coordQuery}
              onChangeText={searchCoord}
              placeholder="Hľadaj podľa mena..."
              placeholderTextColor={Colors.gray}
              autoFocus
            />
            {coordResults.map((r, i) => (
              <TouchableOpacity key={r.id} style={[s.attendeeRow, i < coordResults.length - 1 && { borderBottomWidth: 1, borderColor: Colors.grayBorder }]} onPress={() => addCoordinator(r.id, r.name)} activeOpacity={0.7}>
                <View style={s.attendeeAvatar}>
                  {r.avatar_url ? <Image source={{ uri: r.avatar_url }} style={StyleSheet.absoluteFill as any} /> : null}
                  {!r.avatar_url && <Text style={s.attendeeInitial}>{(r.name || '?').charAt(0).toUpperCase()}</Text>}
                </View>
                <Text style={[s.attendeeName, { flex: 1 }]}>{r.name}</Text>
                <Text style={s.listSub}>+ Pridať</Text>
              </TouchableOpacity>
            ))}
          </RNAnimated.View>
        </View>
      </Modal>

      {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
      <View style={[s.bottomNavWrapper, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.bottomNavPill}>
          {/* Home → main homepage */}
          <TouchableOpacity style={s.bottomNavItem} onPress={() => router.push('/(tabs)' as any)} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" stroke="rgba(0,0,0,0.35)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={s.bottomNavLabel}>{t.dashboard.homeTab}</Text>
          </TouchableOpacity>

          {/* Dashboard */}
          <TouchableOpacity style={s.bottomNavItem} onPress={() => setActiveTab('home')} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M3 12h18M3 18h18" stroke={activeTab === 'home' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={activeTab === 'home' ? 2.5 : 1.8} strokeLinecap="round" />
            </Svg>
            <Text style={[s.bottomNavLabel, activeTab === 'home' && s.bottomNavLabelActive]}>{t.dashboard.dashboard}</Text>
          </TouchableOpacity>

          {/* QR scan — center */}
          <TouchableOpacity style={s.bottomNavScanBtn} onPress={() => setActiveTab('scan')} activeOpacity={0.85}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect x="3" y="3" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} />
              <Rect x="15" y="3" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} />
              <Rect x="3" y="15" width="6" height="6" rx="1" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} />
              <Path d="M15 17h3M17 15v3" stroke={activeTab === 'scan' ? Colors.black : Colors.gray} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          {/* Stats */}
          <TouchableOpacity style={s.bottomNavItem} onPress={() => setActiveTab('stats')} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M18 20V10M12 20V4M6 20v-6" stroke={activeTab === 'stats' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={activeTab === 'stats' ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[s.bottomNavLabel, activeTab === 'stats' && s.bottomNavLabelActive]}>{t.dashboard.statsTab}</Text>
          </TouchableOpacity>

          {/* Payouts */}
          <TouchableOpacity style={s.bottomNavItem} onPress={() => setActiveTab('payouts')} activeOpacity={0.7}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M12 19V5M5 12l7-7 7 7" stroke={activeTab === 'payouts' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={activeTab === 'payouts' ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M5 19h14" stroke={activeTab === 'payouts' ? Colors.black : 'rgba(0,0,0,0.35)'} strokeWidth={activeTab === 'payouts' ? 2.5 : 1.8} strokeLinecap="round" />
            </Svg>
            <Text style={[s.bottomNavLabel, activeTab === 'payouts' && s.bottomNavLabelActive]}>{t.dashboard.payoutsTab}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16 },
  pageTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, position: 'absolute', left: 0, right: 0, textAlign: 'center' },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  // Club card
  clubCard: { height: 150, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
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
  overviewVal: { fontSize: 16, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
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

  // Earnings home card
  earningsHomeCard: { backgroundColor: Colors.grayLight, borderRadius: 20, padding: 18, marginBottom: 4 },
  earningsHomeTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earningsHomeLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  earningsHomeBig: { fontSize: 30, fontWeight: '800', color: Colors.black, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  earningsHomePill: { backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  earningsHomePillText: { fontSize: 11, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
  earningsHomeDivider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 14 },
  earningsHomeRow: { flexDirection: 'row', alignItems: 'center' },
  earningsHomeCell: { flex: 1, alignItems: 'center', gap: 3 },
  earningsHomeCellDivider: { width: 1, height: 28, backgroundColor: Colors.grayBorder },
  earningsHomeCellLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  earningsHomeCellVal: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },

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
  segmentText: { fontSize: 11, fontWeight: '500', color: Colors.gray, fontFamily: Fonts.medium },
  segmentTextActive: { color: Colors.black, fontWeight: '700', fontFamily: Fonts.bold },
  segmentCount: { fontSize: 9, fontWeight: '400' },
  cancelledBadge: { backgroundColor: '#FFE5E5', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  cancelledBadgeText: { fontSize: 10, fontWeight: '700', color: '#CC3333' },
  goingBadge: { alignItems: 'center', minWidth: 34 },
  goingNum: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  goingLabel: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.regular },
  shareBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
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
  stripeIntro: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, lineHeight: 20 },
  payMethodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  payMethodBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.grayBorder, backgroundColor: Colors.white },
  payMethodText: { fontSize: 11, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, letterSpacing: 0.2 },
  feeToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.grayBorder },
  feeToggleText: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  feeToggleArrow: { fontSize: 10, color: Colors.gray },
  feeBox: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, gap: 10 },
  feeExample: {},
  feeExampleText: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  feeRow: { gap: 2 },
  feeLabel: { fontSize: 12, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  feeVal: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 17 },
  stripeStatusRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.grayBorder },
  stripeStatusDot: { width: 8, height: 8, borderRadius: 4 },
  stripeStatusText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
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
  breakdownThumb: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 },
  breakdownGross: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  breakdownNet: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'right' },

  // Payout section
  payoutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 12 },
  payoutFilterRow: { flexDirection: 'row', gap: 6 },
  payoutFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight },
  payoutFilterChipActive: { backgroundColor: Colors.black },
  payoutFilterText: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  payoutFilterTextActive: { color: Colors.white },
  // Payout card rows
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
  payoutRowBorder: { borderTopWidth: 1, borderTopColor: Colors.grayBorder },
  payoutDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  payoutDotPending: { backgroundColor: '#F59E0B' },
  payoutDotDone: { backgroundColor: '#4CAF50' },
  payoutRowDate: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  payoutRowStatus: { fontSize: 12, fontWeight: '500', fontFamily: Fonts.regular },
  payoutRowStatusPending: { color: '#F59E0B' },
  payoutRowStatusDone: { color: '#4CAF50' },
  payoutRowAmount: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, marginLeft: 8 },
  payoutPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  payoutPageBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  payoutPageBtnText: { fontSize: 13, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  payoutPageInfo: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  payoutNote: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18, marginTop: 12 },
  invoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 20, paddingVertical: 14, backgroundColor: Colors.grayLight, borderRadius: 14 },
  invoiceBtnText: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  monthSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },

  // Earnings card
  earningsCard: { backgroundColor: Colors.black, borderRadius: 20, padding: 20, marginBottom: 12 },
  earningsCardTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  earningsCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: Fonts.regular, marginBottom: 4, letterSpacing: 0.5 },
  earningsCardAmount: { fontSize: 36, fontWeight: '800', color: Colors.white, fontFamily: Fonts.bold, letterSpacing: -1 },
  earningsCardRight: { alignItems: 'flex-end', paddingBottom: 4 },
  earningsCardGrossLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.regular },
  earningsCardGross: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.semibold },
  earningsCardMonth: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  earningsCardMonthDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.lime },
  earningsCardMonthText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: Fonts.regular },

  // Invoices row
  invoicesRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.grayLight, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  invoicesRowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  invoicesRowLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  invoicesRowBadge: { backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3 },
  invoicesRowBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },

  // Invoices sheet
  invoicesSheet: { backgroundColor: '#F7F7F7', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
  invoicesSheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  invoicesSheetTitle: { fontSize: 22, fontWeight: '800', color: Colors.black, fontFamily: Fonts.bold },
  invoicesSheetSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  invoicesCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  invoicesCloseBtnText: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.semibold },

  // Invoice card
  invoiceCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 0 },
  invoiceCardMonth: { fontSize: 18, fontWeight: '800', color: Colors.black, fontFamily: Fonts.bold },
  invoiceAvailBadge: { backgroundColor: '#E8F5E9', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  invoiceAvailBadgeText: { fontSize: 11, fontWeight: '700', color: '#2E7D32', fontFamily: Fonts.bold },
  invoicePendingBadge: { backgroundColor: '#F5F5F5', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  invoicePendingText: { fontSize: 11, fontWeight: '500', color: Colors.gray, fontFamily: Fonts.medium },
  invoiceStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 14, padding: 16, marginTop: 0 },
  invoiceStatBlock: { flex: 1, alignItems: 'center', gap: 3 },
  invoiceStatDivider: { width: 1, height: 28, backgroundColor: Colors.grayBorder },
  invoiceStatLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  invoiceStatVal: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  invoiceDownloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.black, borderRadius: 14, paddingVertical: 13, marginTop: 12 },
  invoiceDownloadText: { fontSize: 14, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
  invoicePendingNote: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 14 },
  monthDownloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 7 },
  monthDownloadBtnDisabled: { opacity: 0.5 },
  monthDownloadText: { fontSize: 12, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },

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
  viewFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  viewFilterLabel: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.medium, marginRight: 2 },
  viewFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight },
  viewFilterChipActive: { backgroundColor: Colors.black },
  viewFilterText: { fontSize: 12, fontWeight: '500', color: Colors.gray, fontFamily: Fonts.medium },
  viewFilterTextActive: { color: Colors.white, fontWeight: '700', fontFamily: Fonts.bold },
  viewFilterAdd: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  viewFilterAddText: { fontSize: 14, fontWeight: '500', color: Colors.gray, lineHeight: 17 },
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
  attendeesSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 0, maxHeight: '85%', flex: 1 },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  attendeeIndex: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, width: 20, textAlign: 'right' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.grayLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
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
  scanCheckInBtnDone: { backgroundColor: Colors.black },
  scanCheckInBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },

  // Attendees check-in
  checkedInBadge: { backgroundColor: '#E8FAF0', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5 },
  checkedInBadgeText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  meBadge: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5 },
  meBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.gray },
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
