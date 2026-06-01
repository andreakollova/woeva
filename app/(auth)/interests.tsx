import { BackButton } from '@/components/ui/BackButton';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, InteractionManager } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
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
  const [tagsReady, setTagsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setTagsReady(true));
    return () => task.cancel();
  }, []);

  const floatY = useSharedValue(0);
  const floatX = useSharedValue(0);
  useEffect(() => {
    floatY.value = withDelay(120, withRepeat(withSequence(
      withTiming(-2.4, { duration: 2800 }),
      withTiming(1.2, { duration: 3300 }),
      withTiming(-1.8, { duration: 3100 }),
      withTiming(2.4, { duration: 2600 }),
    ), -1, true));
    floatX.value = withDelay(500, withRepeat(withSequence(
      withTiming(1.5, { duration: 3600 }),
      withTiming(-1.0, { duration: 3000 }),
      withTiming(0.8, { duration: 3400 }),
      withTiming(-1.5, { duration: 2800 }),
    ), -1, true));
  }, []);
  const selectAllFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { translateX: floatX.value }],
  }));

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
          {/* Select all chip */}
          <Animated.View style={selectAllFloatStyle}>
            <TouchableOpacity
              style={[styles.selectAllChip, selected.length === categories.length && styles.selectAllChipActive]}
              onPress={() => selected.length === categories.length ? setSelected([]) : setSelected([...categories])}
              activeOpacity={0.75}
            >
              <Text style={[styles.selectAllText, selected.length === categories.length && styles.selectAllTextActive]}>
                {selected.length === categories.length ? `✓ ${t.auth.deselectAll}` : t.auth.selectAll}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {tagsReady && categories.map((cat, i) => (
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
  selectAllChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },
  selectAllChipActive: {
    backgroundColor: Colors.lime,
    borderColor: Colors.lime,
  },
  selectAllText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666666',
  },
  selectAllTextActive: {
    color: Colors.black,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: { position: 'absolute', bottom: 24, left: 24, right: 24 },
});
