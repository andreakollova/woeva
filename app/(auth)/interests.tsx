import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useCategories } from '@/hooks/useCategories';
import { useTranslations } from '@/context/LanguageContext';
import { CATEGORY_SK, CATEGORY_EN } from '@/types';

export default function InterestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslations();
  const { categories } = useCategories();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggle(cat: string) {
    setSelected(s => s.includes(cat) ? s.filter(x => x !== cat) : [...s, cat]);
  }

  async function handleContinue() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Only update interests — name was already saved during registration
      await supabase.from('profiles')
        .upsert({ id: user.id, interests: selected }, { onConflict: 'id', ignoreDuplicates: false });
    }
    setLoading(false);
    router.push('/(auth)/permissions');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ paddingHorizontal: 24 }}><BackButton /></View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.auth.whatsYourThing}</Text>
          <Text style={styles.subtitle}>{t.auth.pickFavourites}</Text>
        </View>

        <View style={styles.tags}>
          {categories.map((cat, i) => (
            <Tag
              key={cat}
              label={lang === 'sk' ? (CATEGORY_SK[cat] ?? cat) : (CATEGORY_EN[cat] ?? cat)}
              selected={selected.includes(cat)}
              onPress={() => toggle(cat)}
              floatDelay={i * 317 + (i % 4) * 213 + (i % 7) * 89}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t.auth.continueBtn}
          onPress={handleContinue}
          loading={loading}
          disabled={selected.length === 0}
          variant="lime"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  backBtn: { paddingHorizontal: 24, marginBottom: 8 },
  backText: { fontSize: 22, color: Colors.black, fontWeight: '400' },
  scroll: { paddingHorizontal: 24, paddingBottom: 100 },
  header: { marginTop: 24, marginBottom: 28, gap: 6 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.gray },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: { position: 'absolute', bottom: 24, left: 24, right: 24 },
});
