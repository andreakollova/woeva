import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { BackButton } from '@/components/ui/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const [enabled, setEnabled] = useState(profile?.notifications_enabled ?? true);

  async function toggle() {
    if (!user) return;
    const next = !enabled;
    setEnabled(next);
    await supabase.from('profiles').update({ notifications_enabled: next }).eq('id', user.id);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{t.common.notifications}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.settings.pushNotifications}</Text>
          <View style={styles.list}>
            <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.8}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t.settings.eventNotifications}</Text>
                <Text style={styles.rowSub}>{t.settings.eventNotificationsSub}</Text>
              </View>
              <View style={[styles.toggle, enabled && styles.toggleOn]}>
                <View style={[styles.thumb, enabled && styles.thumbOn]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.3, marginBottom: 8, textTransform: 'uppercase' },
  list: { borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: Fonts.medium, fontWeight: '500', color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.grayBorder, justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: Colors.lime },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  thumbOn: { alignSelf: 'flex-end' },
});
