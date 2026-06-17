import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Input } from '@/components/ui/Input';
import { VenueInput } from '@/components/ui/VenueInput';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/context/LanguageContext';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';

export default function EditEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslations();

  const catLabels: Record<string, string> = {
    'Movement & Sport': lang === 'sk' ? 'Pohyb & Šport' : 'Movement & Sport',
    'Wellness & Body': lang === 'sk' ? 'Wellness & Telo' : 'Wellness & Body',
    'Food & Drinks': lang === 'sk' ? 'Jedlo & Pitie' : 'Food & Drinks',
    'Art & Creation': lang === 'sk' ? 'Umenie & Tvorba' : 'Art & Creation',
    'Music & Nightlife': lang === 'sk' ? 'Hudba & Nočný život' : 'Music & Nightlife',
    'Learning & Mind': lang === 'sk' ? 'Vzdelávanie & Myseľ' : 'Learning & Mind',
    'Community & Belonging': lang === 'sk' ? 'Komunita & Spolupatričnosť' : 'Community & Belonging',
  };

  const { profile } = useAuth();
  const { categories } = useCategories();
  const [title, setTitle] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [tagline, setTagline] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [venue, setVenue] = useState('');
  const [venueLat, setVenueLat] = useState<number | undefined>();
  const [venueLng, setVenueLng] = useState<number | undefined>();
  const [price, setPrice] = useState('0');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    const { data } = await supabase.from('events').select('*').eq('id', id).single();
    if (!data) return;
    setTitle(data.title);
    setEventTitle(data.title);
    setTagline(data.tagline ?? '');
    setTags(data.tags?.length ? data.tags : (data.category ? [data.category] : []));
    setPrice(String(data.price ?? 0));
    setVenue(data.venue ?? '');
    setVenueLat(data.lat ?? undefined);
    setVenueLng(data.lng ?? undefined);
    const eventDate = new Date(data.date + 'T00:00:00');
    setDate(eventDate);

    if (data.time) {
      const [h, m] = data.time.split(':').map(Number);
      const t = new Date();
      t.setHours(h, m, 0, 0);
      setTime(t);
    }
  }

  async function handleSave() {
    if (!venue.trim()) { Alert.alert(t.event.missingVenue, t.event.missingVenueMsg); return; }
    if (!title.trim()) { Alert.alert(t.event.missingTitle, t.event.missingTitleMsg); return; }
    setLoading(true);

    const eventDate = date.toISOString().split('T')[0];
    const eventTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const priceNum = parseFloat(price) || 0;

    const { error } = await supabase.from('events').update({
      title: title.trim(),
      tagline: tagline.trim(),
      category: tags.join(', '),
      date: eventDate,
      time: eventTime,
      venue: venue.trim(),
      lat: venueLat ?? null,
      lng: venueLng ?? null,
      price: priceNum,
      is_free: priceNum === 0,
    }).eq('id', id);

    setLoading(false);
    if (error) { Alert.alert(t.event.couldNotCreate, error.message); return; }
    setToast(true);
    setTimeout(() => router.back(), 1200);
  }

  function confirmDelete() {
    Alert.alert(
      'Zrušiť udalosť',
      `Naozaj chceš zrušiť event "${eventTitle}"?`,
      [
        { text: 'Nie', style: 'cancel' },
        { text: 'Áno, zrušiť', style: 'destructive', onPress: confirmDeleteFinal },
      ]
    );
  }

  function confirmDeleteFinal() {
    Alert.alert(
      'Potvrď zrušenie',
      'Toto sa nedá vrátiť. Všetkým prihlásením príde notifikácia o zrušení eventu.',
      [
        { text: 'Späť', style: 'cancel' },
        { text: 'Zrušiť event', style: 'destructive', onPress: handleDelete },
      ]
    );
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from('events').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'Organizátor zrušil event.',
    }).eq('id', id);

    const { data: allAttendees } = await supabase
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', id);

    if (allAttendees && allAttendees.length > 0) {
      const userIds = allAttendees.map((a: any) => a.user_id);
      await supabase.from('notifications').insert(
        userIds.map((uid: string) => ({
          user_id: uid,
          type: 'event_cancelled',
          title: `Event bol zrušený: ${eventTitle}`,
          body: 'Organizátor zrušil tento event.',
          data: { event_id: id },
        }))
      );
      const { data: profiles } = await supabase.from('profiles').select('push_token').in('id', userIds);
      const tokens = (profiles ?? []).map((p: any) => p.push_token).filter(Boolean);
      notify.eventCancelled({
        eventId: String(id),
        eventTitle,
        creatorName: profile?.name ?? 'Organizátor',
        attendeeTokens: tokens,
        attendeeEmails: [],
      });
    }

    setDeleting(false);
    router.replace('/(tabs)/');
  }

  const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>{t.common.cancel}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.event.editEvent}</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={styles.form}>
          <Input
            label={t.event.eventName}
            value={title}
            onChangeText={setTitle}
            placeholder={t.event.eventNamePlaceholderEdit}
          />

          <Input
            label={t.event.description.split(' (')[0]}
            value={tagline}
            onChangeText={setTagline}
            placeholder={t.event.descriptionPlaceholderEdit}
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
                onChange={(_, d) => { setShowDate(false); if (d) setDate(d); }}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* Time */}
          <View>
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

          <VenueInput
            value={venue}
            onChange={(v, lat, lng) => {
              setVenue(v);
              setVenueLat(lat);
              setVenueLng(lng);
            }}
          />

          <Input
            label={t.event.priceFree}
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            keyboardType="numeric"
          />

          {/* Tags */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={styles.label}>{t.event.category}</Text>
              <Text style={{ fontSize: 11, color: Colors.gray }}>{tags.length}/3</Text>
            </View>
            <View style={styles.chipsWrap}>
              {categories.map(cat => {
                const active = tags.includes(cat);
                const disabled = !active && tags.length >= 3;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                    onPress={() => {
                      if (disabled) return;
                      setTags(prev => prev.includes(cat) ? prev.filter(t => t !== cat) : [...prev, cat]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{catLabels[cat] ?? cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={t.club.saveChanges} onPress={handleSave} loading={loading} variant="black" />
        <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>{deleting ? 'Zrušujem...' : 'Zrušiť udalosť'}</Text>
        </TouchableOpacity>
      </View>

      <Toast visible={toast} title={t.event.savedTitle} subtitle={t.event.savedSub} onHide={() => setToast(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  deleteBtn: { alignItems: 'center', paddingVertical: 14 },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  headerTitle: { fontSize: 17, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  cancel: { fontSize: 16, color: Colors.gray, fontFamily: Fonts.regular },
  form: { gap: 20 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  field: { height: 52, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  fieldValue: { fontSize: 16, color: Colors.black },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, backgroundColor: Colors.white },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight, borderWidth: 1.5, borderColor: 'transparent' },
  chipActive: { backgroundColor: Colors.black },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 13, color: Colors.black, fontWeight: '500' },
  chipTextActive: { color: Colors.lime, fontWeight: '700' },
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14 },
  recurringText: { flex: 1 },
  recurringTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  recurringSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
