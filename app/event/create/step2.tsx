import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, Modal, Pressable, TextInput } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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
import { CATEGORY_SK, CATEGORY_EN } from '@/types';
import { draft2 } from '@/lib/eventDraft';

export default function CreateStep2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t, lang } = useTranslations();
  const { categories } = useCategories();
  const [title, setTitle] = useState(draft2.title);
  const [tagline, setTagline] = useState(draft2.tagline);
  const [tags, setTags] = useState<string[]>(draft2.tags);
  const [cover, setCover] = useState<string | null>(draft2.cover);
  const [coverError, setCoverError] = useState(false);
  const [clubs, setClubs] = useState<{ id: string; name: string; logo_url: string | null }[]>([]);
  const [postAs, setPostAs] = useState<string>(draft2.postAs);
  const [showCatRequest, setShowCatRequest] = useState(false);
  const [catRequestName, setCatRequestName] = useState('');
  const [catRequestClub, setCatRequestClub] = useState('');
  const [catRequestSent, setCatRequestSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('clubs').select('id, name, logo_url').eq('creator_id', user.id).order('name'),
      supabase.from('club_members').select('club:clubs(id, name, logo_url)')
        .eq('user_id', user.id).eq('role', 'admin').eq('status', 'approved'),
    ]).then(([owned, adminMemberships]) => {
      const ownedList = (owned.data ?? []) as { id: string; name: string; logo_url: string | null }[];
      const adminList = ((adminMemberships.data ?? []) as any[])
        .map(m => m.club).filter(Boolean) as { id: string; name: string; logo_url: string | null }[];
      // merge, deduplicate by id
      const seen = new Set(ownedList.map(c => c.id));
      const list = [...ownedList, ...adminList.filter(c => !seen.has(c.id))];
      setClubs(list);
      if (draft2.postAs === 'individual' && list.length > 0) {
        setPostAs(list[0].id);
      }
    });
  }, [user]);

  // Keep draft in sync
  useEffect(() => {
    draft2.title = title; draft2.tagline = tagline; draft2.tags = tags;
    draft2.cover = cover; draft2.postAs = postAs;
  }, [title, tagline, tags, cover, postAs]);

  const wordCount = tagline.trim() === '' ? 0 : tagline.trim().split(/\s+/).length;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
    if (!result.canceled) {
      const src = result.assets[0].uri;
      // Copy to stable cache path so the URI doesn't expire before upload (esp. on iOS ph:// URIs)
      try {
        const dest = `${FileSystem.cacheDirectory}cover_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: src, to: dest });
        setCover(dest);
      } catch {
        setCover(src); // fallback to original if copy fails
      }
    }
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

  function toggleTag(cat: string) {
    setTags(prev => {
      if (prev.includes(cat)) return prev.filter(t => t !== cat);
      if (prev.length >= 2) { Alert.alert('', 'Max 2 categories allowed'); return prev; }
      return [...prev, cat];
    });
  }

  function handleNext() {
    if (!title || tags.length === 0) return;
    if (!cover) { setCoverError(true); return; }
    router.push({ pathname: '/event/create/step3', params: { title, tagline, tags: JSON.stringify(tags), cover, postAs } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          </View>
          <WMark size={30} color={Colors.lime} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={styles.stepBadge}><Text style={styles.stepText}>{t.event.step(2, 3)}</Text></View>
          </View>
        </View>

        <Text style={styles.title}>{t.event.newEvent}</Text>

        <View style={styles.form}>
          <Input
            label={t.event.eventName}
            value={title}
            onChangeText={setTitle}
            placeholder={t.event.eventNamePlaceholder}
            maxLength={120}
          />

          {/* Post as selector */}
          <View>
            <Text style={styles.label}>{t.event.postAs}</Text>
            <View style={styles.postAsList}>
              {clubs.map(club => {
                const active = postAs === club.id;
                const initial = club.name.charAt(0).toUpperCase();
                return (
                  <TouchableOpacity
                    key={club.id}
                    style={[styles.postAsRow, active && styles.postAsRowActive]}
                    onPress={() => setPostAs(club.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.postAsAvatar}>
                      {club.logo_url
                        ? <Image source={{ uri: club.logo_url }} style={styles.postAsAvatarImg} />
                        : <Text style={[styles.postAsAvatarInitial, active && { color: Colors.lime }]}>{initial}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.postAsTitle, active && styles.postAsTitleActive]}>{club.name}</Text>
                      <Text style={[styles.postAsSub, active && styles.postAsSubActive]}>{t.event.myClub}</Text>
                    </View>
                    <View style={[styles.postAsRadio, active && styles.postAsRadioActive]}>
                      {active && <View style={styles.postAsRadioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {/* Individual option */}
              <TouchableOpacity
                style={[styles.postAsRow, postAs === 'individual' && styles.postAsRowActive]}
                onPress={() => setPostAs('individual')}
                activeOpacity={0.8}
              >
                <View style={[styles.postAsAvatar, { backgroundColor: postAs === 'individual' ? Colors.lime : Colors.grayLight }]}>
                  <Text style={[styles.postAsAvatarInitial, postAs === 'individual' && { color: Colors.black }]}>
                    {(profile?.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.postAsTitle, postAs === 'individual' && styles.postAsTitleActive]}>{profile?.name || t.chat.you}</Text>
                  <Text style={[styles.postAsSub, postAs === 'individual' && styles.postAsSubActive]}>{t.event.individual}</Text>
                </View>
                <View style={[styles.postAsRadio, postAs === 'individual' && styles.postAsRadioActive]}>
                  {postAs === 'individual' && <View style={styles.postAsRadioDot} />}
                </View>
              </TouchableOpacity>

              {clubs.length === 0 && (
                <TouchableOpacity onPress={() => router.push('/club/create' as any)} activeOpacity={0.7} style={{ paddingTop: 6 }}>
                  <Text style={styles.createClubLink}>{t.event.createClubLink}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
              maxLength={300}
            />
            {wordCount > 28 && wordCount <= 30 && (
              <Text style={styles.hint}>{t.event.wordsLeft(30 - wordCount)}</Text>
            )}
            {wordCount >= 30 && (
              <Text style={styles.hintOver}>{t.event.wordsLimit}</Text>
            )}
          </View>

          {/* Tags picker */}
          <View>
            <View style={styles.labelRow}>
              <View style={{ gap: 2 }}>
                <Text style={[styles.label, { marginBottom: 0 }]}>{t.event.category}</Text>
                <Text style={[styles.labelRequired, { fontSize: 10 }]}>Vyber všetky ktoré sa hodia</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowCatRequest(true); setCatRequestSent(false); setCatRequestName(''); setCatRequestClub(''); }} activeOpacity={0.7}>
                <Text style={styles.catMissingLink}>Chýba ti kategória?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.chipsWrap, { marginTop: 10 }]}>
              {categories.map(cat => {
                const active = tags.includes(cat);
                const disabled = !active && tags.length >= 2;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                    onPress={() => toggleTag(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{lang === 'sk' ? (CATEGORY_SK[cat] ?? cat) : (CATEGORY_EN[cat] ?? cat)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Cover photo */}
          <View>
            <Text style={[styles.label, { marginBottom: 6 }]}>{t.event.coverPhoto.split(' (')[0]}</Text>
            <TouchableOpacity
              style={[styles.coverPicker, coverError && !cover && styles.coverPickerError]}
              onPress={() => { setCoverError(false); pickImage(); }}
            >
              {cover ? (
                <Image source={{ uri: cover }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverEmpty}>
                  <Text style={styles.coverPlus}>+</Text>
                  <Text style={styles.coverHint}>{t.event.addCoverImage}</Text>
                </View>
              )}
            </TouchableOpacity>
            {coverError && !cover && (
              <Text style={styles.coverErrorText}>{lang === 'sk' ? 'Pridaj titulnú fotku pred pokračovaním.' : 'Add a cover photo before continuing.'}</Text>
            )}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button label={t.common.next} onPress={handleNext} disabled={!title || tags.length === 0} variant="black" />
          <Button label={t.common.back} onPress={() => router.back()} variant="ghost" />
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
                    placeholderTextColor={Colors.gray}
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
                    placeholderTextColor={Colors.gray}
                    selectionColor={Colors.lime}
                    maxLength={80}
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
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 18, color: Colors.black, marginTop: -1 },
  stepBadge: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 6 },
  stepText: { fontSize: 13, fontWeight: '600', color: Colors.black },
  title: { fontSize: 28, fontWeight: '700', color: Colors.black, marginBottom: 28, letterSpacing: -0.5 },
  form: { gap: 20 },
  label: { fontSize: 13, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight, borderWidth: 1.5, borderColor: 'transparent' },
  chipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 13, color: Colors.black, fontWeight: '500', fontFamily: Fonts.medium },
  chipTextActive: { color: Colors.lime, fontWeight: '700', fontFamily: Fonts.bold },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  labelRequired: { fontSize: 11, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, letterSpacing: 0.4, opacity: 0.45 },
  labelRequiredOver: { color: '#EF4444' },
  hint: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 4, marginLeft: 2 },
  hintOver: { fontSize: 11, color: '#EF4444', fontFamily: Fonts.medium, marginTop: 4, marginLeft: 2 },
  coverPicker: { height: 160, borderWidth: 1, borderColor: '#D8D8D8', borderRadius: 16, borderStyle: 'dashed', overflow: 'hidden', backgroundColor: '#FAFAFA' },
  coverPickerRequired: { borderColor: '#BDBDBD' },
  coverPickerError: { borderColor: '#EF4444', borderStyle: 'dashed' },
  coverErrorText: { fontSize: 12, color: '#EF4444', fontFamily: Fonts.regular, marginTop: 6 },
  coverPreview: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverPlus: { fontSize: 28, color: '#C8C8C8' },
  coverHint: { fontSize: 13, color: '#ABABAB', fontFamily: Fonts.regular },
  chipMissing: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  chipMissingText: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.regular },
  footer: { paddingTop: 24, gap: 8 },
  posterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.grayLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  posterInfo: { gap: 2 },
  posterLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.medium, letterSpacing: 0.3 },
  posterName: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  createClubLink: { fontSize: 13, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  postAsList: { gap: 8 },
  postAsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.grayBorder,
    backgroundColor: Colors.white,
  },
  postAsRowActive: { borderColor: Colors.black, backgroundColor: Colors.black },
  postAsAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  postAsAvatarImg: { width: 40, height: 40 },
  postAsAvatarInitial: { fontSize: 17, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
  postAsTitle: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black, marginBottom: 1 },
  postAsTitleActive: { color: Colors.white },
  postAsSub: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  postAsSubActive: { color: 'rgba(255,255,255,0.55)' },
  postAsRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.grayBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  postAsRadioActive: { borderColor: Colors.white },
  postAsRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  catMissingLink: { fontSize: 11, color: Colors.black, fontWeight: '600', textDecorationLine: 'underline' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  catModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
    borderTopWidth: 1, borderColor: Colors.grayBorder,
  },
  catModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 20 },
  catModalTitle: { fontSize: 20, fontWeight: '700', color: Colors.black, marginBottom: 4 },
  catModalSub: { fontSize: 14, color: Colors.gray, lineHeight: 20 },
  catModalLabel: { fontSize: 12, fontWeight: '600', color: Colors.gray, letterSpacing: 0.2 },
  catModalInput: {
    height: 48, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 15, color: Colors.black, backgroundColor: Colors.grayLight,
  },
  catModalBtn: {
    marginTop: 24, backgroundColor: Colors.black, borderRadius: 50,
    paddingVertical: 15, alignItems: 'center',
  },
  catModalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
});
