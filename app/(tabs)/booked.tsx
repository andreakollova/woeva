import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, ImageStyle, Modal, Alert, Share, Linking, Platform, ActivityIndicator } from 'react-native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { Button } from '@/components/ui/Button';
import { WMark } from '@/components/ui/WMark';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { cancelEventReminders } from '@/lib/scheduleReminders';
import { useTranslations } from '@/context/LanguageContext';

type BookedEvent = Event & { attendee_id?: string };


export default function BookedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<BookedEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); loadEvents(); }, [tab, user]));

  async function loadEvents() {
    if (!user) return;
    const today = new Date();
    const now = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { data } = await supabase
      .from('event_attendees')
      .select('id, event:events(*, club:clubs(id, name, cover_url), creator:profiles!creator_id(id, name), attendees:event_attendees(profile:profiles(id, name, avatar_url)))')
      .eq('user_id', user.id);

    const allEvents: BookedEvent[] = (data ?? [])
      .map((r: any) => ({ ...r.event, attendee_id: r.id }))
      .filter((e: any) => e?.id)
      .filter((e: any) => e.status !== 'cancelled');

    const withDates = allEvents.map(e => {
      if (!e.is_recurring) return e;
      // For recurring events find the single relevant occurrence
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      const endDate = (e as any).recurring_end_date ? new Date((e as any).recurring_end_date + 'T00:00:00') : maxDate;
      const cap = endDate < maxDate ? endDate : maxDate;
      const cancelled = new Set(e.cancelled_dates ?? []);
      let cur = new Date(e.date + 'T00:00:00');
      if (tab === 'upcoming') {
        while (cur < todayDate) cur.setDate(cur.getDate() + 7);
        while (cur <= cap) {
          const ds = cur.toISOString().slice(0, 10);
          if (!cancelled.has(ds)) return { ...e, date: ds };
          cur.setDate(cur.getDate() + 7);
        }
        return null; // no upcoming occurrence
      } else {
        // past: find most recent past occurrence
        let last: string | null = null;
        while (cur < todayDate && cur <= cap) {
          const ds = cur.toISOString().slice(0, 10);
          if (!cancelled.has(ds)) last = ds;
          cur.setDate(cur.getDate() + 7);
        }
        return last ? { ...e, date: last } : null;
      }
    }).filter(Boolean) as BookedEvent[];

    const filtered = tab === 'upcoming'
      ? withDates.filter(e => (e.date || '').slice(0, 10) >= now)
      : withDates.filter(e => (e.date || '').slice(0, 10) < now);

    setEvents(filtered.sort((a, b) => a.date.localeCompare(b.date)));

  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }

  function handleLeaveEvent(event: BookedEvent) {
    const isFree = event.is_free || !event.price;
    const eventDateTime = new Date(`${event.date}T${event.time || '00:00'}:00`);
    const hoursUntil = (eventDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const refundEligible = !isFree && hoursUntil > 48;
    const noRefund = !isFree && hoursUntil <= 48;

    const subtitle = refundEligible
      ? `You paid €${event.price} for this ticket. Since the event is more than 48 hours away, you are eligible for a refund - contact support after leaving.`
      : noRefund
        ? `You paid €${event.price} for this ticket. The event is less than 48 hours away, so this ticket is non-refundable.`
        : t.tickets.leaveNoSpot;

    const confirmTitle = refundEligible ? t.tickets.leaveRefundTitle : noRefund ? t.tickets.leaveNoRefundTitle : t.tickets.leaveConfirmTitle;
    const confirmSub = refundEligible ? t.tickets.leaveRefundSub : noRefund ? t.tickets.leaveNoRefundSub : t.tickets.leaveSub;

    Alert.alert(confirmTitle, subtitle, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: noRefund ? t.tickets.leaveAnyway : t.tickets.leaveEvent,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.tickets.areYouSure, confirmSub, [
            { text: t.tickets.goBack, style: 'cancel' },
            {
              text: t.tickets.yesLeave,
              style: 'destructive',
              onPress: async () => {
                await supabase.from('event_attendees').delete().eq('id', event.attendee_id!);
                cancelEventReminders(event.id).catch(() => {});
                setEvents(prev => prev.filter(e => e.id !== event.id));
                if (event.creator_id && user && event.creator_id !== user.id) {
                  supabase.from('notifications').insert({
                    user_id: event.creator_id, type: 'leave',
                    title: `Someone left ${event.title}`,
                    body: `${profile?.name ?? 'An attendee'} cancelled their spot.`,
                    data: { event_id: event.id },
                  }).then(() => {});
                  notify.leftEvent({
                    creatorId: event.creator_id,
                    creatorEmail: '',
                    attendeeName: profile?.name ?? 'An attendee',
                    eventTitle: event.title,
                    eventId: event.id,
                  });
                }
              },
            },
          ]);
        },
      },
    ]);
  }

  function handleDeleteTicket(event: BookedEvent) {
    Alert.alert(
      t.tickets.removeTicket,
      t.tickets.removeTicketMsg(event.title),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.tickets.removeTicket,
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t.tickets.areYouSure,
              t.tickets.removeTicketConfirm,
              [
                { text: t.tickets.goBack, style: 'cancel' },
                {
                  text: t.tickets.yesDelete,
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingId(event.id);
                    await supabase.from('event_attendees').delete().eq('id', event.attendee_id!);
                    cancelEventReminders(event.id).catch(() => {});
                    setEvents(prev => prev.filter(e => e.id !== event.id));
                    setDeletingId(null);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
          <WMark size={90} color={Colors.lime} style={{ marginVertical: -10 }} />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t.tickets.myTickets}</Text>

      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map(tabKey => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tabBtn, tab === tabKey && styles.tabBtnActive]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
              {tabKey === 'upcoming' ? t.tickets.upcoming : t.tickets.past}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {events.length === 0 ? (
          <Animated.View entering={FadeInDown} style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {tab === 'upcoming' ? t.tickets.noUpcoming : t.tickets.noPast}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'upcoming' ? t.tickets.noUpcomingSub : t.tickets.noPastSub}
            </Text>
            {tab === 'upcoming' && (
              <Button label={t.tickets.discoverEvents} onPress={() => router.push('/(tabs)/search')} variant="lime" style={styles.cta} />
            )}
          </Animated.View>
        ) : (
          events.map((event, i) => (
            <Animated.View key={`${event.id}-${event.date}`} entering={FadeInDown.delay(i * 70)}>
              <TicketCard
                event={event}
                userId={user!.id}
                userAvatar={profile?.avatar_url ?? null}
                userName={profile?.name ?? user!.email ?? ''}
                isPast={tab === 'past'}

                onPress={() => router.push(`/event/${event.id}`)}
                onDelete={() => handleDeleteTicket(event)}
                onLeave={() => handleLeaveEvent(event)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function TicketCard({ event, userId, userAvatar, userName, isPast, onPress, onDelete, onLeave }: {
  event: BookedEvent;
  userId: string;
  userAvatar: string | null;
  userName: string;
  isPast: boolean;
  onPress: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
}) {
  const { t, lang } = useTranslations();
  const [qrModal, setQrModal] = useState(false);
  const [optionsModal, setOptionsModal] = useState(false);
  const [goingCount, setGoingCount] = useState(event.going_count ?? 0);
  const [loadingWallet, setLoadingWallet] = useState(false);

  useEffect(() => {
    const channelName = `event_going_${event.id}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
        filter: `id=eq.${event.id}`,
      }, payload => {
        if (payload.new?.going_count !== undefined) {
          setGoingCount(payload.new.going_count);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [event.id]);

  const d = new Date(event.date + 'T00:00:00');
  const locale = lang === 'sk' ? 'sk-SK' : 'en-US';
  const dayName = d.toLocaleDateString(locale, { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase());
  const dateStr = `${d.getDate()} ${d.toLocaleDateString(locale, { month: 'long' })} ${d.getFullYear()}`;
  const qrValue = `woeva:ticket:${event.attendee_id ?? event.id}:${userId}`;
  const isFree = event.is_free || event.price === 0;
  const priceLabel = isFree ? t.tickets.free : `€${event.price}`;
  const hostName: string | null = (event as any).club?.name ?? (event as any).creator?.name ?? null;
  const isScrapedEvent = !!(event as any).source;

  function handleShare() {
    Share.share({ message: `Check out "${event.title}" on Woeva!` });
  }

  function handleDirections() {
    if (!event.venue) return;
    const query = encodeURIComponent(event.venue);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${query}`
      : `geo:0,0?q=${query}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  }

  async function handleAddToWallet() {
    if (loadingWallet) return;
    setLoadingWallet(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const passUrl = `https://woeva-oscar.vercel.app/api/wallet-pass?event_id=${event.id}&token=${session?.access_token}`;
      await Linking.openURL(passUrl);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not open Wallet. Try again.');
    } finally {
      setLoadingWallet(false);
    }
  }

  function handleCalendar() {
    Alert.alert('Add to calendar', `${event.title}\n${event.date}${event.time ? ' at ' + event.time : ''}${event.venue ? '\n' + event.venue : ''}`, [
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={styles.ticket}>
      {/* Options modal */}
      <Modal visible={optionsModal} transparent animationType="fade" onRequestClose={() => setOptionsModal(false)}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setOptionsModal(false)}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHandle} />
            <Text style={styles.optionsTitle}>{event.title}</Text>

            {!isPast && onLeave && (
              <TouchableOpacity style={[styles.optionsRow, styles.optionsRowDestructive]} onPress={() => { setOptionsModal(false); onLeave(); }} activeOpacity={0.7}>
                <View style={[styles.optionsIconBox, { backgroundColor: '#FFF0F0' }]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#FF3B30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M16 17l5-5-5-5" stroke="#FF3B30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M21 12H9" stroke="#FF3B30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View style={styles.optionsRowBody}>
                  <Text style={[styles.optionsRowLabel, styles.optionsRowLabelDestructive]}>{t.tickets.leaveEvent}</Text>
                  <Text style={styles.optionsRowSub}>{t.tickets.leaveEventSub}</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.optionsRow} onPress={() => { setOptionsModal(false); handleShare(); }} activeOpacity={0.7}>
              <View style={styles.optionsIconBox}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M16 6l-4-4-4 4" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 2v13" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.optionsRowBody}>
                <Text style={styles.optionsRowLabel}>{t.tickets.shareTicket}</Text>
                <Text style={styles.optionsRowSub}>{t.tickets.shareTicketSub}</Text>
              </View>
            </TouchableOpacity>

            {event.venue ? (
              <TouchableOpacity style={styles.optionsRow} onPress={() => { setOptionsModal(false); handleDirections(); }} activeOpacity={0.7}>
                <View style={styles.optionsIconBox}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx="12" cy="9" r="2.5" stroke={Colors.black} strokeWidth={2} />
                  </Svg>
                </View>
                <View style={styles.optionsRowBody}>
                  <Text style={styles.optionsRowLabel}>{t.tickets.getDirections}</Text>
                  <Text style={styles.optionsRowSub}>{event.venue}</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.optionsRow} onPress={() => { setOptionsModal(false); handleCalendar(); }} activeOpacity={0.7}>
              <View style={styles.optionsIconBox}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 9h18M16 2v4M8 2v4" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={styles.optionsRowBody}>
                <Text style={styles.optionsRowLabel}>{t.tickets.eventDetails}</Text>
                <Text style={styles.optionsRowSub}>{event.date}{event.time ? ' · ' + event.time : ''}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Cover strip */}
      <View style={styles.ticketCover}>
        {event.cover_url
          ? <Image source={{ uri: event.cover_url }} style={styles.ticketCoverImg} />
          : <View style={[styles.ticketCoverImg, { backgroundColor: Colors.black }]} />
        }
        {/* Overlay */}
        <View style={styles.ticketCoverOverlay} />
        <View style={styles.ticketCoverContent}>
          <View style={styles.ticketStatusPill}>
            <Text style={styles.ticketStatusText}>{isPast ? t.tickets.used : t.tickets.valid}</Text>
            <View style={[styles.ticketStatusDot, { backgroundColor: isPast ? Colors.gray : Colors.lime }]} />
          </View>
          <Text style={styles.ticketEventTitle} numberOfLines={2}>{event.title}</Text>
        </View>
        {isPast && onDelete && (
          <TouchableOpacity
            style={styles.ticketDeleteBtn}
            onPress={e => { e.stopPropagation(); onDelete(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.ticketDeleteIcon}>×</Text>
          </TouchableOpacity>
        )}
        {!isPast && (
          <TouchableOpacity
            style={styles.ticketOptionsBtn}
            onPress={e => { e.stopPropagation(); setOptionsModal(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={styles.ticketOptionsIcon}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info section */}
      <View style={styles.ticketBody}>
        {/* Date + Time row */}
        <View style={styles.ticketInfoGrid}>
          <View style={styles.ticketInfoCell}>
            <Text style={styles.ticketInfoLabel}>{t.tickets.dateLabel}</Text>
            <Text style={styles.ticketInfoValue}>{dayName}</Text>
            <Text style={styles.ticketInfoSub}>{dateStr}</Text>
          </View>
          <View style={styles.ticketInfoDivider} />
          <View style={styles.ticketInfoCell}>
            <Text style={styles.ticketInfoLabel}>{t.tickets.timeLabel}</Text>
            <Text style={styles.ticketInfoValue}>{event.time || '-'}</Text>
            {event.duration ? <Text style={styles.ticketInfoSub}>{t.tickets.duration_hours(event.duration)}</Text> : null}
          </View>
        </View>

        {/* Venue */}
        {event.venue ? (
          <View style={styles.ticketVenueRow}>
            <Text style={styles.ticketInfoLabel}>{t.tickets.locationLabel}</Text>
            <Text style={styles.ticketVenue}>{event.venue}</Text>
          </View>
        ) : null}

        {/* Going count - always show since user is attending */}
        <View style={styles.ticketGoingRow}>
          <View style={styles.goingAvatars}>
            {/* User's own avatar always first */}
            <View style={[styles.goingAvatar, styles.goingAvatarFallback, { marginLeft: 0 }]}>
              <Text style={styles.goingAvatarInitial}>{(userName || '?').charAt(0).toUpperCase()}</Text>
              {userAvatar ? <Image source={{ uri: userAvatar }} style={[StyleSheet.absoluteFill, { borderRadius: 11 }] as ImageStyle} /> : null}
            </View>
            {/* Other attendees */}
            {((event as any).attendees ?? [])
              .filter((a: any) => a?.profile?.id && a.profile.id !== userId)
              .slice(0, 2)
              .map((att: any, i: number) => {
                const avatarUrl = att?.profile?.avatar_url;
                const initial = (att?.profile?.name ?? '').charAt(0).toUpperCase();
                return avatarUrl
                  ? <Image key={i} source={{ uri: avatarUrl }} style={[styles.goingAvatar, { marginLeft: -7 }] as ImageStyle} />
                  : <View key={i} style={[styles.goingAvatar, styles.goingAvatarFallback, { marginLeft: -7 }]}><Text style={styles.goingAvatarInitial}>{initial}</Text></View>;
              })}
          </View>
          <Text style={styles.goingLabel}>{t.tickets.going_people(Math.max(goingCount, 1))}</Text>
          <View style={[styles.pricePill, isFree && styles.pricePillFree]}>
            <Text style={[styles.priceText, isFree && styles.priceTextFree]}>{priceLabel}</Text>
          </View>
        </View>

        {/* Perforated separator */}
        <View style={styles.perfRow}>
          <View style={styles.perfNub} />
          <View style={styles.perfLine}>
            {Array.from({ length: 16 }).map((_, i) => (
              <View key={i} style={styles.perfDash} />
            ))}
          </View>
          <View style={styles.perfNub} />
        </View>

        {/* QR section */}
        <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
          <TouchableOpacity style={styles.qrModalBg} activeOpacity={1} onPress={() => setQrModal(false)}>
            <View style={styles.qrModalCard}>
              <Text style={styles.qrModalTitle}>{event.title}</Text>
              <Text style={styles.qrModalSub}>{isPast ? t.tickets.eventAttended : t.tickets.showAtDoor}</Text>
              <View style={styles.qrModalCode}>
                <QRCode value={qrValue} size={220} color={Colors.black} backgroundColor={Colors.white} />
              </View>
              <Text style={styles.qrModalHint}>{t.tickets.tapToClose}</Text>
            </View>
          </TouchableOpacity>
        </Modal>
        <View style={styles.qrSection}>
          <View style={styles.qrLeft}>
            <TouchableOpacity
              style={[styles.qrWrap, isScrapedEvent && styles.qrWrapMuted]}
              onPress={() => {
                if (isScrapedEvent) {
                  Alert.alert(t.tickets.freeEventQrTitle, t.tickets.freeEventQrMsg);
                } else {
                  setQrModal(true);
                }
              }}
              activeOpacity={0.75}
            >
              <QRCode
                value={qrValue}
                size={88}
                color={isScrapedEvent ? '#C0C0C0' : isPast ? Colors.gray : Colors.black}
                backgroundColor={Colors.white}
              />
            </TouchableOpacity>
            {!isPast && !isScrapedEvent && (
              <TouchableOpacity onPress={handleAddToWallet} activeOpacity={0.8} style={styles.walletBtn} disabled={loadingWallet}>
                {loadingWallet
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Image source={require('@/assets/images/add-to-wallet.png')} style={styles.walletBadge} resizeMode="contain" />
                }
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.qrInfo}>
            {hostName ? <Text style={styles.qrHost} numberOfLines={1}>{hostName}</Text> : null}
            <Text style={styles.qrAttendeeName} numberOfLines={1}>{userName}</Text>
            {!isPast && <Text style={styles.qrTitle}>{t.tickets.yourTicket}</Text>}
            <Text style={styles.qrSub}>{isPast ? t.tickets.thanksForComing : isScrapedEvent ? (lang === 'sk' ? 'Táto udalosť je zadarmo — QR kód nepotrebuješ.' : 'This event is free — no QR needed.') : t.tickets.showAtDoor}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  topBar: { alignItems: 'center', paddingVertical: 0 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, paddingHorizontal: 20, marginBottom: 16, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.white },
  tabBtnActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.extrabold, color: Colors.black },
  emptyText: { fontSize: 15, color: Colors.gray, textAlign: 'center', lineHeight: 22, fontFamily: Fonts.regular },
  cta: { marginTop: 8, width: '100%' },

  // Ticket
  ticket: {
    backgroundColor: '#111',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },

  // Cover
  ticketCover: { height: 160, position: 'relative' },
  ticketCoverImg: { width: '100%', height: '100%' },
  ticketCoverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  ticketCoverContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 6 },
  ticketDeleteBtn: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  ticketDeleteIcon: { fontSize: 18, color: Colors.white, lineHeight: 18, fontWeight: '300', marginTop: -2 },
  ticketOptionsBtn: { position: 'absolute', top: 12, right: 12, width: 32, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  ticketOptionsIcon: { fontSize: 16, color: Colors.white, lineHeight: 20, letterSpacing: 1 },
  ticketStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5 },
  ticketStatusText: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 1.2 },
  ticketStatusDot: { width: 6, height: 6, borderRadius: 3 },
  ticketEventTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, letterSpacing: -0.5, lineHeight: 28, fontFamily: Fonts.extrabold },

  // Body
  ticketBody: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18 },

  ticketInfoGrid: { flexDirection: 'row', marginBottom: 14 },
  ticketInfoCell: { flex: 1, gap: 2 },
  ticketInfoDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 14 },
  ticketInfoLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  ticketInfoValue: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  ticketInfoSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: Fonts.regular },

  ticketVenueRow: { marginBottom: 14, gap: 2 },
  ticketVenue: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.medium },

  ticketGoingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  goingAvatars: { flexDirection: 'row' },
  goingAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#111' },
  goingAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  goingAvatarInitial: { fontSize: 9, fontWeight: '700', color: Colors.black },

  goingLabel: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: Fonts.regular },
  pricePill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  pricePillFree: { backgroundColor: Colors.lime },
  priceText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  priceTextFree: { color: Colors.black },

  // Perforated line
  perfRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  perfNub: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F5', marginHorizontal: -32 },
  perfLine: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  perfDash: { width: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2 },

  // QR
  qrSection: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  qrLeft: { alignItems: 'flex-start', gap: 8 },
  qrWrap: { padding: 10, backgroundColor: Colors.white, borderRadius: 16 },
  qrWrapMuted: { opacity: 0.4 },
  qrInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  qrHost: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.4)', fontFamily: Fonts.semibold, letterSpacing: 0.6, textTransform: 'uppercase' },
  qrAttendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  qrAvatar: { width: 28, height: 28, borderRadius: 14 },
  qrAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  qrAvatarInitial: { fontSize: 12, fontWeight: '700', color: Colors.black },

  qrAttendeeName: { fontSize: 13, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },
  qrTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.semibold },
  qrSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: Fonts.regular, lineHeight: 16 },
  qrClub: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: Fonts.medium, marginTop: 2 },

  // Options sheet
  optionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20 },
  optionsHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 16 },
  optionsTitle: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, marginBottom: 12 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  optionsRowDestructive: {},
  optionsRowIconText: { fontSize: 22, width: 32, textAlign: 'center' },
  optionsIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optionsRowBody: { flex: 1 },
  optionsRowLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  optionsRowLabelDestructive: { color: '#FF3B30' },
  optionsRowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },

  woevaNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(200,255,0,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(200,255,0,0.15)' },
  woevaNoticeIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(200,255,0,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  woevaNoticeText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: Fonts.regular, lineHeight: 18 },
  walletBtn: { width: 108, height: 30, alignItems: 'center', justifyContent: 'center' },
  walletBadge: { width: 108, height: 30 },

  // QR modal
  qrModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  qrModalCard: { backgroundColor: Colors.white, borderRadius: 28, padding: 32, alignItems: 'center', gap: 8, marginHorizontal: 32 },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold, textAlign: 'center' },
  qrModalSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 8 },
  qrModalCode: { padding: 12, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.grayBorder },
  qrModalHint: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 8 },
});
