import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
import { useAuth } from '@/context/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { useTranslations } from '@/context/LanguageContext';

export default function CreateClubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const { categories } = useCategories();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
    if (!result.canceled) setCover(result.assets[0].uri);
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, aspect: [1, 1] });
    if (!result.canceled) setLogo(result.assets[0].uri);
  }

  async function handleCreate() {
    if (!name || !user) return;
    setLoading(true);

    const ts = Date.now();
    let cover_url: string | null = null;
    let logo_url: string | null = null;

    if (cover) {
      const ext = (cover.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      cover_url = await uploadImage(cover, 'club-covers', `clubs/${ts}.${ext}`);
    }
    if (logo) {
      const ext = (logo.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      logo_url = await uploadImage(logo, 'club-logos', `logos/${ts}.${ext}`);
    }

    const { data, error } = await supabase.from('clubs').insert({
      creator_id: user.id,
      name,
      tagline,
      description: description.trim() || null,
      category,
      cover_url,
      logo_url,
      member_count: 1,
      rating: 0,
      city: profile?.city ?? 'Bratislava',
    }).select().single();

    if (!error && data) {
      await supabase.from('club_members').insert({ club_id: data.id, user_id: user.id, role: 'admin', status: 'approved' });
    }

    setLoading(false);
    if (error) { Alert.alert(t.common.error, error.message); return; }
    router.replace(`/club/${data.id}`);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepRow}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <WMark size={28} color={Colors.lime} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{t.club.createClub}</Text>

        <View style={styles.form}>
          <View>
            <Input label={t.club.clubName} value={name} onChangeText={setName} placeholder={t.club.clubNamePlaceholder} />
            {name.length > 16 && (
              <Text style={styles.nameWarning}>{t.club.nameTooLong}</Text>
            )}
          </View>
          <Input label={t.club.tagline} value={tagline} onChangeText={setTagline} placeholder={t.club.taglinePlaceholder} />

          <View>
            <Text style={styles.label}>{t.club.category}</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setShowCategories(!showCategories)}>
              <Text style={category ? styles.selectorValue : styles.selectorPlaceholder}>{category || t.event.selectCategory}</Text>
            </TouchableOpacity>
            {showCategories && (
              <View style={styles.dropdown}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat} style={styles.dropdownItem} onPress={() => { setCategory(cat); setShowCategories(false); }}>
                    <Text style={[styles.dropdownText, category === cat && styles.dropdownTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Logo + Cover row */}
          <View style={styles.photosRow}>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>{t.club.logo}</Text>
              <TouchableOpacity style={styles.logoPicker} onPress={pickLogo} activeOpacity={0.8}>
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.logoPreview} />
                ) : (
                  <Text style={styles.photoPlus}>+</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>{t.club.cover}</Text>
              <TouchableOpacity style={styles.coverPicker} onPress={pickCover} activeOpacity={0.8}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverEmpty}>
                    <Text style={styles.photoPlus}>+</Text>
                    <Text style={styles.coverHint}>16:9</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t.club.aboutOptional}</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder={t.club.descriptionPlaceholder}
              placeholderTextColor={Colors.gray}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={t.club.createClub} onPress={handleCreate} loading={loading} disabled={!name} variant="black" />
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
  dropdown: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, marginTop: 4, overflow: 'hidden', maxHeight: 200 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  dropdownText: { fontSize: 15, color: Colors.black },
  dropdownTextActive: { fontWeight: '700', color: Colors.lime },
  photosRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logoPicker: {
    width: 80, height: 80, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.grayBorder, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: Colors.grayLight,
  },
  logoPreview: { width: '100%', height: '100%' },
  photoPlus: { fontSize: 24, color: Colors.gray },
  coverPicker: { height: 80, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, borderStyle: 'dashed', overflow: 'hidden' },
  coverPreview: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverHint: { fontSize: 11, color: Colors.gray },
  textarea: {
    borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.black, fontFamily: Fonts.regular,
    minHeight: 80,
  },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8, backgroundColor: Colors.white },
  nameWarning: { fontSize: 12, color: '#B8860B', fontFamily: Fonts.regular, marginTop: 6, lineHeight: 17 },
});
