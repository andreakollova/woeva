import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Dimensions, Modal, Share, Platform, TextInput, ScrollView as RNScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedScrollHandler,
  useAnimatedStyle, interpolate, Extrapolation,
  withRepeat, withSequence, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Event, Profile } from '@/types';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { useTranslations } from '@/context/LanguageContext';

const { height: SCREEN_H } = Dimensions.get('window');
const COVER_HEIGHT = Math.round(SCREEN_H * 0.48);
const AV = 32;


type Attendee = { id: string; user_id: string; profile: { name: string | null; avatar_url: string | null } | null };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useTranslations();

  const [event, setEvent] = useState<Event | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [isAttending, setIsAttending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [qrModal, setQrModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);

  const waveRot = useSharedValue(0);
  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${waveRot.value}deg` }],
    display: 'flex',
  }));
  React.useEffect(() => {
    waveRot.value = withRepeat(
      withSequence(
        withTiming(25, { duration: 220 }),
        withTiming(-10, { duration: 180 }),
        withTiming(20, { duration: 180 }),
        withTiming(0, { duration: 220 }),
        withTiming(0, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, []);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [0, COVER_HEIGHT], [0, -COVER_HEIGHT * 0.28], Extrapolation.CLAMP),
    }],
  }));

  useFocusEffect(
    React.useCallback(() => { load(); }, [id, user])
  );

  async function load() {
    const { data } = await supabase
      .from('events')
      .select('*, club:clubs(id, name, cover_url)')
      .eq('id', id).single();
    setEvent(data as any);

    if (data?.creator_id && !data?.club_id) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.creator_id).single();
      setCreator(p);
    }
    const { data: attData } = await supabase
      .from('event_attendees')
      .select('id, user_id, profile:profiles(name, avatar_url)')
      .eq('event_id', id).limit(10);
    setAttendees((attData ?? []) as any);

    if (user) {
      const { data: att } = await supabase.from('event_attendees').select('id').eq('event_id', id).eq('user_id', user.id).single();
      setIsAttending(!!att);

      // Unread chat messages
      const lastRead = await AsyncStorage.getItem(`chat_read_${id}`);
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id)
        .gt('created_at', lastRead ?? '1970-01-01T00:00:00Z');
      setUnreadCount(count ?? 0);
      if (data?.club_id) {
        const { data: mem } = await supabase.from('club_members').select('id').eq('club_id', data.club_id).eq('user_id', user.id).single();
        setIsMember(!!mem);
      }
    }
  }

  async function handleJoin() {
    if (!user) { router.push('/(auth)/login'); return; }
    if (event?.is_free || event?.price === 0) {
      setLoading(true);
      await supabase.from('event_attendees').insert({ event_id: id, user_id: user.id, paid: true });
      await supabase.from('events').update({ going_count: (event?.going_count ?? 0) + 1 }).eq('id', id);
      if (event?.creator_id && event.creator_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: event.creator_id, type: 'join',
          title: `New attendee for ${event.title}`,
          body: `${profile?.name ?? 'Someone'} joined your event.`,
          data: { event_id: id },
        });
        const d = new Date(event.date + 'T00:00:00');
        notify.joinedEvent({
          creatorId: event.creator_id,
          attendeeName: profile?.name ?? 'Someone',
          eventTitle: event.title,
          eventDate: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }),
          eventTime: event.time ?? undefined,
          eventId: id,
        });
      }
      setIsAttending(true); setLoading(false); setToast(true); load();
    } else {
      router.push(`/event/${id}/payment`);
    }
  }

  async function handleCancel() {
    if (!cancelReason || !event) return;
    setCancelling(true);

    const eventStart = new Date(`${event.date}T${event.time}`);
    const hoursUntil = (eventStart.getTime() - Date.now()) / 3600000;
    const refundEligible = hoursUntil >= 48;

    await supabase.from('events').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancelReason,
      cancellation_note: cancelNote.trim() || null,
    }).eq('id', id);

    const { data: allAttendees } = await supabase
      .from('event_attendees')
      .select('user_id, paid, payment_intent_id')
      .eq('event_id', id);

    if (allAttendees && allAttendees.length > 0) {
      const hasPaidWithIntent = allAttendees.some(a => a.paid && a.payment_intent_id);
      const notifications = allAttendees.map(a => ({
        user_id: a.user_id,
        type: 'event_cancelled',
        title: `${event.title} was cancelled`,
        body: refundEligible && a.paid && a.payment_intent_id
          ? 'A full refund will be processed to your original payment method.'
          : 'Unfortunately no refund is available for this cancellation.',
        data: { event_id: id },
      }));
      await supabase.from('notifications').insert(notifications);

      // Push + email to all attendees
      const tokens = ((await supabase.from('profiles').select('push_token').in('id', allAttendees.map(a => a.user_id))).data ?? []).map((p: any) => p.push_token).filter(Boolean);
      notify.eventCancelled({
        eventId: id,
        eventTitle: event.title,
        creatorName: profile?.name ?? 'Organiser',
        reason: cancelReason !== t.event.cancelReasons[4] ? cancelReason : cancelNote || undefined,
        attendeeTokens: tokens,
        attendeeEmails: [], // emails require service role — handled server-side if needed
      });

      if (refundEligible && !event.is_free && hasPaidWithIntent) {
        await supabase.functions.invoke('refund-event', { body: { event_id: id } });
      }
    }

    setCancelling(false);
    setCancelModal(false);
    setEvent(prev => prev ? { ...prev, status: 'cancelled' } : prev);
  }

  async function handleInvite() {
    if (!event) return;
    const d = new Date(event.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const venueStr = event.venue ? ` · ${event.venue}` : '';
    const deepLink = `woeva://event/${id}`;
    const storeLink = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/woeva/id000000000'
      : 'https://play.google.com/store/apps/details?id=com.woeva.app';
    const message = `Hey! Join me at ${event.title} 🎉\n${dateStr}${venueStr}\n\nOpen in Woeva: ${deepLink}\n\nDon't have the app? Download here: ${storeLink}`;
    try {
      await Share.share(
        { title: event.title, message, url: event.cover_url ?? storeLink },
        { dialogTitle: 'Invite a friend' }
      );
    } catch {}
  }

  if (!event) return <View style={{ flex: 1, backgroundColor: Colors.white }} />;

  const isCreator = !!user && event.creator_id === user.id;
  const isFree = event.is_free || event.price === 0;
  const priceLabel = isFree ? t.event.freeLabel : `€${event.price}`;
  const eventPast = new Date(`${event.date}T${event.time}`) < new Date();
  const hostName = event.club?.name ?? creator?.name ?? '';
  const hostInitial = hostName.charAt(0).toUpperCase();
  const goingCount = Math.max(event.going_count ?? 0, attendees.length);
  const otherAtts = attendees.filter(a => a.user_id !== user?.id);
  const overflow = Math.max(0, goingCount - 4);

  const d = new Date(event.date + 'T00:00:00');
  const dayName = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const dayNum = d.getDate();
  const monthName = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const isToday = new Date().toDateString() === d.toDateString();

  return (
    <View style={s.container}>
      <Toast visible={toast} title={t.event.joined} subtitle={t.event.eventCreatedSub} onHide={() => setToast(false)} />

      {/* QR fullscreen modal */}
      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <TouchableOpacity style={s.qrModalBg} activeOpacity={1} onPress={() => setQrModal(false)}>
          <View style={s.qrModalCard}>
            <Text style={s.qrModalTitle}>{event?.title}</Text>
            <Text style={s.qrModalSub}>{t.tickets.showAtDoor}</Text>
            <View style={s.qrModalCode}>
              <QRCode value={`woeva:event:${id}:${user?.id}`} size={220} color={Colors.black} backgroundColor={Colors.white} />
            </View>
            <Text style={s.qrModalHint}>{t.tickets.tapToClose}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Cancel modal */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setCancelModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.cancelSheet}>
            <View style={s.cancelSheetHandle} />
            <Text style={s.cancelSheetTitle}>{t.event.cancelEvent}</Text>
            <Text style={s.cancelSheetSub}>{t.event.cancelCannotUndo}</Text>

            {t.event.cancelReasons.map(reason => (
              <TouchableOpacity
                key={reason}
                style={[s.reasonRow, cancelReason === reason && s.reasonRowActive]}
                onPress={() => setCancelReason(reason)}
              >
                <View style={[s.reasonRadio, cancelReason === reason && s.reasonRadioActive]}>
                  {cancelReason === reason && <View style={s.reasonRadioDot} />}
                </View>
                <Text style={[s.reasonText, cancelReason === reason && s.reasonTextActive]}>{reason}</Text>
              </TouchableOpacity>
            ))}

            {cancelReason === t.event.cancelReasons[4] && (
              <TextInput
                style={s.cancelNoteInput}
                value={cancelNote}
                onChangeText={setCancelNote}
                placeholder={t.event.cancelBrieflyExplain}
                placeholderTextColor={Colors.gray}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            )}

            <View style={s.cancelActions}>
              <Button label={t.event.keepEvent} onPress={() => setCancelModal(false)} variant="ghost" />
              <Button
                label={t.event.continueArrow}
                onPress={() => { setCancelModal(false); setConfirmCancelModal(true); }}
                disabled={!cancelReason}
                variant="black"
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Confirm cancel modal */}
      <Modal visible={confirmCancelModal} transparent animationType="slide" onRequestClose={() => setConfirmCancelModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.cancelSheet}>
            <View style={s.cancelSheetHandle} />
            <Text style={s.cancelSheetTitle}>{t.tickets.areYouSure}</Text>
            <Text style={[s.cancelSheetSub, { marginBottom: 8 }]}>
              {t.event.cancelEventConfirm} <Text style={{ fontWeight: '700', color: Colors.black }}>{event?.title}</Text>
            </Text>
            <View style={s.confirmWarningBox}>
              <Text style={s.confirmWarningText}>{t.event.cancelWarning}</Text>
            </View>
            <View style={[s.cancelActions, { marginTop: 20 }]}>
              <Button label={t.event.goBack} onPress={() => { setConfirmCancelModal(false); setCancelModal(true); }} variant="ghost" />
              <Button
                label={t.event.cancelForever}
                onPress={() => { setConfirmCancelModal(false); handleCancel(); }}
                loading={cancelling}
                variant="black"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sticky controls — always on top regardless of scroll ── */}
      <View style={[s.topLeft, { top: insets.top + 10 }]} pointerEvents="box-none">
        <BackButton color={Colors.white} style={s.backBtn} />
      </View>
      {isCreator && event.status !== 'cancelled' && (
        <View style={[s.topRight, { top: insets.top + 10 }]} pointerEvents="box-none">
          <TouchableOpacity style={s.ctrlPill} onPress={() => router.push(`/event/${id}/edit` as any)}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={s.ctrlPillText}>{t.common.edit}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ctrlPill} onPress={() => { setCancelReason(''); setCancelNote(''); setCancelModal(true); }}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[s.ctrlPillText, s.ctrlPillDanger]}>{t.common.cancel}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cover with parallax ── */}
        <View style={[s.coverWrap, { height: COVER_HEIGHT }]}>
          <Animated.View style={[s.coverInner, parallaxStyle]}>
            {event.cover_url
              ? <Image source={{ uri: event.cover_url }} style={s.coverImg} resizeMode="cover" />
              : <View style={[s.coverImg, { backgroundColor: '#111' }]} />
            }
          </Animated.View>

          {/* SVG gradient: transparent → black */}
          <Svg style={s.coverGradient} preserveAspectRatio="none">
            <Defs>
              <SvgGrad id="fadeTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
                <Stop offset="0.25" stopColor="#000" stopOpacity="0.15" />
                <Stop offset="0.55" stopColor="#000" stopOpacity="0.1" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
              </SvgGrad>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fadeTop)" />
          </Svg>


          {/* Title + price + category on cover bottom */}
          <View style={s.coverBottom}>
            {event.category && (
              <View style={s.catPill}>
                <Text style={s.catText}>{event.category.toUpperCase()}</Text>
              </View>
            )}
            <View style={s.coverTitleRow}>
              <Text style={s.coverTitle} numberOfLines={2}>{event.title}</Text>
              <View style={[s.priceBadge, isFree && s.priceBadgeFree]}>
                <Text style={[s.priceText, isFree && s.priceTextFree]}>{priceLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Body ── */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={s.body}>

          {/* ── Cancelled banner ── */}
          {event.status === 'cancelled' && (
            <View style={s.cancelledBanner}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#FF6B6B" strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
              <View style={{ flex: 1 }}>
                <Text style={s.cancelledBannerTitle}>{t.event.eventCancelledLabel}</Text>
                {event.cancellation_reason ? <Text style={s.cancelledBannerSub}>{event.cancellation_reason}{event.cancellation_note ? ` — ${event.cancellation_note}` : ''}</Text> : null}
              </View>
            </View>
          )}

          {/* ── You're going card ── */}
          {isAttending && user && event.status !== 'cancelled' && (
            <TouchableOpacity style={s.goingBanner} onPress={() => router.push('/(tabs)/booked')} activeOpacity={0.85}>
              <View style={s.liveDot} />
              <Text style={s.goingBannerText}>{t.event.youreGoingBanner}</Text>
              <View style={s.goingAvatarRow}>
                  {/* Current user always on top */}
                  <View style={[s.goingAv, s.goingAvUser, { marginLeft: 0, zIndex: 10 }]}>
                    <Text style={s.goingAvInitial}>{(profile?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}</Text>
                    {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={[StyleSheet.absoluteFill, { borderRadius: 13 }]} /> : null}
                  </View>
                  {/* Other attendees — always show 3 */}
                  {Array.from({ length: 3 }).map((_, i) => {
                    const att = otherAtts[i];
                    const avatarUrl = att?.profile?.avatar_url;
                    const initial = (att?.profile?.name ?? '?').charAt(0).toUpperCase();
                    return (
                      <View key={i} style={[s.goingAv, s.goingAvOther, { marginLeft: -6, zIndex: 9 - i }]}>
                        {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.goingAvImg} /> : <Text style={s.goingAvInitial}>{initial}</Text>}
                      </View>
                    );
                  })}
                  {overflow > 0 && <View style={[s.goingAv, s.goingAvOverflow, { marginLeft: -6, zIndex: 8 }]}><Text style={s.goingAvOverflowText}>+{overflow}</Text></View>}
                </View>
              <Text style={s.goingBannerArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* ── Date / Location / Going ── */}
          <View style={s.infoSection}>

            {/* Date + Location with inline QR */}
            <View style={s.infoDateBlock}>
              <View style={{ flex: 1, gap: 16 }}>
                {/* Date row */}
                <View style={s.infoRow}>
                  <View style={s.infoIconBox}>
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                      <Rect x="3" y="4" width="18" height="18" rx="3" stroke={Colors.black} strokeWidth={2} />
                      <Path d="M16 2v4M8 2v4M3 10h18" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoText}>{isToday ? t.event.today : `${dayName}, ${dayNum} ${monthName}`}</Text>
                    {event.time ? <Text style={s.infoSub}>{event.time}{event.duration ? `  ·  ${event.duration}h` : ''}</Text> : null}
                  </View>
                </View>

                {/* Location row */}
                {event.venue ? (
                  <View style={s.infoRow}>
                    <View style={s.infoIconBox}>
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={Colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx="12" cy="9" r="2.5" stroke={Colors.black} strokeWidth={2} />
                      </Svg>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoText}>{event.city ? event.venue.replace(new RegExp(`,?\\s*${event.city}`, 'i'), '').trim() : event.venue}</Text>
                      {event.city ? <Text style={s.infoSub}>{event.city}</Text> : null}
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Inline QR */}
              {isAttending && user ? (
                <TouchableOpacity style={s.inlinQR} onPress={() => setQrModal(true)} activeOpacity={0.8}>
                  <QRCode value={`woeva:event:${id}:${user.id}`} size={48} color={Colors.black} backgroundColor={Colors.white} />
                  <Text style={s.inlinQRHint}>{t.event.ticketLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Going row — hidden when attending (shown in banner) */}
            {!isAttending && (
              <View style={s.infoRow}>
                <View style={s.avatarStack}>
                  {Array.from({ length: 3 }).map((_, i) => {
                    const att = attendees[i];
                    const avatarUrl = att?.profile?.avatar_url;
                    const initial = (att?.profile?.name ?? '?').charAt(0).toUpperCase();
                    return (
                      <View key={i} style={[s.av, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }, !avatarUrl && { backgroundColor: '#888', alignItems: 'center', justifyContent: 'center' }]}>
                        {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.avImg} /> : <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.white }}>{initial}</Text>}
                      </View>
                    );
                  })}
                  {overflow > 0 && <View style={[s.av, s.avOverflow, { marginLeft: -6 }]}><Text style={s.avOverflowText}>+{overflow}</Text></View>}
                </View>
                {goingCount > 0 && <Text style={s.infoSub}>{t.event.going_people(goingCount)}</Text>}
              </View>
            )}
          </View>

          {/* ── About ── */}
          {event.tagline ? (
            <>
              <View style={s.hairline} />
              <View style={s.aboutSection}>
                <Text style={s.aboutText}>{event.tagline}</Text>
              </View>
            </>
          ) : null}

          {/* ── Host ── */}
          {hostName ? (
            <>
              <View style={s.hairline} />
              <TouchableOpacity
                style={s.hostRow}
                onPress={() => event.club ? router.push(`/club/${event.club!.id}`) : null}
                activeOpacity={event.club ? 0.7 : 1}
              >
                {event.club?.cover_url
                  ? <Image source={{ uri: event.club.cover_url }} style={s.hostAvatar} />
                  : <View style={[s.hostAvatar, s.hostAvatarFallback]}><Text style={s.hostAvatarInitial}>{hostInitial}</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={s.hostLabel}>{t.event.hostedBy}</Text>
                  <Text style={s.hostName}>{hostName}</Text>
                </View>
                {isMember
                  ? <View style={s.memberPill}><Text style={s.memberPillText}>{t.event.memberLabel}</Text></View>
                  : user && isAttending && event.club
                    ? <TouchableOpacity style={s.joinPill} onPress={async (e) => {
                        e.stopPropagation?.();
                        await supabase.from('club_members').insert({ club_id: event.club!.id, user_id: user.id, role: 'member', status: 'approved' });
                        setIsMember(true);
                      }}><Text style={s.joinPillText}>{t.event.joinPlus}</Text></TouchableOpacity>
                    : event.club
                      ? <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                      : null
                }
              </TouchableOpacity>
            </>
          ) : null}

          {/* ── Chat ── */}
          <View style={s.hairline} />
          <TouchableOpacity
            style={[s.chatRow, !isAttending && { opacity: 0.4 }]}
            onPress={() => { if (!isAttending) return; setUnreadCount(0); router.push(`/chat/${id}`); }}
            activeOpacity={isAttending ? 0.7 : 1}
          >
            <View style={[s.chatIconBox, !isAttending && { backgroundColor: Colors.grayLight }]}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={isAttending ? Colors.black : Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.chatLabel, !isAttending && { color: Colors.gray }]}>{t.chat.groupChat}</Text>
              <Text style={s.chatSub}>
                {isAttending
                  ? (unreadCount > 0 ? t.event.newMessages(unreadCount) : t.event.chatTapToOpen)
                  : t.event.chatJoinToUnlock}
              </Text>
            </View>
            {isAttending && unreadCount > 0 && <View style={s.unreadBadge}><Text style={s.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
            {isAttending && <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>}
          </TouchableOpacity>

        </Animated.View>
      </Animated.ScrollView>

      {/* ── CTA ── */}
      {event.status !== 'cancelled' && (
        <View style={[s.cta, { paddingBottom: insets.bottom + 12 }]}>
          {!authLoading && !user && (
            <View style={s.guestRow}>
              <Text style={s.guestText}>{t.event.joinToAttend}</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={s.guestLink}>{t.auth.signIn}</Text>
              </TouchableOpacity>
            </View>
          )}
          {user && isAttending && eventPast
            ? (
              <View style={s.attendingRow}>
                <Button label={t.event.youWent} onPress={() => {}} variant="lime" disabled style={s.attendingBtn} textStyle={{ fontSize: 13 }} />
                <TouchableOpacity style={s.ticketBtn} onPress={() => router.push(`/event/${id}/rate` as any)} activeOpacity={0.8}>
                  <Text style={s.ticketBtnEmoji}>★</Text>
                  <Text style={s.ticketBtnText}>{t.tickets.rateEvent}</Text>
                </TouchableOpacity>
              </View>
            )
            : user && isAttending
            ? (
              <View style={s.attendingRow}>
                <Button label={t.event.youreGoing} onPress={() => {}} variant="lime" disabled style={s.attendingBtn} textStyle={{ fontSize: 13 }} />
                <TouchableOpacity style={s.ticketBtn} onPress={handleInvite} activeOpacity={0.8}>
                  <Animated.Text style={[s.ticketBtnEmoji, waveStyle]}>👋</Animated.Text>
                  <Text style={s.ticketBtnText}>{t.event.inviteFriend}</Text>
                </TouchableOpacity>
              </View>
            )
            : <Button
                label={user ? (isFree ? t.event.joinFree : t.event.buyTicket(priceLabel)) : t.event.getWoeva}
                onPress={handleJoin}
                loading={loading}
                variant="lime"
              />
          }
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Cover
  coverWrap: { overflow: 'hidden', backgroundColor: '#111' },
  coverInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -60 },
  coverImg: { width: '100%', height: '100%' },
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topLeft: { position: 'absolute', left: 16, zIndex: 10 },
  topRight: { position: 'absolute', right: 16, flexDirection: 'row', gap: 8, zIndex: 10 },
  backBtn: { backgroundColor: '#000', borderRadius: 20 },
  ctrlPill: { backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ctrlPillText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  ctrlPillDanger: { color: '#FF6B6B' },

  // Cover bottom overlay (title + price on image)
  coverBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, gap: 8 },
  catPill: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  catText: { fontSize: 9, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  coverTitleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  coverTitle: { flex: 1, fontSize: 26, fontWeight: '800', color: Colors.white, letterSpacing: -0.5, lineHeight: 32, fontFamily: Fonts.extrabold },
  coverVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coverVenueText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.regular, flex: 1 },
  priceBadge: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 2 },
  priceBadgeFree: { backgroundColor: Colors.lime },
  priceText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  priceTextFree: { color: Colors.black },

  // Body
  body: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  // Going banner — black card
  goingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.black, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.lime },
  liveText: { fontSize: 9, fontWeight: '800', color: Colors.lime, letterSpacing: 1 },
  goingBannerText: { fontSize: 14, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold, flex: 1 },
  goingAvatarRow: { flexDirection: 'row' },
  goingAv: { width: 26, height: 26, borderRadius: 13, overflow: 'hidden' },
  goingAvImg: { width: 26, height: 26, borderRadius: 13 },
  goingAvUser: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  goingAvOther: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  goingAvInitial: { fontSize: 11, fontWeight: '700', color: Colors.black },
  goingAvOverflow: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  goingAvOverflowText: { fontSize: 7, fontWeight: '800', color: Colors.white },
  goingBannerArrow: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginLeft: 4 },

  // Info section
  infoSection: { paddingHorizontal: 6, paddingTop: 18, paddingBottom: 18, gap: 16 },
  infoDateBlock: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoText: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  infoSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  infoGoingNum: { fontSize: 14, fontWeight: '700', color: Colors.black },
  inlinQR: { backgroundColor: Colors.white, borderRadius: 18, padding: 8, flexShrink: 0, overflow: 'hidden', alignItems: 'center', gap: 4 },
  inlinQRHint: { fontSize: 8, fontWeight: '700', color: Colors.black, letterSpacing: 1, textTransform: 'uppercase' },

  // Hairline + sections
  hairline: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 6 },
  aboutSection: { paddingHorizontal: 6, paddingVertical: 16 },
  aboutText: { fontSize: 14, color: '#555', lineHeight: 21, fontFamily: Fonts.regular },

  // Going avatars
  avatarStack: { flexDirection: 'row' },
  av: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, borderColor: Colors.white, overflow: 'hidden' },
  avImg: { width: AV, height: AV, borderRadius: AV / 2 },
  avUser: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avUserInitial: { fontSize: 13, fontWeight: '700', color: Colors.black },
  avOverflow: { backgroundColor: '#888', alignItems: 'center', justifyContent: 'center', minWidth: AV, width: 'auto', paddingHorizontal: 4 },
  avOverflowText: { fontSize: 7, fontWeight: '800', color: Colors.white },

  // Host
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 6, paddingVertical: 16 },
  hostAvatar: { width: 42, height: 42, borderRadius: 12 },
  hostAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  hostAvatarInitial: { fontSize: 17, fontWeight: '800', color: Colors.black },
  hostLabel: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 1 },
  hostName: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  memberPill: { backgroundColor: Colors.lime, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  memberPillText: { fontSize: 11, fontWeight: '700', color: Colors.black },
  joinPill: { backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6 },
  joinPillText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  // Chat
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 6, paddingVertical: 16 },
  chatIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chatLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  chatSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  chatLocked: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  chatRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadBadge: { backgroundColor: Colors.black, borderRadius: 50, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  divider: { height: 1, backgroundColor: Colors.grayBorder },

  // Cancelled banner
  cancelledBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: '#FFD0D0' },
  cancelledBannerTitle: { fontSize: 14, fontWeight: '700', color: '#CC3333', fontFamily: Fonts.semibold },
  cancelledBannerSub: { fontSize: 12, color: '#AA4444', fontFamily: Fonts.regular, marginTop: 2 },

  // Cancel modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  cancelSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40, gap: 14 },
  cancelSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 8 },
  cancelSheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold },
  cancelSheetSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: -6 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.grayBorder },
  reasonRowActive: { borderColor: Colors.black, backgroundColor: '#F8F8F8' },
  reasonRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.grayBorder, alignItems: 'center', justifyContent: 'center' },
  reasonRadioActive: { borderColor: Colors.black },
  reasonRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.black },
  reasonText: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  reasonTextActive: { color: Colors.black, fontWeight: '600' },
  cancelNoteInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, minHeight: 70 },
  confirmWarningBox: { backgroundColor: '#FFF3F3', borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: '#CC3333' },
  confirmWarningText: { fontSize: 14, color: '#CC3333', fontFamily: Fonts.regular, lineHeight: 22 },
  cancelActions: { flexDirection: 'row', gap: 10, marginTop: 4 },

  // QR modal
  qrModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  qrModalCard: { backgroundColor: Colors.white, borderRadius: 28, padding: 32, alignItems: 'center', gap: 8, marginHorizontal: 32 },
  qrModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold, textAlign: 'center' },
  qrModalSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 8 },
  qrModalCode: { padding: 12, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.grayBorder },
  qrModalHint: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 8 },

  // CTA
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, backgroundColor: Colors.white, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 10 },
  attendingRow: { flexDirection: 'row', gap: 10 },
  attendingBtn: { flex: 1 },
  ticketBtn: { flex: 1.4, height: 56, borderRadius: 50, backgroundColor: Colors.black, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  ticketBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white, fontFamily: Fonts.semibold },
  ticketBtnEmoji: { fontSize: 16 },
  guestRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 4 },
  guestText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  guestLink: { fontSize: 13, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
});
