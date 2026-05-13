import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
      supabase.functions.invoke('send-receipt', {
        body: { eventId: id, paymentIntentId: data.paymentIntentId },
      });
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
          <Text style={styles.summaryTitle}>{event.title}</Text>
          <Text style={styles.summaryMeta}>Ticket · €{event.price.toFixed(2)}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Po kliknutí na Pay zadáš údaje karty bezpečne cez Stripe. Podporované: Visa, Mastercard, Apple Pay.</Text>
        </View>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.black },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 13, color: Colors.gray, fontWeight: '500', marginTop: 20, marginBottom: 10, letterSpacing: 0.3 },
  summaryBox: { backgroundColor: Colors.grayLight, borderRadius: 14, padding: 16, gap: 4 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.black },
  summaryMeta: { fontSize: 13, color: Colors.gray },
  infoBox: { marginTop: 20, padding: 14, backgroundColor: Colors.grayLight, borderRadius: 12 },
  infoText: { fontSize: 13, color: Colors.gray, lineHeight: 19 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder },
});
