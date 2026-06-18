import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Event } from '@/types';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/notify';
import { useTranslations } from '@/context/LanguageContext';
import { scheduleEventReminders } from '@/lib/scheduleReminders';

export default function PaymentScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const eventId = rawId?.split('_')[0]; // strip occurrence suffix
  const id = eventId; // alias for existing code
  const occurrenceDate = rawId?.includes('_') ? rawId.slice(eventId.length + 1) : null;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);
  const [qty, setQty] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const checkScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 12 }],
  }));

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
      body: { eventId: id, amount: Math.round(event.price * qty * 100), currency: 'eur' },
    });

    if (error || !data?.clientSecret) {
      setLoading(false);
      Alert.alert('Platba nie je dostupná', 'Organizátor ešte nenastavil platby. Skús neskôr alebo kontaktuj klub.');
      return;
    }

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: data.clientSecret,
      merchantDisplayName: 'Woeva',
      returnURL: 'woeva://payment-return',
      applePay: {
        merchantCountryCode: 'SK',
        merchantIdentifier: 'merchant.com.woeva.app',
      },
    });

    if (initError) {
      setLoading(false);
      Alert.alert('Payment error (init)', `code: ${initError.code}\n${initError.message}`);
      return;
    }

    const { error: payError } = await presentPaymentSheet();
    setLoading(false);

    if (payError) {
      if (payError.code === 'Canceled') return;
      Alert.alert('Payment error (pay)', `code: ${payError.code}\n${payError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from('event_attendees').insert(
      Array.from({ length: qty }, (_, i) => ({
        event_id: id,
        user_id: user.id,
        paid: true,
        // each ticket gets a unique suffix so no unique-constraint conflict
        payment_intent_id: qty > 1 ? `${data.paymentIntentId}_${i}` : data.paymentIntentId,
      }))
    );
    if (insertError) {
      Alert.alert('Error saving ticket', insertError.message);
      return;
    }
    supabase.functions.invoke('send-receipt', {
      body: { eventId: id, paymentIntentId: data.paymentIntentId, qty },
    });
    if (event.creator_id && event.creator_id !== user.id) {
      const firstName = profile?.name?.split(' ')[0] ?? 'Niekto';
      await supabase.from('notifications').insert({
        user_id: event.creator_id,
        type: 'join',
        title: `Nový účastník: ${event.title}`,
        body: `${firstName} si kúpil/a lístok na tvoj event.`,
        data: { event_id: id },
      });
      notify.joinedEvent({
        creatorId: event.creator_id,
        attendeeName: firstName,
        eventTitle: event.title,
        eventDate: event.date,
        eventId: id,
      });
    }
    scheduleEventReminders(id, occurrenceDate ?? event.date, event.time, event.title);
    setShowSuccess(true);
    checkScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    textOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    setTimeout(() => router.replace(`/event/${rawId}`), 2400);
  }

  if (!event) return null;

  return (
    <View style={[styles.container, { paddingTop: 28 }]}>
      <Toast visible={toast} title={t.event.paySuccess} subtitle={t.event.paySuccessSub} />

      <View style={styles.handleRow}>
        <View style={styles.modalHandle} />
      </View>
      <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke="#0A0A0A" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 8, paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.sectionLabel}>{t.event.orderSummary}</Text>

        {/* Event card */}
        <View style={styles.eventCard}>
          {event.cover_url ? (
            <Image source={{ uri: event.cover_url }} style={styles.eventImage} />
          ) : null}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            {(event.date || event.time) ? (
              <View style={styles.metaRow}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke={Colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.metaText}>{[event.date, event.time].filter(Boolean).join(' · ')}</Text>
              </View>
            ) : null}
            {event.venue ? (
              <View style={styles.metaRow}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.metaText}>{[event.venue, event.city].filter(Boolean).join(', ')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Order card */}
        <View style={styles.orderCard}>
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>{t.event.ticketPrice}</Text>
            <Text style={styles.orderValue}>€{event.price.toFixed(2)}</Text>
          </View>
          <View style={styles.orderDivider} />
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>{t.event.quantity}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={() => setQty(q => Math.max(1, q - 1))} style={styles.stepBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepQty}>{qty}</Text>
              <TouchableOpacity onPress={() => setQty(q => Math.min(10, q + 1))} style={styles.stepBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.orderDivider} />
          <View style={styles.orderRow}>
            <Text style={styles.totalLabel}>{t.event.total}</Text>
            <Text style={styles.totalValue}>€{(event.price * qty).toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.stripeNote}>{t.event.securedByStripe}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={t.event.payBtn(`€${(event.price * qty).toFixed(2)}`)} onPress={handlePay} loading={loading} variant="lime" />
      </View>

      {showSuccess && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.successOverlay}>
          <Animated.View style={[styles.successCheck, checkStyle]}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12l5 5L19 7" stroke={Colors.white} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
          <Animated.View style={textStyle}>
            <Text style={styles.successTitle}>{t.event.paySuccess}</Text>
            <Text style={styles.successEvent}>{event.title}</Text>
            <Text style={styles.successSub}>{t.event.paySuccessSub}</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handleRow: { alignItems: 'center', paddingBottom: 16 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.black },
  closeBtn: { position: 'absolute', top: 28, right: 28, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 22, color: Colors.black, fontWeight: '700', marginTop: 8, marginBottom: 16, letterSpacing: -0.3 },
  eventCard: { backgroundColor: Colors.grayLight, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  eventImage: { width: '100%', height: 200 },
  eventInfo: { padding: 16, gap: 7 },
  eventTitle: { fontSize: 17, fontWeight: '700', color: Colors.black },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { fontSize: 13, color: Colors.gray, flex: 1 },
  orderCard: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  orderDivider: { height: 1, backgroundColor: Colors.grayBorder },
  orderLabel: { fontSize: 15, color: Colors.gray },
  orderValue: { fontSize: 15, fontWeight: '600', color: Colors.black },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.black },
  totalValue: { fontSize: 18, fontWeight: '700', color: Colors.black },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.grayLight, borderRadius: 22, paddingHorizontal: 4, paddingVertical: 2, gap: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: Colors.black, lineHeight: 26 },
  stepQty: { fontSize: 15, fontWeight: '700', color: Colors.black, minWidth: 26, textAlign: 'center' },
  stripeNote: { fontSize: 12, color: Colors.gray, textAlign: 'center', marginBottom: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 100 },
  successCheck: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 36, fontWeight: '800', color: Colors.black, textAlign: 'center', letterSpacing: -0.5 },
  successEvent: { fontSize: 17, fontWeight: '600', color: Colors.black, textAlign: 'center', marginTop: 6, opacity: 0.7 },
  successSub: { fontSize: 14, color: Colors.black, textAlign: 'center', marginTop: 4, opacity: 0.45 },
});
