import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

export default function CreateStep3Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const params = useLocalSearchParams<{ title: string; tagline: string; tags: string; cover: string; postAs: string }>();

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [duration, setDuration] = useState('2');
  const [venue, setVenue] = useState('');
  const [venueLat, setVenueLat] = useState<number | undefined>();
  const [venueLng, setVenueLng] = useState<number | undefined>();
  const [price, setPrice] = useState('0');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; });
  const [showRecurringEnd, setShowRecurringEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showDuration, setShowDuration] = useState(false);
  const [toast, setToast] = useState(false);

  async function handleShare() {
    if (!venue.trim()) { Alert.alert(t.event.missingVenue, t.event.missingVenueMsg); return; }
    if (!params.title) { Alert.alert(t.event.missingTitle, t.event.missingTitleMsg); return; }
    setLoading(true);

    const currentUser = user;
    if (!currentUser) { setLoading(false); Alert.alert(t.event.notLoggedIn, t.event.notLoggedInMsg); return; }

    const eventDate = date.toISOString().split('T')[0];
    const eventTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const priceNum = parseFloat(price) || 0;
    if (priceNum > 0 && priceNum < 0.5) {
      setLoading(false);
      Alert.alert('Minimálna cena', 'Minimálna cena ticketu je €0.50.');
      return;
    }

    // Find creator's club (only if posting as club)
    const postAsClub = params.postAs !== 'individual';
    const { data: clubData } = postAsClub
      ? await supabase.from('clubs').select('id, name').eq('creator_id', currentUser.id).limit(1).single()
      : { data: null };

    // Upload cover image if provided
    let cover_url: string | null = null;
    if (params.cover) {
      const ext = (params.cover.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      cover_url = await uploadImage(params.cover, 'event-covers', `${Date.now()}.${ext}`);
    }

    const parsedTags = (() => { try { return JSON.parse(params.tags || '[]'); } catch { return []; } })();
    const VALID_CATS = ['Sport', 'Coffee', 'Sober party', 'Party', 'Music', 'Art', 'Film', 'Yoga', 'Tech', 'Gardening', 'Gaming', 'Running', 'Hockey', 'Dance', 'Food', 'Networking', 'Matches', 'Gastro', 'Free', 'Marathon'];
    const firstTag = parsedTags[0] || '';
    const safeCategory = VALID_CATS.includes(firstTag) ? firstTag : (parsedTags.find((t: string) => VALID_CATS.includes(t)) ?? 'Sport');

    const { data, error } = await supabase.from('events').insert({
      creator_id: currentUser.id,
      club_id: clubData?.id ?? null,
      title: String(params.title),
      tagline: String(params.tagline || ''),
      category: safeCategory,
      cover_url,
      date: eventDate,
      time: eventTime,
      duration: parseFloat(String(duration)) || 2,
      venue: venue.trim(),
      lat: venueLat ?? null,
      lng: venueLng ?? null,
      price: priceNum,
      is_free: priceNum === 0,
      is_recurring: isRecurring,
      recurring_end_date: isRecurring ? recurringEndDate.toISOString().split('T')[0] : null,
      going_count: 1,
      city: profile?.city ?? 'Bratislava',
    }).select().single();

    if (!error && data) {
      await supabase.from('event_attendees').insert({ event_id: data.id, user_id: currentUser.id, paid: true });

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
    setToast(true);
    setTimeout(() => router.replace('/event/create/published'), 1000);
  }

  const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepRow}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <WMark size={28} color={Colors.lime} />
          </TouchableOpacity>
          <View style={styles.stepBadge}><Text style={styles.stepText}>{t.event.step(3, 3)}</Text></View>
        </View>

        <Text style={styles.title}>{t.event.whenWhere}</Text>

        <View style={styles.form}>
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
                onChange={(_, d) => { setShowDate(false); if (d) setDate(d); }}
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

          {/* Venue */}
          <VenueInput
            value={venue}
            onChange={(v, lat, lng) => {
              setVenue(v);
              setVenueLat(lat);
              setVenueLng(lng);
            }}
          />

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
          {parseFloat(price) > 0 && parseFloat(price) < 0.5 && (
            <Text style={{ fontSize: 12, color: '#FF3B30', marginTop: -8, marginBottom: 4 }}>
              Minimálna cena je €0.50
            </Text>
          )}
          {parseFloat(price) > 0 && (
            <View style={styles.stripeNotice}>
              <Text style={styles.stripeIcon}>💳</Text>
              <View style={styles.stripeText}>
                <Text style={styles.stripeTitle}>{t.event.stripeRequired}</Text>
                <Text style={styles.stripeSub}>{t.event.stripeRequiredSub}</Text>
                <TouchableOpacity onPress={() => router.push('/settings/payment-methods' as any)} activeOpacity={0.7}>
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
          {isRecurring && (
            <View>
              <Text style={styles.label}>{t.event.recurringUntil ?? 'Repeat until'}</Text>
              <TouchableOpacity style={styles.field} onPress={() => setShowRecurringEnd(true)} activeOpacity={0.8}>
                <Text style={styles.fieldValue}>
                  {recurringEndDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showRecurringEnd && (
                <DateTimePicker
                  value={recurringEndDate}
                  mode="date"
                  minimumDate={date}
                  onChange={(_, d) => { setShowRecurringEnd(false); if (d) setRecurringEndDate(d); }}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={t.event.shareEvent} onPress={handleShare} loading={loading} variant="black" />
        <Button label={t.common.back} onPress={() => router.back()} variant="ghost" />
      </View>
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
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8, backgroundColor: Colors.white },
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14 },
  recurringText: { flex: 1 },
  recurringTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  recurringSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
  stripeNotice: { flexDirection: 'row', gap: 12, backgroundColor: '#EFFFB0', borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  stripeIcon: { fontSize: 20 },
  stripeText: { flex: 1, gap: 4 },
  stripeTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  stripeSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 18 },
  stripeLink: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black, marginTop: 6 },
});
