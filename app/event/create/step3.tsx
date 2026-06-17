import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, Pressable, Image, TextInput, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { Toast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { VenueInput } from '@/components/ui/VenueInput';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { useTranslations } from '@/context/LanguageContext';

import { draft3, clearDrafts } from '@/lib/eventDraft';

export default function CreateStep3Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t, lang } = useTranslations();
  const locale = lang === 'sk' ? 'sk-SK' : 'en-US';
  const params = useLocalSearchParams<{ title: string; tagline: string; tags: string; cover: string; postAs: string }>();

  const [date, setDate] = useState(() => {
    if (draft3.date) return draft3.date;
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d;
  });
  const [time, setTime] = useState(() => {
    if (draft3.time) return draft3.time;
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState(() => {
    if (draft3.endTime) return draft3.endTime;
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); return d;
  });
  const [venue, setVenue] = useState(draft3.venue);
  const [venueLat, setVenueLat] = useState<number | undefined>(draft3.venueLat);
  const [venueLng, setVenueLng] = useState<number | undefined>(draft3.venueLng);
  const [price, setPrice] = useState(draft3.price);
  const [payAtDoor, setPayAtDoor] = useState(draft3.payAtDoor);
  const [isRecurring, setIsRecurring] = useState(draft3.isRecurring);
  const [hasCapacity, setHasCapacity] = useState(draft3.hasCapacity);
  const [capacity, setCapacity] = useState(draft3.capacity);
  const [recurringEndDate, setRecurringEndDate] = useState(() => {
    if (draft3.recurringEndDate) return draft3.recurringEndDate;
    const d = new Date(); d.setDate(d.getDate() + 7); return d;
  });
  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [showRecurringEnd, setShowRecurringEnd] = useState(false);
  const [extraCovers, setExtraCovers] = useState<string[]>(draft3.extraCovers);
  const [toast, setToast] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripePending, setStripePending] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeJustConnected, setStripeJustConnected] = useState(false);

  // Advanced settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hasPublishAt, setHasPublishAt] = useState(false);
  const [publishAtDate, setPublishAtDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d;
  });
  const [publishAtTime, setPublishAtTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(10, 0, 0, 0); return d;
  });
  const [showPublishAtDate, setShowPublishAtDate] = useState(false);
  const [showPublishAtTime, setShowPublishAtTime] = useState(false);
  const [publishAtWeekday, setPublishAtWeekday] = useState<number | null>(null); // 0=Sun..6=Sat, for recurring

  const [hasRegistrationOpens, setHasRegistrationOpens] = useState(draft3.hasRegistrationOpens);
  const [registrationOpensDate, setRegistrationOpensDate] = useState<Date>(() => {
    if (draft3.registrationOpensDate) return draft3.registrationOpensDate;
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d;
  });
  const [registrationOpensTime, setRegistrationOpensTime] = useState<Date>(() => {
    if (draft3.registrationOpensTime) return draft3.registrationOpensTime;
    const d = new Date(); d.setHours(10, 0, 0, 0); return d;
  });
  const [showRegOpensDate, setShowRegOpensDate] = useState(false);
  const [showRegOpensTime, setShowRegOpensTime] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase
      .from('stripe_accounts')
      .select('stripe_account_id, charges_enabled, onboarding_complete')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data?.stripe_account_id) return; // no account yet, nothing to check
        if (data.charges_enabled) {
          setStripeConnected(true);
          setStripePending(false);
          return;
        }
        if (data.onboarding_complete) {
          // Has submitted — do live Stripe check to get real status
          setStripePending(true);
          try {
            const res = await supabase.functions.invoke('create-connect-account', {
              body: { return_url: 'https://woeva.com/stripe-success?from=create' },
            });
            if (res.data?.already_connected) {
              setStripeConnected(true);
              setStripePending(false);
            }
          } catch (_) {}
        }
      });
  }, [user]));

  // Auto-poll Stripe status every 5s while pending
  useEffect(() => {
    if (!stripePending || stripeConnected) return;
    const interval = setInterval(async () => {
      try {
        const res = await supabase.functions.invoke('create-connect-account', {
          body: { return_url: 'https://woeva.com/stripe-success?from=create' },
        });
        if (res.data?.already_connected) {
          setStripeConnected(true);
          setStripePending(false);
          setStripeJustConnected(true);
          clearInterval(interval);
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [stripePending, stripeConnected]);

  async function connectStripe() {
    setConnectingStripe(true);
    try {
      const res = await supabase.functions.invoke('create-connect-account', {
        body: { return_url: 'https://woeva.com/stripe-success?from=create' },
      });
      if (res.data?.error) { Alert.alert('Chyba', res.data.error); return; }
      if (res.data?.already_connected) {
        setStripeConnected(true);
        setStripePending(false);
        setStripeJustConnected(true);
        return;
      }
      if (res.data?.pending_review) {
        setStripePending(true);
        return;
      }
      if (res.data?.url) {
        await WebBrowser.openBrowserAsync(res.data.url);
        // Poll every 2s for up to 30s until Stripe confirms charges_enabled
        let connected = false;
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const recheck = await supabase.functions.invoke('create-connect-account', {
              body: { return_url: 'https://woeva.com/stripe-success?from=create' },
            });
            if (recheck.data?.already_connected) {
              setStripeConnected(true);
              setStripePending(false);
              setStripeJustConnected(true);
              connected = true;
              break;
            }
          } catch (_) {}
        }
        if (!connected) setStripePending(true);
      }
    } catch (e: any) {
      Alert.alert('Chyba', e?.message ?? 'Nepodarilo sa pripojiť Stripe.');
    }
    setConnectingStripe(false);
  }

  // Keep draft in sync
  useEffect(() => {
    draft3.date = date; draft3.time = time; draft3.endTime = endTime;
    draft3.venue = venue; draft3.venueLat = venueLat; draft3.venueLng = venueLng;
    draft3.price = price; draft3.payAtDoor = payAtDoor;
    draft3.isRecurring = isRecurring; draft3.recurringEndDate = recurringEndDate;
    draft3.extraCovers = extraCovers;
    draft3.hasCapacity = hasCapacity; draft3.capacity = capacity;
    draft3.hasRegistrationOpens = hasRegistrationOpens;
    draft3.registrationOpensDate = registrationOpensDate;
    draft3.registrationOpensTime = registrationOpensTime;
  }, [date, time, endTime, venue, venueLat, venueLng, price, payAtDoor, isRecurring, recurringEndDate, extraCovers, hasCapacity, capacity, hasRegistrationOpens, registrationOpensDate, registrationOpensTime]);

  async function handleShare() {
    if (!venue.trim()) { Alert.alert(t.event.missingVenue, t.event.missingVenueMsg); return; }
    if (!params.title) { Alert.alert(t.event.missingTitle, t.event.missingTitleMsg); return; }
    const priceVal = parseFloat(price) || 0;
    if (priceVal > 0 && !payAtDoor && !stripeConnected) {
      router.push('/dashboard?tab=payouts' as any);
      return;
    }
    // Validate date+time is in the future
    const eventDateTime = new Date(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}:00`);
    if (eventDateTime <= new Date()) { Alert.alert(lang === 'sk' ? 'Neplatný čas' : 'Invalid time', lang === 'sk' ? 'Čas začiatku musí byť v budúcnosti.' : 'Start time must be in the future.'); return; }
    setLoading(true);

    const currentUser = user;
    if (!currentUser) { setLoading(false); Alert.alert(t.event.notLoggedIn, t.event.notLoggedInMsg); return; }

    const eventDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const eventTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const eventEndTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
    const durationMs = endTime.getTime() - time.getTime();
    const durationHours = durationMs > 0 ? durationMs / 3600000 : 2;
    const priceNum = parseFloat(price) || 0;
    const isPayAtDoor = payAtDoor && priceNum > 0;
    if (!isPayAtDoor && priceNum > 0 && priceNum < 0.5) {
      setLoading(false);
      Alert.alert('Minimálna cena', 'Minimálna cena ticketu je €0.50.');
      return;
    }

    // Find club by ID (postAs is a club UUID or 'individual')
    const postAsClub = params.postAs !== 'individual' && !!params.postAs;
    const { data: clubData } = postAsClub
      ? await supabase.from('clubs').select('id, name').eq('id', params.postAs).single()
      : { data: null };

    // Upload cover image(s)
    let cover_url: string | null = null;
    if (params.cover) {
      cover_url = await uploadImage(params.cover, 'event-covers', `${Date.now()}.jpg`);
      if (!cover_url) {
        setLoading(false);
        Alert.alert('Upload failed', 'Could not upload cover image. Please try again.');
        return;
      }
    }
    const cover_urls: string[] = cover_url ? [cover_url] : [];
    for (const uri of extraCovers) {
      const uploaded = await uploadImage(uri, 'event-covers', `${Date.now()}_${cover_urls.length}.jpg`);
      if (uploaded) cover_urls.push(uploaded);
    }

    const parsedTags = (() => { try { return JSON.parse(params.tags || '[]'); } catch { return []; } })();
    const VALID_CATS = ['Movement & Sport', 'Wellness & Body', 'Food & Drinks', 'Art & Creation', 'Music & Nightlife', 'Learning & Mind', 'Community & Belonging'];
    const firstTag = parsedTags[0] || '';
    const safeCategory = VALID_CATS.includes(firstTag) ? firstTag : (parsedTags.find((t: string) => VALID_CATS.includes(t)) ?? 'Community & Belonging');

    const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
      'Bratislava': { lat: 48.1486, lng: 17.1077 },
      'Košice':     { lat: 48.7164, lng: 21.2611 },
      'Žilina':     { lat: 49.2231, lng: 18.7394 },
      'Prešov':     { lat: 49.0018, lng: 21.2396 },
      'Nitra':      { lat: 48.3069, lng: 18.0873 },
      'Banská Bystrica': { lat: 48.7395, lng: 19.1528 },
      'Trnava':     { lat: 48.3774, lng: 17.5878 },
      'Trenčín':    { lat: 48.8943, lng: 18.0438 },
    };
    const MAX_CITY_RADIUS_KM = 40;
    function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
      const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    const eventCity = profile?.city ?? 'Bratislava';
    const cityCenter = CITY_CENTERS[eventCity];
    let safeLat = venueLat ?? null;
    let safeLng = venueLng ?? null;
    if (safeLat != null && safeLng != null && cityCenter) {
      if (distKm(safeLat, safeLng, cityCenter.lat, cityCenter.lng) > MAX_CITY_RADIUS_KM) {
        safeLat = cityCenter.lat;
        safeLng = cityCenter.lng;
      }
    } else if (cityCenter && (safeLat == null || safeLng == null)) {
      safeLat = cityCenter.lat;
      safeLng = cityCenter.lng;
    }

    const { data, error } = await supabase.from('events').insert({
      creator_id: currentUser.id,
      club_id: clubData?.id ?? null,
      title: String(params.title).trim().slice(0, 120),
      tagline: String(params.tagline || '').trim().slice(0, 300),
      category: safeCategory,
      cover_url,
      ...(cover_urls.length > 1 ? { cover_urls } : {}),
      date: eventDate,
      time: eventTime,
      duration: durationHours,
      venue: venue.trim(),
      lat: safeLat,
      lng: safeLng,
      price: priceNum,
      is_free: priceNum === 0,
      pay_at_door: isPayAtDoor,
      is_recurring: isRecurring,
      recurring_end_date: isRecurring ? `${recurringEndDate.getFullYear()}-${String(recurringEndDate.getMonth() + 1).padStart(2, '0')}-${String(recurringEndDate.getDate()).padStart(2, '0')}` : null,
      capacity: hasCapacity && capacity ? parseInt(capacity, 10) : null,
      going_count: 0,
      city: eventCity,
      publish_at: hasPublishAt ? (() => {
        if (isRecurring && publishAtWeekday !== null) {
          // For recurring: compute publish_at for the FIRST occurrence
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          let attempts = 0;
          while (d.getDay() !== publishAtWeekday && attempts < 7) { d.setDate(d.getDate() - 1); attempts++; }
          d.setHours(publishAtTime.getHours(), publishAtTime.getMinutes(), 0, 0);
          return d.toISOString();
        }
        const d = new Date(publishAtDate);
        d.setHours(publishAtTime.getHours(), publishAtTime.getMinutes(), 0, 0);
        return d.toISOString();
      })() : null,
      recurring_open_weekday: isRecurring && hasPublishAt && publishAtWeekday !== null ? publishAtWeekday : null,
      recurring_open_time: isRecurring && hasPublishAt && publishAtWeekday !== null ? `${publishAtTime.getHours().toString().padStart(2, '0')}:${publishAtTime.getMinutes().toString().padStart(2, '0')}` : null,
      registration_opens_at: hasRegistrationOpens ? (() => {
        const d = new Date(registrationOpensDate);
        d.setHours(registrationOpensTime.getHours(), registrationOpensTime.getMinutes(), 0, 0);
        return d.toISOString();
      })() : null,
      registration_notified: false,
    }).select().single();

    if (!error && data) {
      // Send push + in-app notifications to club members
      let clubMemberUserIds: string[] = [];
      if (clubData?.id) {
        const { data: members } = await supabase
          .from('club_members')
          .select('user_id, profile:profiles(push_token)')
          .eq('club_id', clubData.id)
          .eq('status', 'approved')
          .neq('user_id', currentUser.id);

        // Deduplicate by user_id (user may appear multiple times as member+admin)
        const seenIds = new Set<string>();
        const dedupedMembers = (members ?? []).filter((m: any) => {
          if (seenIds.has(m.user_id)) return false;
          seenIds.add(m.user_id);
          return true;
        });

        const memberTokens = dedupedMembers.map((m: any) => m.profile?.push_token).filter(Boolean);
        const memberUserIds = dedupedMembers.map((m: any) => m.user_id);
        clubMemberUserIds = memberUserIds;

        const { data: memberProfiles } = await supabase
          .from('profiles').select('email').in('id', memberUserIds);
        const memberEmails = (memberProfiles ?? []).map((p: any) => p.email).filter(Boolean);

        // In-app notifications (deduplicated)
        const inAppNotifs = dedupedMembers.map((m: any) => ({
          user_id: m.user_id, type: 'club_event',
          title: `${clubData.name ?? 'Tvoj klub'} zdieľa nový event!`,
          body: `${String(params.title)} 🎉`,
          data: { event_id: data.id },
        }));
        if (inAppNotifs.length > 0) {
          await supabase.from('notifications').insert(inAppNotifs);
        }

        // Push + email via notify helper
        notify.newClubEvent({
          clubName: clubData.name ?? 'your club',
          eventId: data.id,
          eventTitle: String(params.title),
          eventDate: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }),
          eventTime: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
          venue: venue.trim() || undefined,
          memberTokens,
          memberEmails,
        });
      }

    }

    setLoading(false);
    if (error) { Alert.alert(t.event.couldNotCreate, error.message); return; }
    clearDrafts();
    setToast(true);
    setTimeout(() => router.replace('/event/create/published'), 1000);
  }

  const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  const endTimeStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 4, paddingBottom: 0 }]}
        keyboardShouldPersistTaps="always"
      >
        {/* Header */}
        <View style={styles.stepRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </View>
          <WMark size={80} color={Colors.lime} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={styles.stepBadge}><Text style={styles.stepText}>{t.event.step(3, 3)}</Text></View>
          </View>
        </View>
        <Text style={styles.title}>{t.event.whenWhere}</Text>

        <View style={styles.form}>
          {/* Venue - first field */}
          <VenueInput
            value={venue}
            onChange={(v, lat, lng) => {
              setVenue(v);
              setVenueLat(lat);
              setVenueLng(lng);
            }}
          />
          {/* Date */}
          <View>
            <Text style={styles.label}>{t.event.date}</Text>
            <TouchableOpacity style={styles.field} onPress={() => setShowDate(true)}>
              <Text style={styles.fieldValue}>{dateStr}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(_, d) => { setShowDate(false); if (d) { setDate(d); const end = new Date(d); end.setDate(end.getDate() + 7); setRecurringEndDate(end); } }}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* Time + End time row */}
          <View style={styles.halfRow}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>{t.event.time}</Text>
              <TouchableOpacity style={styles.field} onPress={() => { setShowTime(true); setShowEndTime(false); }}>
                <Text style={styles.fieldValue}>{timeStr}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.label}>{t.event.endTime}</Text>
              <TouchableOpacity style={styles.field} onPress={() => { setShowEndTime(true); setShowTime(false); }}>
                <Text style={styles.fieldValue}>{endTimeStr}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showTime && (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              onChange={(_, t) => {
                setShowTime(false);
                if (t) {
                  setTime(t);
                  setEndTime(prev => {
                    const diff = prev.getTime() - time.getTime();
                    return new Date(t.getTime() + Math.max(diff, 3600000));
                  });
                }
              }}
            />
          )}
          {showEndTime && (
            <DateTimePicker
              value={endTime}
              mode="time"
              display="spinner"
              onChange={(_, t) => {
                setShowEndTime(false);
                if (t) setEndTime(t);
              }}
            />
          )}

          {/* Price */}
          <Input
            label={t.event.price}
            value={price}
            onChangeText={(v) => {
              setPrice(v);
            }}
            onBlur={() => {
              const n = parseFloat(price);
              if (n > 0 && n < 0.5) setPrice('0.50');
            }}
            placeholder="0"
            keyboardType="numeric"
          />
          {parseFloat(price) > 0 && parseFloat(price) < 0.5 && !payAtDoor && (
            <Text style={{ fontSize: 12, color: '#FF3B30', marginTop: -8, marginBottom: 4 }}>
              Minimálna cena je €0.50
            </Text>
          )}
          {parseFloat(price) > 0 && !payAtDoor && stripeJustConnected && (
            <View style={[styles.stripeNotice, { backgroundColor: '#1a1a1a' }]}>
              <Text style={styles.stripeIcon}>✅</Text>
              <View style={styles.stripeText}>
                <Text style={styles.stripeTitle}>Stripe prepojený!</Text>
                <Text style={styles.stripeSub}>Môžeš prijímať online platby za eventy.</Text>
              </View>
            </View>
          )}
          {parseFloat(price) > 0 && !payAtDoor && !stripeConnected && stripePending && (
            <TouchableOpacity style={[styles.stripeNotice, { backgroundColor: '#7c5200' }]} onPress={connectStripe} activeOpacity={0.85} disabled={connectingStripe}>
              <Text style={styles.stripeIcon}>⏳</Text>
              <View style={styles.stripeText}>
                <Text style={styles.stripeTitle}>Stripe overuje tvoj účet</Text>
                <Text style={styles.stripeSub}>Zvyčajne to trvá pár minút.</Text>
                <Text style={styles.stripeLink}>{connectingStripe ? 'Kontrolujem...' : 'Skontrolovať stav'}</Text>
              </View>
            </TouchableOpacity>
          )}
          {parseFloat(price) > 0 && !payAtDoor && !stripeConnected && !stripePending && (
            <TouchableOpacity style={styles.stripeNotice} onPress={connectStripe} activeOpacity={0.85} disabled={connectingStripe}>
              <Text style={styles.stripeIcon}>💳</Text>
              <View style={styles.stripeText}>
                <Text style={styles.stripeTitle}>Zatiaľ nemôžeš prijímať platby</Text>
                <Text style={styles.stripeSub}>{t.event.stripeRequiredSub}</Text>
                <Text style={styles.stripeLink}>{connectingStripe ? 'Otváranie...' : t.event.setUpPayments}</Text>
              </View>
            </TouchableOpacity>
          )}
          {parseFloat(price) > 0 && (
            <TouchableOpacity style={styles.recurringRow} onPress={() => setPayAtDoor(r => !r)} activeOpacity={0.7}>
              <View style={styles.recurringText}>
                <Text style={styles.recurringTitle}>{lang === 'sk' ? 'Platba na mieste' : 'Pay at door'}</Text>
                <Text style={styles.recurringSub}>{lang === 'sk' ? 'Zákazníci platia hotovosťou alebo kartou na mieste.' : 'Customers pay cash or card at the venue.'}</Text>
              </View>
              <View style={[styles.toggle, payAtDoor && styles.toggleOn]}>
                <View style={[styles.toggleThumb, payAtDoor && styles.toggleThumbOn]} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Pokročilé nastavenia ── */}
          <View style={styles.advancedWrap}>
            <TouchableOpacity style={styles.advancedHeader} onPress={() => setAdvancedOpen(o => !o)} activeOpacity={0.75}>
              <Text style={styles.advancedTitle}>Pokročilé nastavenia</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: advancedOpen ? '180deg' : '0deg' }] }}>
                <Path d="M6 9l6 6 6-6" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {advancedOpen && (
              <View style={styles.advancedBody}>
                {/* Recurring toggle */}
                <TouchableOpacity style={styles.recurringRow} onPress={() => setIsRecurring(r => !r)} activeOpacity={0.7}>
                  <View style={styles.recurringText}>
                    <Text style={styles.recurringTitle}>{t.event.repeatWeekly}</Text>
                    <Text style={styles.recurringSub}>{t.event.repeatSub}</Text>
                  </View>
                  <View style={[styles.toggle, isRecurring && styles.toggleOn]}>
                    <View style={[styles.toggleThumb, isRecurring && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>

                {isRecurring && (() => {
                  const weeks = Math.max(1, Math.floor((recurringEndDate.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)));
                  return (
                    <View>
                      <Text style={styles.label}>{lang === 'sk' ? 'Opakovať event do' : 'Repeat until'}</Text>
                      <TouchableOpacity style={[styles.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setShowRecurringEnd(true)} activeOpacity={0.7}>
                        <Text style={styles.fieldValue}>{recurringEndDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                        <Text style={styles.selectDateLink}>{lang === 'sk' ? 'Vybrať dátum' : 'Select date'}</Text>
                      </TouchableOpacity>
                      <Modal visible={showRecurringEnd} transparent animationType="slide" onRequestClose={() => setShowRecurringEnd(false)}>
                        <Pressable style={styles.modalOverlay} onPress={() => setShowRecurringEnd(false)}>
                          <Pressable style={styles.calendarSheet} onPress={() => {}}>
                            <View style={styles.calendarHandle} />
                            <Text style={styles.durationSheetTitle}>{lang === 'sk' ? 'Opakovať do' : 'Repeat until'}</Text>
                            <DateTimePicker
                              value={recurringEndDate}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'inline' : 'default'}
                              minimumDate={new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000)}
                              onChange={(_, d) => {
                                if (Platform.OS === 'android') setShowRecurringEnd(false);
                                if (d) setRecurringEndDate(d);
                              }}
                              style={Platform.OS === 'ios' ? { alignSelf: 'center' } : undefined}
                              themeVariant="light"
                              accentColor={Colors.black}
                            />
                            {Platform.OS === 'ios' && (
                              <TouchableOpacity style={styles.calendarDone} onPress={() => setShowRecurringEnd(false)} activeOpacity={0.8}>
                                <Text style={styles.calendarDoneText}>{lang === 'sk' ? 'Hotovo' : 'Done'}</Text>
                              </TouchableOpacity>
                            )}
                          </Pressable>
                        </Pressable>
                      </Modal>
                      <Text style={styles.recurringWeeksHint}>{weeks} {weeks === 1 ? 'týždeň' : weeks < 5 ? 'týždne' : 'týždňov'}</Text>
                    </View>
                  );
                })()}

                {/* Capacity toggle */}
                <TouchableOpacity style={styles.recurringRow} onPress={() => setHasCapacity(r => !r)} activeOpacity={0.7}>
                  <View style={styles.recurringText}>
                    <Text style={styles.recurringTitle}>{lang === 'sk' ? 'Obmedzená kapacita' : 'Limited capacity'}</Text>
                    <Text style={styles.recurringSub}>{lang === 'sk' ? 'Nastav maximálny počet účastníkov.' : 'Set a maximum number of attendees.'}</Text>
                  </View>
                  <View style={[styles.toggle, hasCapacity && styles.toggleOn]}>
                    <View style={[styles.toggleThumb, hasCapacity && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>
                {hasCapacity && (
                  <View>
                    <Text style={styles.label}>{lang === 'sk' ? 'Maximálny počet miest' : 'Max attendees'}</Text>
                    <TextInput
                      style={styles.field}
                      value={capacity}
                      onChangeText={v => setCapacity(v.replace(/[^0-9]/g, ''))}
                      placeholder={lang === 'sk' ? 'napr. 30' : 'e.g. 30'}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                )}

                {/* Publish At toggle */}
                <TouchableOpacity style={styles.recurringRow} onPress={() => setHasPublishAt(v => !v)} activeOpacity={0.7}>
                  <View style={styles.recurringText}>
                    <Text style={styles.recurringTitle}>Definovať čas zobrazenia</Text>
                    <Text style={styles.recurringSub}>Event bude viditeľný a otvorený na prihlásenie až od nastaveného času.</Text>
                  </View>
                  <View style={[styles.toggle, hasPublishAt && styles.toggleOn]}>
                    <View style={[styles.toggleThumb, hasPublishAt && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>

                {hasPublishAt && (
                  <View style={styles.publishAtBox}>
                    <Text style={styles.publishAtLabel}>Zobraziť od:</Text>

                    {isRecurring ? (
                      // Recurring: pick weekday + time
                      <View style={{ gap: 10 }}>
                        <View style={styles.weekdayRow}>
                          {['Ne','Po','Ut','St','Št','Pi','So'].map((label, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[styles.weekdayPill, publishAtWeekday === idx && styles.weekdayPillActive]}
                              onPress={() => setPublishAtWeekday(publishAtWeekday === idx ? null : idx)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.weekdayPillText, publishAtWeekday === idx && styles.weekdayPillTextActive]}>{label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity style={[styles.field, { alignSelf: 'flex-start', minWidth: 90 }]} onPress={() => setShowPublishAtTime(true)} activeOpacity={0.7}>
                          <Text style={styles.fieldValue}>{`${publishAtTime.getHours().toString().padStart(2,'0')}:${publishAtTime.getMinutes().toString().padStart(2,'0')}`}</Text>
                        </TouchableOpacity>
                        <Text style={styles.publishAtHint}>Každý týždeň sa event otvorí v tento deň a čas.</Text>
                      </View>
                    ) : (
                      // One-time: pick date + time
                      <View style={{ gap: 10 }}>
                        <View style={styles.publishAtRow}>
                          <TouchableOpacity style={[styles.field, styles.publishAtField]} onPress={() => setShowPublishAtDate(true)} activeOpacity={0.7}>
                            <Text style={styles.fieldValue}>{publishAtDate.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.field, styles.publishAtField]} onPress={() => setShowPublishAtTime(true)} activeOpacity={0.7}>
                            <Text style={styles.fieldValue}>{`${publishAtTime.getHours().toString().padStart(2,'0')}:${publishAtTime.getMinutes().toString().padStart(2,'0')}`}</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.publishAtHint}>Ľudia sa môžu prihlasovať až od tohto momentu.</Text>
                      </View>
                    )}

                    {/* PublishAt Date Modal (one-time only) */}
                    {!isRecurring && (
                      <Modal visible={showPublishAtDate} transparent animationType="slide" onRequestClose={() => setShowPublishAtDate(false)}>
                        <Pressable style={styles.modalOverlay} onPress={() => setShowPublishAtDate(false)}>
                          <Pressable style={styles.calendarSheet} onPress={() => {}}>
                            <View style={styles.calendarHandle} />
                            <Text style={styles.durationSheetTitle}>Dátum zobrazenia</Text>
                            <DateTimePicker
                              value={publishAtDate}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'inline' : 'default'}
                              maximumDate={date}
                              onChange={(_, d) => {
                                if (Platform.OS === 'android') setShowPublishAtDate(false);
                                if (d) setPublishAtDate(d);
                              }}
                              style={Platform.OS === 'ios' ? { alignSelf: 'center' } : undefined}
                              themeVariant="light"
                              accentColor={Colors.black}
                            />
                            {Platform.OS === 'ios' && (
                              <TouchableOpacity style={styles.calendarDone} onPress={() => setShowPublishAtDate(false)} activeOpacity={0.8}>
                                <Text style={styles.calendarDoneText}>Hotovo</Text>
                              </TouchableOpacity>
                            )}
                          </Pressable>
                        </Pressable>
                      </Modal>
                    )}

                    {/* PublishAt Time Modal */}
                    <Modal visible={showPublishAtTime} transparent animationType="slide" onRequestClose={() => setShowPublishAtTime(false)}>
                      <Pressable style={styles.modalOverlay} onPress={() => setShowPublishAtTime(false)}>
                        <Pressable style={styles.calendarSheet} onPress={() => {}}>
                          <View style={styles.calendarHandle} />
                          <Text style={styles.durationSheetTitle}>Čas zobrazenia</Text>
                          <DateTimePicker
                            value={publishAtTime}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_, t) => {
                              if (Platform.OS === 'android') setShowPublishAtTime(false);
                              if (t) setPublishAtTime(t);
                            }}
                            themeVariant="light"
                          />
                          {Platform.OS === 'ios' && (
                            <TouchableOpacity style={styles.calendarDone} onPress={() => setShowPublishAtTime(false)} activeOpacity={0.8}>
                              <Text style={styles.calendarDoneText}>Hotovo</Text>
                            </TouchableOpacity>
                          )}
                        </Pressable>
                      </Pressable>
                    </Modal>
                  </View>
                )}

                {/* Registration opens toggle */}
                <TouchableOpacity style={styles.recurringRow} onPress={() => setHasRegistrationOpens(v => !v)} activeOpacity={0.7}>
                  <View style={styles.recurringText}>
                    <Text style={styles.recurringTitle}>Otvorenie prihlasovania</Text>
                    <Text style={styles.recurringSub}>Členovia klubu dostanú push notifikáciu keď sa otvorí prihlasovanie.</Text>
                  </View>
                  <View style={[styles.toggle, hasRegistrationOpens && styles.toggleOn]}>
                    <View style={[styles.toggleThumb, hasRegistrationOpens && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>

                {hasRegistrationOpens && (
                  <View style={styles.publishAtBox}>
                    <Text style={styles.publishAtLabel}>Prihlasovanie sa otvorí:</Text>
                    <View style={styles.publishAtRow}>
                      <TouchableOpacity style={[styles.field, styles.publishAtField]} onPress={() => setShowRegOpensDate(true)} activeOpacity={0.7}>
                        <Text style={styles.fieldValue}>{registrationOpensDate.toLocaleDateString('sk-SK', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.field, styles.publishAtField]} onPress={() => setShowRegOpensTime(true)} activeOpacity={0.7}>
                        <Text style={styles.fieldValue}>{`${registrationOpensTime.getHours().toString().padStart(2,'0')}:${registrationOpensTime.getMinutes().toString().padStart(2,'0')}`}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.publishAtHint}>V tento čas dostanú členovia klubu notifikáciu 🎟️</Text>

                    <Modal visible={showRegOpensDate} transparent animationType="slide" onRequestClose={() => setShowRegOpensDate(false)}>
                      <Pressable style={styles.modalOverlay} onPress={() => setShowRegOpensDate(false)}>
                        <Pressable style={styles.calendarSheet} onPress={() => {}}>
                          <View style={styles.calendarHandle} />
                          <Text style={styles.durationSheetTitle}>Dátum otvorenia</Text>
                          <DateTimePicker
                            value={registrationOpensDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            maximumDate={date}
                            onChange={(_, d) => {
                              if (Platform.OS === 'android') setShowRegOpensDate(false);
                              if (d) setRegistrationOpensDate(d);
                            }}
                            style={Platform.OS === 'ios' ? { alignSelf: 'center' } : undefined}
                            themeVariant="light"
                            accentColor={Colors.black}
                          />
                          {Platform.OS === 'ios' && (
                            <TouchableOpacity style={styles.calendarDone} onPress={() => setShowRegOpensDate(false)} activeOpacity={0.8}>
                              <Text style={styles.calendarDoneText}>Hotovo</Text>
                            </TouchableOpacity>
                          )}
                        </Pressable>
                      </Pressable>
                    </Modal>

                    <Modal visible={showRegOpensTime} transparent animationType="slide" onRequestClose={() => setShowRegOpensTime(false)}>
                      <Pressable style={styles.modalOverlay} onPress={() => setShowRegOpensTime(false)}>
                        <Pressable style={styles.calendarSheet} onPress={() => {}}>
                          <View style={styles.calendarHandle} />
                          <Text style={styles.durationSheetTitle}>Čas otvorenia</Text>
                          <DateTimePicker
                            value={registrationOpensTime}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(_, t) => {
                              if (Platform.OS === 'android') setShowRegOpensTime(false);
                              if (t) setRegistrationOpensTime(t);
                            }}
                            themeVariant="light"
                          />
                          {Platform.OS === 'ios' && (
                            <TouchableOpacity style={styles.calendarDone} onPress={() => setShowRegOpensTime(false)} activeOpacity={0.8}>
                              <Text style={styles.calendarDoneText}>Hotovo</Text>
                            </TouchableOpacity>
                          )}
                        </Pressable>
                      </Pressable>
                    </Modal>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Rotating cover photos — only when recurring is on */}
          {isRecurring && (() => {
            const weeks = Math.max(1, Math.floor((recurringEndDate.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)));
            const maxPhotos = Math.min(5, weeks) - 1; // -1 because primary cover from step2 counts as slot 1
            return (
            <View style={{ gap: 16 }}>
              {/* Rotating cover photos */}
              <View>
                <Text style={styles.label}>Striedajúce sa obrázky</Text>
                <View style={styles.rotatingDivider} />
                <Text style={styles.rotatingSub}>Pridaj až {maxPhotos + 1} {maxPhotos + 1 === 1 ? 'fotku' : maxPhotos + 1 < 5 ? 'fotky' : 'fotiek'} – každý týždeň sa zobrazí iná.</Text>
                <View style={styles.rotatingRow}>
                  {params.cover ? (
                    <View style={styles.rotatingThumbWrap}>
                      <Image source={{ uri: params.cover }} style={styles.rotatingThumb} />
                      <View style={styles.rotatingBadge}><Text style={styles.rotatingBadgeText}>1</Text></View>
                    </View>
                  ) : null}
                  {extraCovers.map((uri, i) => (
                    <View key={i} style={styles.rotatingThumbWrap}>
                      <Image source={{ uri }} style={styles.rotatingThumb} />
                      <TouchableOpacity
                        style={styles.rotatingRemove}
                        onPress={() => setExtraCovers(prev => prev.filter((_, j) => j !== i))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.rotatingRemoveText}>×</Text>
                      </TouchableOpacity>
                      <View style={styles.rotatingBadge}><Text style={styles.rotatingBadgeText}>{i + 2}</Text></View>
                    </View>
                  ))}
                  {extraCovers.length < maxPhotos && (
                    <TouchableOpacity
                      style={styles.rotatingAdd}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
                        if (!result.canceled) {
                          const src = result.assets[0].uri;
                          try {
                            const dest = `${FileSystem.cacheDirectory}cover_extra_${Date.now()}.jpg`;
                            await FileSystem.copyAsync({ from: src, to: dest });
                            setExtraCovers(prev => [...prev, dest]);
                          } catch {
                            setExtraCovers(prev => [...prev, src]);
                          }
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.rotatingAddPlus}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
            );
          })()}

        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Button label={t.event.shareEvent} onPress={handleShare} loading={loading} variant="black" />
          <Button label={t.common.back} onPress={() => router.back()} variant="ghost" />
        </View>
      </ScrollView>
      <Toast visible={toast} title={t.event.eventCreated} subtitle={t.event.eventCreatedSub} onHide={() => setToast(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stepBadge: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  stepText: { fontSize: 13, fontWeight: '600', color: Colors.black },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, marginBottom: 16, letterSpacing: -0.5 },
  form: { gap: 20 },
  label: { fontSize: 13, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  field: { height: 44, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  fieldValue: { fontSize: 14, color: Colors.black },
  row: { flexDirection: 'row', gap: 12 },
  halfRow: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  durationSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  durationSheetTitle: { fontSize: 15, fontWeight: '700', color: Colors.black, marginBottom: 12 },
  durationOption: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  durationOptionBorder: { borderBottomWidth: 1, borderColor: Colors.grayBorder },
  durationOptionText: { fontSize: 15, color: Colors.black },
  durationOptionActive: { fontWeight: '600' },
  durationCheck: { fontSize: 16, color: Colors.black, fontWeight: '600' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: Colors.black, marginTop: -1 },
  rotatingSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginBottom: 10 },
  rotatingRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  rotatingThumbWrap: { width: 80, height: 56, borderRadius: 10, overflow: 'visible', position: 'relative' },
  rotatingThumb: { width: 80, height: 56, borderRadius: 10 },
  rotatingBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  rotatingBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  rotatingRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  rotatingRemoveText: { fontSize: 14, color: Colors.white, lineHeight: 16 },
  rotatingAdd: { width: 80, height: 56, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.grayBorder, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  rotatingAddPlus: { fontSize: 24, color: Colors.gray },
  footer: { paddingTop: 16, gap: 8 },
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14 },
  recurringText: { flex: 1 },
  recurringTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  recurringSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
  recurringEndBox: { height: 52, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recurringEndLabel: { fontSize: 15, color: Colors.black, fontFamily: Fonts.regular, flex: 1 },
  recurringWeeksHint: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 5, marginLeft: 1 },
  selectDateLink: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, textDecorationLine: 'underline' },
  calendarSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  calendarHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 16 },
  calendarDone: { marginTop: 12, backgroundColor: Colors.black, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  calendarDoneText: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.semibold },
  rotatingDivider: { height: 1, backgroundColor: Colors.grayBorder, marginVertical: 8 },
  advancedWrap: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 14, overflow: 'hidden' },
  advancedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  advancedTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  advancedBody: { borderTopWidth: 1, borderTopColor: Colors.grayBorder, gap: 12, padding: 12 },
  publishAtBox: { backgroundColor: Colors.grayLight, borderRadius: 12, padding: 12, gap: 8 },
  publishAtLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  publishAtRow: { flexDirection: 'row', gap: 10 },
  publishAtField: { flex: 1, height: 44 },
  publishAtHint: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 16 },
  weekdayRow: { flexDirection: 'row', gap: 6 },
  weekdayPill: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.grayBorder, alignItems: 'center', backgroundColor: Colors.white },
  weekdayPillActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  weekdayPillText: { fontSize: 12, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.gray },
  weekdayPillTextActive: { color: Colors.white },
  stripeNotice: { flexDirection: 'row', gap: 14, backgroundColor: Colors.black, borderRadius: 16, padding: 16, alignItems: 'flex-start' },
  stripeIcon: { fontSize: 24 },
  stripeText: { flex: 1, gap: 4 },
  stripeTitle: { fontSize: 15, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.white },
  stripeSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: Fonts.regular, lineHeight: 18 },
  stripeLink: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.lime, marginTop: 6 },
});
