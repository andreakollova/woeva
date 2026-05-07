import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/ui/Button';
import { useTranslations } from '@/context/LanguageContext';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();
  const [selectedCard, setSelectedCard] = useState('visa_547');

  const savedCards = [
    { id: 'visa_547', last4: '547', brand: 'VISA' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.settings.paymentMethods}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.sectionLabel}>{t.settings.savedCards}</Text>
        {savedCards.map(card => (
          <TouchableOpacity
            key={card.id}
            style={[styles.cardRow, selectedCard === card.id && styles.cardRowSelected]}
            onPress={() => setSelectedCard(card.id)}
          >
            <View style={styles.cardThumb} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardNumber}>••• ••• •••{card.last4}</Text>
              <Text style={styles.cardBrand}>{card.brand}</Text>
            </View>
            {selectedCard === card.id && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addCard}>
          <Text style={styles.addCardText}>{t.settings.addCard}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t.settings.otherOptions}</Text>
        <TouchableOpacity style={styles.cardRow}>
          <View style={[styles.cardThumb, { backgroundColor: Colors.grayLight }]} />
          <Text style={styles.cardInfo}>Apple Pay</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  title: { fontSize: 20, fontWeight: '700', color: Colors.black },
  scroll: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 13, color: Colors.gray, fontWeight: '500', marginTop: 20, marginBottom: 12, letterSpacing: 0.3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardRowSelected: { borderColor: Colors.black },
  cardThumb: { width: 44, height: 32, borderRadius: 6, backgroundColor: Colors.gray },
  cardInfo: { flex: 1 },
  cardNumber: { fontSize: 15, fontWeight: '600', color: Colors.black },
  cardBrand: { fontSize: 12, color: Colors.gray, marginTop: 2 },
  check: { fontSize: 18, fontWeight: '700', color: Colors.black },
  addCard: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10, backgroundColor: Colors.grayLight },
  addCardText: { fontSize: 15, fontWeight: '600', color: Colors.black },
});
