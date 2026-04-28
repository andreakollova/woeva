import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';
import { WMark } from '@/components/ui/WMark';
import { Toast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function CreateStep3Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ title: string; tagline: string; category: string; cover: string }>();

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [duration, setDuration] = useState('2');
  const [venue, setVenue] = useState('');
  const [price, setPrice] = useState('0');
  const [loading, setLoading] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [toast, setToast] = useState(false);

  async function handleShare() {
    if (!user) return;
    if (!venue) { Alert.alert('Missing venue', 'Please enter a venue or location.'); return; }
    setLoading(true);

    let cover_url: string | null = null;
    if (params.cover) {
      const ext = params.cover.split('.').pop();
      const path = `events/${Date.now()}.${ext}`;
      const blob = await fetch(params.cover).then(r => r.blob());
      await supabase.storage.from('event-covers').upload(path, blob);
      const { data } = supabase.storage.from('event-covers').getPublicUrl(path);
      cover_url = data.publicUrl;
    }

    const eventDate = date.toISOString().split('T')[0];
    const eventTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const priceNum = parseFloat(price) || 0;

    const { data, error } = await supabase.from('events').insert({
      creator_id: user.id,
      title: params.title,
      tagline: params.tagline,
      category: params.category,
      cover_url,
      date: eventDate,
      time: eventTime,
      duration: parseFloat(duration) || 2,
      venue,
      price: priceNum,
      is_free: priceNum === 0,
      going_count: 1,
      city: 'Bratislava',
    }).select().single();

    if (!error && data) {
      // Also add creator as attendee
      await supabase.from('event_attendees').insert({ event_id: data.id, user_id: user.id, paid: true });
    }

    setLoading(false);
    if (error) { Alert.alert('Could not create event', error.message); return; }
    setToast(true);
    setTimeout(() => router.replace('/event/create/published'), 1000);
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
        <View style={styles.stepRow}>
          <WMark size={28} color={Colors.lime} />
          <View style={styles.stepBadge}><Text style={styles.stepText}>3 / 3</Text></View>
        </View>

        <Text style={styles.title}>When & where?</Text>

        <View style={styles.form}>
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

          {/* Time + Duration */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
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
            <View style={{ width: 80 }}>
              <Text style={styles.label}>Duration</Text>
              <Input
                value={duration}
                onChangeText={setDuration}
                placeholder="2h"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Venue */}
          <Input
            label="Venue"
            value={venue}
            onChangeText={setVenue}
            placeholder="Tap to set venue"
          />

          {/* Price */}
          <Input
            label="Price (€) — leave 0 for free"
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Share event" onPress={handleShare} loading={loading} variant="black" />
        <Button label="Back" onPress={() => router.back()} variant="ghost" />
      </View>
      <Toast visible={toast} title="Event created!" subtitle="Your people will find it." onHide={() => setToast(false)} />
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
  label: { fontSize: 14, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  field: { height: 52, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  fieldValue: { fontSize: 16, color: Colors.black },
  row: { flexDirection: 'row', gap: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8, backgroundColor: Colors.white },
});
