import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { useTranslations } from '@/context/LanguageContext';

export default function PermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleLetsGo() {
    setLoading(true);
    await Location.requestForegroundPermissionsAsync().catch(() => {});
    await Notifications.requestPermissionsAsync().catch(() => {});
    setLoading(false);
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.permissions.enableFeatures}</Text>
      </View>

      <View style={styles.items}>
        <View style={styles.item}>
          <Text style={styles.itemTitle}>{t.permissions.location}</Text>
          <Text style={styles.itemSub}>{t.permissions.locationSub}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.itemTitle}>{t.permissions.notificationsLabel}</Text>
          <Text style={styles.itemSub}>{t.permissions.notificationsSub}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label={t.permissions.letsGo} onPress={handleLetsGo} loading={loading} variant="lime" />
        <Button label={t.permissions.maybeLater} onPress={() => router.replace('/(tabs)')} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  header: { marginBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, letterSpacing: -0.5 },
  items: { gap: 0, borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden', marginBottom: 40 },
  item: { padding: 20, gap: 4 },
  divider: { height: 1, backgroundColor: Colors.grayBorder },
  itemTitle: { fontSize: 16, fontWeight: '600', color: Colors.black },
  itemSub: { fontSize: 14, color: Colors.gray },
  footer: { gap: 8 },
});
