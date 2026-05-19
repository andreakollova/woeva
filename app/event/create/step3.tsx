import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, Pressable, Image } from 'react-native';
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

  const [date, setDate] = useState(draft3.date ?? new Date());
  const [time, setTime] = useState(draft3.time ?? new Date());
  const [duration, setDuration] = useState(draft3.duration);
  const [venue, setVenue] = useState(draft3.venue);
  const [venueLat, setVenueLat] = useState<number | undefined>(draft3.venueLat);
  const [venueLng, setVenueLng] = useState<number | undefined>(draft3.venueLng);
  const [price, setPrice] = useState(draft3.price);
  const [payAtDoor, setPayAtDoor] = useState(draft3.payAtDoor);
  const [isRecurring, setIsRecurring] = useState(draft3.isRecurring);
  const [recurringEndDate, setRecurringEndDate] = useState(() => {
    if (draft3.recurringEndDate) return draft3.recurringEndDate;
    const d = new Date(); d.setDate(d.getDate() + 7); return d;
  });
  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const [showRecurringEnd, setShowRecurringEnd] = useState(false);
  const [extraCovers, setExtraCovers] = useState<string[]>(draft3.extraCovers);
  const [toast, setToast] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase
      .from('stripe_accounts')
      .select('onboarding_complete, charges_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_complete && data?.charges_enabled) {
          setStripeConnected(true);
        }
      });
  }, [user]));

  // Keep draft in sync
  useEffect(() => {
    draft3.date = date; draft3.time = time; draft3.duration = duration;
    draft3.venue = venue; draft3.venueLat = venueLat; draft3.venueLng = venueLng;
    draft3.price = price; draft3.payAtDoor = payAtDoor;
    draft3.isRecurring = isRecurring; draft3.recurringEndDate = recurringEndDate;
    draft3.extraCovers = extraCovers;
  }, [date, time, duration, venue, venueLat, venueLng, price, payAtDoor, isRecurring, recurringEndDate, extraCovers]);

  async function handleShare() {
    if (!venue.trim()) { Alert.alert(t.event.missingVenue, t.event.missingVenueMsg); return; }
    if (!params.title) { Alert.alert(t.event.missingTitle, t.event.missingTitleMsg); return; }
    setLoading(true);

    const currentUser = user;
    if (!currentUser) { setLoading(false); Alert.alert(t.event.notLoggedIn, t.event.notLoggedInMsg); return; }

    const eventDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const eventTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
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
    const VALID_CATS = ['Sport', 'Coffee', 'Sober party', 'Party', 'Music', 'Art', 'Film', 'Yoga', 'Tech', 'Gardening', 'Gaming', 'Running', 'Hockey', 'Dance', 'Food', 'Networking', 'Matches', 'Gastro', 'Free'];
    const firstTag = parsedTags[0] || '';
    const safeCategory = VALID_CATS.includes(firstTag) ? firstTag : (parsedTags.find((t: string) => VALID_CATS.includes(t)) ?? 'Sport');

    const { data, error } = await supabase.from('events').insert({
      creator_id: currentUser.id,
      club_id: clubData?.id ?? null,
      title: String(params.title),
      tagline: String(params.tagline || ''),
      category: safeCategory,
      cover_url,
      ...(cover_urls.length > 1 ? { cover_urls } : {}),
      date: eventDate,
      time: eventTime,
      duration: parseFloat(String(duration)) || 2,
      venue: venue.trim(),
      lat: venueLat ?? null,
      lng: venueLng ?? null,
      price: priceNum,
      is_free: priceNum === 0,
      pay_at_door: isPayAtDoor,
      is_recurring: isRecurring,
      recurring_end_date: isRecurring ? `${recurringEndDate.getFullYear()}-${String(recurringEndDate.getMonth() + 1).padStart(2, '0')}-${String(recurringEndDate.getDate()).padStart(2, '0')}` : null,
      going_count: 1,
      city: profile?.city ?? 'Bratislava',
    }).select().single();

    if (!error && data) {
      supabase.from('event_attendees').insert({ event_id: data.id, user_id: currentUser.id, paid: true }).then(() => {});

      // Notify users interested in new events (my tags / all)
      notify.newEvent({
        creatorId: currentUser.id,
        eventId: data.id,
        eventTitle: String(params.title),
        tags: parsedTags,
        city: profile?.city ?? 'Bratislava',
      });

      // Send push + in-app notifications to club members
      if (clubData?.id) {
        const { data: members } = await supabase
          .from('club_members')
          .select('user_id, profile:profiles(push_token)')
          .eq('club_id', clubData.id)
          .eq('status', 'approved')
          .neq('user_id', currentUser.id);

        const memberTokens = (members ?? []).map((m: any) => m.profile?.push_token).filter(Boolean);
        const memberUserIds = (members ?? []).map((m: any) => m.user_id);

        const { data: memberProfiles } = await supabase
          .from('profiles').select('email').in('id', memberUserIds);
        const memberEmails = (memberProfiles ?? []).map((p: any) => p.email).filter(Boolean);

        // In-app notifications
        const inAppNotifs = (members ?? []).map((m: any) => ({
          user_id: m.user_id, type: 'club_event',
          title: `New event in ${clubData.name ?? 'your club'}`,
          body: String(params.title),
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 0 }]}
        keyboardShouldPersistTaps="always"
      >
        {/* Header */}
        <View style={styles.stepRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </View>
          <WMark size={30} color={Colors.lime} />
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

          {/* Time + Duration row */}
          <View style={styles.halfRow}>
            <View style={styles.halfCol}>
              <Text style={styles.label}>{t.event.time}</Text>
              <TouchableOpacity style={styles.field} onPress={() => setShowTime(true)}>
                <Text style={styles.fieldValue}>{timeStr}</Text>
              </TouchableOpacity>
              {showTime && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="spinner"
                  onChange={(_, t) => { setShowTime(false); if (t) setTime(t); }}
                />
              )}
            </View>

            <View style={styles.halfCol}>
              <Text style={styles.label}>{t.event.duration}</Text>
              <TouchableOpacity style={styles.field} onPress={() => setShowDuration(true)}>
                <Text style={styles.fieldValue}>{duration === '0.5' ? '30 min' : `${duration}h`}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration picker modal */}
          <Modal visible={showDuration} transparent animationType="fade" onRequestClose={() => setShowDuration(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setShowDuration(false)}>
              <View style={styles.durationSheet}>
                <Text style={styles.durationSheetTitle}>{t.event.duration}</Text>
                {(['0.5', '1', '1.5', '2', '3', '4', '5', '6', '8'] as const).map((h, i, arr) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.durationOption, i < arr.length - 1 && styles.durationOptionBorder]}
                    onPress={() => { setDuration(h); setShowDuration(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.durationOptionText, duration === h && styles.durationOptionActive]}>
                      {h === '0.5' ? '30 min' : `${h} hour${parseFloat(h) !== 1 ? 's' : ''}`}
                    </Text>
                    {duration === h && <Text style={styles.durationCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Modal>

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
          {parseFloat(price) > 0 && !payAtDoor && !stripeConnected && (
            <View style={styles.stripeNotice}>
              <Text style={styles.stripeIcon}>💳</Text>
              <View style={styles.stripeText}>
                <Text style={styles.stripeTitle}>{t.event.stripeRequired}</Text>
                <Text style={styles.stripeSub}>{t.event.stripeRequiredSub}</Text>
                <TouchableOpacity onPress={() => router.push('/dashboard?tab=payouts' as any)} activeOpacity={0.7}>
                  <Text style={styles.stripeLink}>{t.event.setUpPayments}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

          {/* Recurring end date — only when recurring is on */}
          {isRecurring && (() => {
            const weeks = Math.max(1, Math.floor((recurringEndDate.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)));
            const maxPhotos = Math.min(5, weeks) - 1; // -1 because primary cover from step2 counts as slot 1
            const recurEndStr = recurringEndDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
            return (
            <View style={{ gap: 16 }}>
              <View>
                <Text style={styles.label}>{lang === 'sk' ? 'Opakovať do' : 'Repeat until'}</Text>
                <TouchableOpacity style={[styles.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setShowRecurringEnd(true)} activeOpacity={0.7}>
                  <Text style={styles.fieldValue}>{recurEndStr}</Text>
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
                <Text style={styles.recurringWeeksHint}>{weeks} {weeks === 1 ? 'week' : 'weeks'}</Text>
              </View>

              {/* Rotating cover photos */}
              <View>
                <Text style={styles.label}>Rotating covers</Text>
                <View style={styles.rotatingDivider} />
                <Text style={styles.rotatingSub}>Add up to {maxPhotos + 1} photos - a different one shows each week.</Text>
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
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  stepBadge: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  stepText: { fontSize: 13, fontWeight: '600', color: Colors.black },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, marginBottom: 28, letterSpacing: -0.5 },
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
  stripeNotice: { flexDirection: 'row', gap: 12, backgroundColor: '#EFFFB0', borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  stripeIcon: { fontSize: 20 },
  stripeText: { flex: 1, gap: 4 },
  stripeTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  stripeSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  stripeLink: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black, marginTop: 6 },
});
