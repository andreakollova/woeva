import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
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

export default function EditEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [venue, setVenue] = useState('');
  const [venueLat, setVenueLat] = useState<number | undefined>();
  const [venueLng, setVenueLng] = useState<number | undefined>();
  const [price, setPrice] = useState('0');
  const [isRecurring, setIsRecurring] = useState(false);
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
    setTagline(data.tagline ?? '');
    setPrice(String(data.price ?? 0));
    setVenue(data.venue ?? '');
    setVenueLat(data.lat ?? undefined);
    setVenueLng(data.lng ?? undefined);
    setIsRecurring(data.is_recurring ?? false);

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
    if (!venue.trim()) { Alert.alert('Missing venue', 'Please enter a venue.'); return; }
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter an event name.'); return; }
    setLoading(true);

    const eventDate = date.toISOString().split('T')[0];
    const eventTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const priceNum = parseFloat(price) || 0;

    const { error } = await supabase.from('events').update({
      title: title.trim(),
      tagline: tagline.trim(),
      date: eventDate,
      time: eventTime,
      venue: venue.trim(),
      lat: venueLat ?? null,
      lng: venueLng ?? null,
      price: priceNum,
      is_free: priceNum === 0,
      is_recurring: isRecurring,
    }).eq('id', id);

    setLoading(false);
    if (error) { Alert.alert('Could not save', error.message); return; }
    setToast(true);
    setTimeout(() => router.back(), 1200);
  }

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit event</Text>
          <View style={{ width: 56 }} />
        </View>

        <View style={styles.form}>
          <Input
            label="Event name"
            value={title}
            onChangeText={setTitle}
            placeholder="What's happening?"
          />

          <Input
            label="Description"
            value={tagline}
            onChangeText={setTagline}
            placeholder="Tell people what to expect..."
          />

          {/* Date */}
          <View>
            <Text style={styles.label}>Date</Text>
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
            <Text style={styles.label}>Time</Text>
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
            label="Price (€) — leave 0 for free"
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            keyboardType="numeric"
          />

          {/* Recurring toggle */}
          <TouchableOpacity style={styles.recurringRow} onPress={() => setIsRecurring(r => !r)} activeOpacity={0.7}>
            <View style={styles.recurringText}>
              <Text style={styles.recurringTitle}>Repeat every week</Text>
              <Text style={styles.recurringSub}>Same day, time and venue each week</Text>
            </View>
            <View style={[styles.toggle, isRecurring && styles.toggleOn]}>
              <View style={[styles.toggleThumb, isRecurring && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Save changes" onPress={handleSave} loading={loading} variant="black" />
      </View>

      <Toast visible={toast} title="Saved!" subtitle="Your event has been updated." onHide={() => setToast(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.grayLight, borderRadius: 12, padding: 14 },
  recurringText: { flex: 1 },
  recurringTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  recurringSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
