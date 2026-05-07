import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

export default function CreateStep2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const { categories } = useCategories();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [clubName, setClubName] = useState<string | null>(null);
  const [postAs, setPostAs] = useState<'club' | 'individual'>('club');

  useEffect(() => {
    if (!user) return;
    supabase.from('clubs').select('name').eq('creator_id', user.id).limit(1).single()
      .then(({ data }) => setClubName(data?.name ?? null));
  }, [user]);

  const wordCount = tagline.trim() === '' ? 0 : tagline.trim().split(/\s+/).length;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
    if (!result.canceled) setCover(result.assets[0].uri);
  }

  function handleNext() {
    if (!title || !cover) return;
    router.push({ pathname: '/event/create/step3', params: { title, tagline, category, cover, postAs } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator */}
        <View style={styles.stepRow}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <WMark size={28} color={Colors.lime} />
          </TouchableOpacity>
          <View style={styles.stepBadge}><Text style={styles.stepText}>{t.event.step(2, 3)}</Text></View>
        </View>

        <Text style={styles.title}>{t.event.newEvent}</Text>

        <View style={styles.form}>
          <Input
            label={t.event.eventName}
            value={title}
            onChangeText={setTitle}
            placeholder={t.event.eventNamePlaceholder}
          />

          {/* Post as selector */}
          {clubName ? (
            <View>
              <Text style={styles.label}>{t.event.postAs}</Text>
              <View style={styles.postAsRow}>
                <TouchableOpacity
                  style={[styles.postAsOption, postAs === 'club' && styles.postAsOptionActive]}
                  onPress={() => setPostAs('club')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.postAsTitle, postAs === 'club' && styles.postAsTitleActive]}>{clubName}</Text>
                  <Text style={[styles.postAsSub, postAs === 'club' && styles.postAsSubActive]}>{t.event.myClub}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.postAsOption, postAs === 'individual' && styles.postAsOptionActive]}
                  onPress={() => setPostAs('individual')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.postAsTitle, postAs === 'individual' && styles.postAsTitleActive]}>{profile?.name || t.chat.you}</Text>
                  <Text style={[styles.postAsSub, postAs === 'individual' && styles.postAsSubActive]}>{t.event.individual}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.posterRow}>
              <View style={styles.posterInfo}>
                <Text style={styles.posterLabel}>{t.event.postedAs}</Text>
                <Text style={styles.posterName}>{profile?.name || t.chat.you}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/club/create/index' as any)} activeOpacity={0.7}>
                <Text style={styles.createClubLink}>{t.event.createClubLink}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { marginBottom: 0 }]}>{t.event.description.split(' (')[0]}</Text>
              <Text style={[styles.labelRequired, wordCount > 30 && styles.labelRequiredOver]}>
                {t.event.wordsCount(wordCount)}
              </Text>
            </View>
            <Input
              value={tagline}
              onChangeText={v => {
                const words = v.trim() === '' ? [] : v.trim().split(/\s+/);
                if (words.length <= 30) setTagline(v);
              }}
              placeholder={t.event.descriptionPlaceholder}
            />
            {wordCount > 28 && wordCount <= 30 && (
              <Text style={styles.hint}>{t.event.wordsLeft(30 - wordCount)}</Text>
            )}
            {wordCount >= 30 && (
              <Text style={styles.hintOver}>{t.event.wordsLimit}</Text>
            )}
          </View>

          {/* Category picker */}
          <View>
            <Text style={styles.label}>{t.event.category}</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setShowCategories(!showCategories)}>
              <Text style={category ? styles.selectorValue : styles.selectorPlaceholder}>
                {category || t.event.selectCategory}
              </Text>
            </TouchableOpacity>
            {showCategories && (
              <View style={styles.dropdown}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.dropdownItem}
                    onPress={() => { setCategory(cat); setShowCategories(false); }}
                  >
                    <Text style={[styles.dropdownText, category === cat && styles.dropdownTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Cover photo */}
          <View>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { marginBottom: 0 }]}>{t.event.coverPhoto.split(' (')[0]}</Text>
              <Text style={styles.labelRequired}>{t.event.required}</Text>
            </View>
            <TouchableOpacity style={[styles.coverPicker, !cover && styles.coverPickerRequired]} onPress={pickImage}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverEmpty}>
                  <Text style={styles.coverPlus}>+</Text>
                  <Text style={styles.coverHint}>{t.event.addCoverImage}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={t.common.next} onPress={handleNext} disabled={!title || !cover} variant="black" />
        <Button label={t.common.back} onPress={() => router.back()} variant="ghost" />
      </View>
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
  label: { fontSize: 13, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  selector: { height: 44, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  selectorValue: { fontSize: 14, color: Colors.black },
  selectorPlaceholder: { fontSize: 14, color: Colors.gray },
  dropdown: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  dropdownText: { fontSize: 15, color: Colors.black },
  dropdownTextActive: { fontWeight: '700', color: Colors.lime },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  labelRequired: { fontSize: 11, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold, letterSpacing: 0.4 },
  labelRequiredOver: { color: '#EF4444' },
  hint: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 4, marginLeft: 2 },
  hintOver: { fontSize: 11, color: '#EF4444', fontFamily: Fonts.medium, marginTop: 4, marginLeft: 2 },
  coverPicker: { height: 160, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, borderStyle: 'dashed', overflow: 'hidden' },
  coverPickerRequired: { borderColor: Colors.black },
  coverPreview: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverPlus: { fontSize: 32, color: Colors.gray },
  coverHint: { fontSize: 14, color: Colors.gray },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8, backgroundColor: Colors.white },
  posterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.grayLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  posterInfo: { gap: 2 },
  posterLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  posterName: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  createClubLink: { fontSize: 13, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  postAsRow: { flexDirection: 'row', gap: 10 },
  postAsOption: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.grayBorder,
    backgroundColor: Colors.white,
  },
  postAsOptionActive: { borderColor: Colors.black, backgroundColor: Colors.black },
  postAsTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black, marginBottom: 2 },
  postAsTitleActive: { color: Colors.white },
  postAsSub: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textTransform: 'uppercase', letterSpacing: 0.4 },
  postAsSubActive: { color: 'rgba(255,255,255,0.6)' },
});
