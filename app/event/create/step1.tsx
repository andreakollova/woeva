import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { useTranslations } from '@/context/LanguageContext';

export default function CreateStep1Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.overlay} />

      <Animated.View entering={FadeInUp.springify()} style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.title}>{t.event.createEvent}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.dismiss()} hitSlop={8}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.option, styles.optionHighlighted]}
          onPress={() => { router.dismiss(); router.push('/event/create/step2'); }}
          activeOpacity={0.85}
        >
          <View style={styles.optionThumb} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{t.event.newEvent}</Text>
            <Text style={styles.optionSub}>{t.event.newEventSub}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.option}
          onPress={() => { router.dismiss(); router.push('/club/create'); }}
          activeOpacity={0.85}
        >
          <View style={[styles.optionThumb, { backgroundColor: Colors.grayBorder }]} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{t.club.createClub}</Text>
            <Text style={styles.optionSub}>{t.club.newClubSub}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.black },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    gap: 12,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.black, letterSpacing: -0.5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 14, color: Colors.black, fontWeight: '500' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.grayLight,
    borderRadius: 16,
    padding: 16,
  },
  optionHighlighted: { backgroundColor: Colors.lime },
  optionThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.12)' },
  optionText: { gap: 2 },
  optionTitle: { fontSize: 17, fontWeight: '700', color: Colors.black },
  optionSub: { fontSize: 13, color: Colors.black, opacity: 0.6 },
});
