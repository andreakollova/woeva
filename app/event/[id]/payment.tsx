import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'apple'>('card');

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    const { data } = await supabase.from('events').select('*').eq('id', id).single();
    setEvent(data);
  }

  async function handlePay() {
    if (!event || !user) return;
    setLoading(true);

    // Call your Supabase Edge Function to create a payment intent
    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: { eventId: id, amount: Math.round(event.price * 100), currency: 'eur' },
    });

    if (error || !data?.clientSecret) {
      setLoading(false);
      Alert.alert('Platba nie je dostupná', 'Organizátor ešte nenastavil platby. Skús neskôr alebo kontaktuj klub.');
      return;
    }

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: data.clientSecret,
      merchantDisplayName: 'Woeva',
      applePay: { merchantCountryCode: 'SK' },
      googlePay: { merchantCountryCode: 'SK', testEnv: true },
    });

    if (initError) { setLoading(false); return; }

    const { error: payError } = await presentPaymentSheet();
    setLoading(false);

    if (!payError) {
      await supabase.from('event_attendees').insert({
        event_id: id,
        user_id: user.id,
        paid: true,
        payment_intent_id: data.paymentIntentId,
      });
      await supabase.from('events').update({ going_count: (event.going_count ?? 0) + 1 }).eq('id', id);
      setToast(true);
      setTimeout(() => router.replace(`/event/${id}`), 2000);
    }
  }

  if (!event) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Toast visible={toast} title="You're in" subtitle="See you out there." />

      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.sectionLabel}>Order summary</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Woeva {event.title}</Text>
          <Text style={styles.summaryMeta}>Ticket · €{event.price}</Text>
        </View>

        <Text style={styles.sectionLabel}>Pay with</Text>

        <TouchableOpacity
          style={[styles.methodRow, selectedMethod === 'card' && styles.methodSelected]}
          onPress={() => setSelectedMethod('card')}
        >
          <View style={styles.cardThumb} />
          <Text style={styles.methodText}>••• ••• •••547{'\n'}VISA</Text>
          {selectedMethod === 'card' && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodRow, selectedMethod === 'apple' && styles.methodSelected]}
          onPress={() => setSelectedMethod('apple')}
        >
          <View style={[styles.cardThumb, { backgroundColor: Colors.grayLight }]} />
          <Text style={styles.methodText}>Apple Pay</Text>
          {selectedMethod === 'apple' && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Pay" onPress={handlePay} loading={loading} variant="lime" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.black },
  scroll: { paddingHorizontal: 20, gap: 0 },
  sectionLabel: { fontSize: 13, color: Colors.gray, fontWeight: '500', marginTop: 20, marginBottom: 10, letterSpacing: 0.3 },
  summaryBox: { backgroundColor: Colors.grayLight, borderRadius: 14, padding: 16, gap: 4 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.black },
  summaryMeta: { fontSize: 13, color: Colors.gray },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  methodSelected: { borderColor: Colors.black },
  cardThumb: { width: 44, height: 32, borderRadius: 6, backgroundColor: Colors.gray },
  methodText: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.black, lineHeight: 20 },
  checkmark: { fontSize: 18, color: Colors.black, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder },
});
