import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, TextInput, Modal, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { WMark } from '@/components/ui/WMark';
import { BackButton } from '@/components/ui/BackButton';
import { VenueInput } from '@/components/ui/VenueInput';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
import { useAuth } from '@/context/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { useTranslations } from '@/context/LanguageContext';
import { CATEGORY_SK } from '@/types';

const D = {
  bg: '#0a0a0a',
  card: '#161616',
  border: '#2a2a2a',
  label: 'rgba(255,255,255,0.5)',
  text: '#ffffff',
  placeholder: '#555',
};

export default function CreateClubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t } = useTranslations();
  const { categories } = useCategories();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressLat, setAddressLat] = useState<number | undefined>();
  const [addressLng, setAddressLng] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [showCatRequest, setShowCatRequest] = useState(false);
  const [catRequestName, setCatRequestName] = useState('');
  const [catRequestClub, setCatRequestClub] = useState('');
  const [catRequestSent, setCatRequestSent] = useState(false);

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
    if (!result.canceled) setCover(result.assets[0].uri);
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, aspect: [1, 1] });
    if (!result.canceled) setLogo(result.assets[0].uri);
  }

  async function handleCategoryRequest() {
    if (!catRequestName.trim()) return;
    await supabase.from('category_requests').insert({
      category_name: catRequestName.trim(),
      club_name: catRequestClub.trim() || null,
      user_id: user?.id ?? null,
    });
    setCatRequestSent(true);
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
      if (!cover_url) { setLoading(false); Alert.alert('Upload failed', `Cover upload returned null.\nURI: ${cover.slice(0, 80)}`); return; }
    }
    if (logo) {
      const ext = (logo.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      logo_url = await uploadImage(logo, 'club-logos', `logos/${ts}.${ext}`);
      if (!logo_url) { setLoading(false); Alert.alert('Upload failed', `Logo upload returned null.\nURI: ${logo.slice(0, 80)}`); return; }
    }

    const { data, error } = await supabase.from('clubs').insert({
      creator_id: user.id,
      name,
      tagline,
      description: description.trim() || null,
      tags,
      category: tags[0] ?? '',
      cover_url,
      logo_url,
      member_count: 1,
      rating: 0,
      city: profile?.city ?? 'Bratislava',
      address: address.trim() || null,
      lat: addressLat ?? null,
      lng: addressLng ?? null,
    }).select().single();

    if (!error && data) {
      await supabase.from('club_members').insert({ club_id: data.id, user_id: user.id, role: 'admin', status: 'approved' });
    }

    setLoading(false);
    if (error) { Alert.alert(t.common.error, error.message); return; }
    router.replace('/(tabs)');
    router.push(`/club/${data.id}`);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: D.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepRow}>
          <BackButton />
          <WMark size={28} color={Colors.lime} />
          <View style={{ width: 36 }} />
        </View>

        <Text style={styles.title}>{t.club.createClub}</Text>

        <View style={styles.form}>
          {/* Club name */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t.club.clubName}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t.club.clubNamePlaceholder}
              placeholderTextColor={D.placeholder}
              selectionColor={Colors.lime}
              maxLength={60}
            />
            {name.length > 16 && <Text style={styles.nameWarning}>{t.club.nameTooLong}</Text>}
          </View>

          {/* Tagline */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t.club.tagline}</Text>
            <TextInput
              style={styles.input}
              value={tagline}
              onChangeText={setTagline}
              placeholder={t.club.taglinePlaceholder}
              placeholderTextColor={D.placeholder}
              selectionColor={Colors.lime}
              maxLength={120}
            />
          </View>

          {/* Address */}
          <VenueInput
            value={address}
            onChange={(v, lat, lng) => { setAddress(v); setAddressLat(lat); setAddressLng(lng); }}
            dark
          />

          {/* Categories */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
              <Text style={styles.label}>{t.club.category}</Text>
              <TouchableOpacity onPress={() => { setShowCatRequest(true); setCatRequestSent(false); setCatRequestName(''); setCatRequestClub(''); }} activeOpacity={0.7}>
                <Text style={styles.catMissingLink}>Chýba ti kategória?</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.catSubLabel}>Vyber všetky ktoré sa hodia</Text>
            <View style={[styles.chipsWrap, { marginTop: 10 }]}>
              {categories.map(cat => {
                const active = tags.includes(cat);
                const disabled = !active && tags.length >= 3;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                    onPress={() => {
                      if (disabled) { Alert.alert('', 'Max 3 categories allowed'); return; }
                      setTags(prev => prev.includes(cat) ? prev.filter(t => t !== cat) : [...prev, cat]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{CATEGORY_SK[cat] ?? cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Logo + Cover */}
          <View style={styles.photosRow}>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>{t.club.logo}</Text>
              <TouchableOpacity style={[styles.logoPicker, logo && { borderColor: Colors.lime, borderStyle: 'solid' }]} onPress={pickLogo} activeOpacity={0.8}>
                {logo
                  ? <Image source={{ uri: logo }} style={styles.logoPreview} />
                  : <Text style={styles.photoPlus}>+</Text>}
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>{t.club.cover}</Text>
              <TouchableOpacity style={[styles.coverPicker, cover && { borderColor: Colors.lime, borderStyle: 'solid' }]} onPress={pickCover} activeOpacity={0.8}>
                {cover
                  ? <Image source={{ uri: cover }} style={styles.coverPreview} />
                  : <View style={styles.coverEmpty}>
                      <Text style={styles.photoPlus}>+</Text>
                      <Text style={styles.coverHint}>16:9</Text>
                    </View>}
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
              placeholderTextColor={D.placeholder}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              selectionColor={Colors.lime}
              maxLength={1000}
            />
          </View>

          <View style={{ gap: 10, paddingTop: 8 }}>
            <Button label={t.club.createClub} onPress={handleCreate} loading={loading} disabled={!name} variant="lime" />
          </View>
        </View>
      </ScrollView>
      {/* Category request modal */}
      <Modal visible={showCatRequest} transparent animationType="slide" onRequestClose={() => setShowCatRequest(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCatRequest(false)} />
        <View style={styles.catModal}>
          <View style={styles.catModalHandle} />
          {catRequestSent ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
              <Text style={styles.catModalTitle}>Request sent!</Text>
              <Text style={styles.catModalSub}>We'll review your suggestion and add it soon.</Text>
              <TouchableOpacity style={styles.catModalBtn} onPress={() => setShowCatRequest(false)} activeOpacity={0.8}>
                <Text style={styles.catModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.catModalTitle}>Request a category</Text>
              <Text style={styles.catModalSub}>Tell us what category you need and we'll add it.</Text>
              <View style={{ gap: 12, marginTop: 20 }}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.catModalLabel}>Category name</Text>
                  <TextInput
                    style={styles.catModalInput}
                    value={catRequestName}
                    onChangeText={setCatRequestName}
                    placeholder="e.g. Cycling, Meditation..."
                    placeholderTextColor={D.placeholder}
                    selectionColor={Colors.lime}
                    maxLength={60}
                  />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={styles.catModalLabel}>Your club name (optional)</Text>
                  <TextInput
                    style={styles.catModalInput}
                    value={catRequestClub}
                    onChangeText={setCatRequestClub}
                    placeholder="e.g. Bratislava Cyclists"
                    placeholderTextColor={D.placeholder}
                    maxLength={80}
                    selectionColor={Colors.lime}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.catModalBtn, !catRequestName.trim() && { opacity: 0.4 }]}
                onPress={handleCategoryRequest}
                disabled={!catRequestName.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.catModalBtnText}>Send request</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingHorizontal: 24 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 30, fontWeight: '800', color: D.text, letterSpacing: -0.8, fontFamily: Fonts.extrabold, marginBottom: 28 },
  subtitle: { fontSize: 14, color: D.label, marginTop: 6, marginBottom: 32 },
  form: { gap: 22 },
  label: { fontSize: 12, fontWeight: '600', color: D.text, letterSpacing: 0.2 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: D.border, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 15, color: D.text, backgroundColor: D.card,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: D.card, borderWidth: 1.5, borderColor: D.border },
  chipActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  chipDisabled: { opacity: 0.3 },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  chipTextActive: { color: Colors.black, fontWeight: '700' },
  photosRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logoPicker: {
    width: 80, height: 80, borderRadius: 20,
    borderWidth: 1.5, borderColor: D.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: D.card,
  },
  logoPreview: { width: '100%', height: '100%' },
  photoPlus: { fontSize: 26, color: 'rgba(255,255,255,0.3)' },
  coverPicker: { height: 80, borderWidth: 1.5, borderColor: D.border, borderRadius: 14, borderStyle: 'dashed', overflow: 'hidden', backgroundColor: D.card },
  coverPreview: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverHint: { fontSize: 11, color: D.label },
  textarea: {
    borderWidth: 1.5, borderColor: D.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: D.text, fontFamily: Fonts.regular,
    minHeight: 88, backgroundColor: D.card,
  },
  nameWarning: { fontSize: 12, color: '#FFD60A', fontFamily: Fonts.regular, marginTop: 6 },
  catMissingLink: { fontSize: 11, color: Colors.lime, fontWeight: '600' },
  catSubLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  catModal: {
    backgroundColor: D.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
    borderTopWidth: 1, borderColor: D.border,
  },
  catModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: D.border, alignSelf: 'center', marginBottom: 20 },
  catModalTitle: { fontSize: 20, fontWeight: '700', color: D.text, marginBottom: 4 },
  catModalSub: { fontSize: 14, color: D.label, lineHeight: 20 },
  catModalLabel: { fontSize: 12, fontWeight: '600', color: D.label, textTransform: 'uppercase', letterSpacing: 0.5 },
  catModalInput: {
    height: 48, borderWidth: 1.5, borderColor: D.border, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 15, color: D.text, backgroundColor: D.bg,
  },
  catModalBtn: {
    marginTop: 24, backgroundColor: Colors.lime, borderRadius: 50,
    paddingVertical: 15, alignItems: 'center',
  },
  catModalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.black },
});
