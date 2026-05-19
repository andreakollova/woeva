import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Image, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
import { VenueInput } from '@/components/ui/VenueInput';
import { useCategories } from '@/hooks/useCategories';
import { useTranslations } from '@/context/LanguageContext';

export default function ClubEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslations();
  const { categories } = useCategories();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressLat, setAddressLat] = useState<number | undefined>();
  const [addressLng, setAddressLng] = useState<number | undefined>();
  const [orig, setOrig] = useState({ name: '', tagline: '', description: '', tags: [] as string[], address: '' });
  const [showCategories, setShowCategories] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.from('clubs').select('name, tagline, description, category, tags, cover_url, logo_url, address, lat, lng').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return;
        const n = data.name ?? '';
        const tl = data.tagline ?? '';
        const desc = data.description ?? '';
        const tgs = data.tags?.length ? data.tags : (data.category ? [data.category] : []);
        const addr = data.address ?? '';
        setName(n); setTagline(tl); setDescription(desc); setTags(tgs);
        setExistingCoverUrl(data.cover_url ?? null);
        setExistingLogoUrl(data.logo_url ?? null);
        setAddress(addr);
        setAddressLat(data.lat ?? undefined);
        setAddressLng(data.lng ?? undefined);
        setOrig({ name: n, tagline: tl, description: desc, tags: tgs, address: addr });
      });
  }, [id]);

  const isDirty = name !== orig.name
    || tagline !== orig.tagline
    || description !== orig.description
    || address !== orig.address
    || JSON.stringify(tags) !== JSON.stringify(orig.tags)
    || cover !== null
    || logo !== null;

  async function pickCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
    if (!result.canceled) setCover(result.assets[0].uri);
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, aspect: [1, 1] });
    if (!result.canceled) setLogo(result.assets[0].uri);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);

    const ts = Date.now();
    let cover_url = existingCoverUrl;
    let logo_url = existingLogoUrl;

    if (cover) {
      const ext = (cover.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      const uploaded = await uploadImage(cover, 'club-covers', `${id}_cover_${ts}.${ext}`);
      if (!uploaded) {
        setLoading(false);
        Alert.alert('Upload failed', 'Could not upload the cover image. Check that the "club-covers" bucket exists in Supabase Storage and is public.');
        return;
      }
      cover_url = uploaded;
    }
    if (logo) {
      const ext = (logo.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      const uploaded = await uploadImage(logo, 'club-logos', `${id}_logo_${ts}.${ext}`);
      if (!uploaded) {
        setLoading(false);
        Alert.alert('Upload failed', 'Could not upload the logo image. Check that the "club-logos" bucket exists in Supabase Storage and is public.');
        return;
      }
      logo_url = uploaded;
    }

    const { error } = await supabase.from('clubs').update({
      name: name.trim(),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      tags,
      category: tags[0] || null,
      cover_url,
      logo_url,
      address: address.trim() || null,
      lat: addressLat ?? null,
      lng: addressLng ?? null,
    }).eq('id', id);

    setLoading(false);
    if (error) { Alert.alert(t.common.error, error.message); return; }
    router.back();
  }

  async function confirmDelete() {
    setDeleting(true);

    // 1. Get ALL events for this club (past + upcoming)
    const { data: allEvents } = await supabase
      .from('events')
      .select('id, title, date')
      .eq('club_id', id);

    const allEventIds = (allEvents ?? []).map(e => e.id);

    if (allEventIds.length > 0) {
      // 2. Notify attendees of upcoming events
      const now = new Date().toISOString().slice(0, 10);
      const upcomingEvents = (allEvents ?? []).filter(e => e.date >= now);
      const upcomingIds = upcomingEvents.map(e => e.id);

      if (upcomingIds.length > 0) {
        const { data: attendees } = await supabase
          .from('event_attendees')
          .select('user_id, event_id')
          .in('event_id', upcomingIds);

        if (attendees && attendees.length > 0) {
          const eventTitles: Record<string, string> = {};
          upcomingEvents.forEach(e => { eventTitles[e.id] = e.title; });
          await supabase.from('notifications').insert(
            attendees.map(a => ({
              user_id: a.user_id,
              type: 'event_cancelled',
              title: 'Club deleted',
              body: `"${name}" was deleted. Your spot at "${eventTitles[a.event_id] ?? 'an event'}" has been cancelled.`,
              data: { event_id: a.event_id },
              read: false,
            }))
          );
        }
      }

      // 3. Delete event_attendees for all club events
      await supabase.from('event_attendees').delete().in('event_id', allEventIds);

      // 4. Delete messages (chat) for all club events
      await supabase.from('messages').delete().in('room_id', allEventIds);

      // 5. Delete the events themselves
      await supabase.from('events').delete().eq('club_id', id);
    }

    // 6. Delete club members
    await supabase.from('club_members').delete().eq('club_id', id);

    // 7. Delete the club
    await supabase.from('clubs').delete().eq('id', id);

    setDeleting(false);
    setShowDeleteModal(false);
    navigation.dispatch(StackActions.pop(2));
  }

  const coverSource = cover ?? existingCoverUrl;
  const logoSource = logo ?? existingLogoUrl;
  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Modal visible={showDeleteModal} animationType="slide" transparent onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteSheet}>
            <View style={styles.deleteSheetHandle} />
            <View style={styles.deleteWarningIcon}>
              <Text style={styles.deleteWarningEmoji}>⚠️</Text>
            </View>
            <Text style={styles.deleteSheetTitle}>{t.club.deleteTitle(name)}</Text>
            <Text style={styles.deleteSheetBody}>
              {t.club.deleteBodyIntro}{'\n\n'}{t.club.deleteBody}
            </Text>
            <View style={styles.deleteSheetActions}>
              {deleting
                ? <ActivityIndicator color={Colors.black} style={{ marginVertical: 16 }} />
                : <>
                    <TouchableOpacity style={styles.deleteConfirmBtn} onPress={() => {
                      Alert.alert(
                        t.club.deleteWarning,
                        t.club.deleteLastWarning(name),
                        [
                          { text: t.club.noKeepIt, style: 'cancel' },
                          { text: t.club.deleteForever, style: 'destructive', onPress: confirmDelete },
                        ]
                      );
                    }}>
                      <Text style={styles.deleteConfirmText}>{t.club.yesDeleteClub}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setShowDeleteModal(false)}>
                      <Text style={styles.deleteCancelText}>{t.club.keepClub}</Text>
                    </TouchableOpacity>
                  </>
              }
            </View>
          </View>
        </View>
      </Modal>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <BackButton />
          <Text style={styles.pageTitle}>{t.club.editClub}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.form}>
          <Input label={t.club.clubName} value={name} onChangeText={setName} placeholder={t.club.clubNamePlaceholderEdit} />
          <Input label={t.club.tagline} value={tagline} onChangeText={setTagline} placeholder={t.club.taglinePlaceholderEdit} />

          <VenueInput
            value={address}
            onChange={(v, lat, lng) => { setAddress(v); setAddressLat(lat); setAddressLng(lng); }}
          />

          {/* About */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t.club.aboutTitle}</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder={t.club.aboutPlaceholder}
              placeholderTextColor={Colors.gray}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Logo + Cover */}
          <View style={styles.photosRow}>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>{t.club.logo}</Text>
              <TouchableOpacity style={styles.logoPicker} onPress={pickLogo} activeOpacity={0.8}>
                {logoSource ? (
                  <Image source={{ uri: logoSource }} style={styles.logoPreview} />
                ) : (
                  <View style={[styles.logoPreview, styles.logoFallback]}>
                    <Text style={styles.logoInitial}>{initial}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.label}>{t.club.cover}</Text>
              <TouchableOpacity style={styles.coverPicker} onPress={pickCover} activeOpacity={0.8}>
                {coverSource ? (
                  <Image source={{ uri: coverSource }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverEmpty}>
                    <Text style={styles.photoPlus}>+</Text>
                    <Text style={styles.coverHint}>16:9</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Category chips — multi (max 3) */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.label}>{t.club.category}</Text>
              <Text style={{ fontSize: 11, color: Colors.gray }}>{tags.length}/3</Text>
            </View>
            <View style={styles.chipsWrap}>
              {categories.map(cat => {
                const active = tags.includes(cat);
                const disabled = !active && tags.length >= 3;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.35 }]}
                    onPress={() => {
                      if (disabled) return;
                      setTags(prev => prev.includes(cat) ? prev.filter(t => t !== cat) : [...prev, cat]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 8, paddingTop: 8, paddingBottom: insets.bottom + 24 }}>
            <Button label={t.common.cancel} onPress={() => router.back()} variant="ghost" />
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteModal(true)}>
              <Text style={styles.deleteBtnText}>{t.club.deleteClub}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {isDirty && (
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + 12 }]}>
          <Button label={t.club.saveChanges} onPress={handleSave} loading={loading} disabled={!name.trim()} variant="black" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  pageTitle: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  form: { gap: 20 },
  label: { fontSize: 13, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  textarea: {
    borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.black, fontFamily: Fonts.regular,
    minHeight: 80,
  },
  selector: { height: 44, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  selectorValue: { fontSize: 14, color: Colors.black },
  selectorPlaceholder: { fontSize: 14, color: Colors.gray },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight, borderWidth: 1.5, borderColor: 'transparent' },
  chipActive: { backgroundColor: Colors.black },
  chipText: { fontSize: 13, color: Colors.black, fontWeight: '500' },
  chipTextActive: { color: Colors.lime, fontWeight: '700' },
  photosRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  logoPicker: {
    width: 80, height: 80, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.grayBorder, borderStyle: 'dashed',
    overflow: 'hidden',
  },
  logoPreview: { width: '100%', height: '100%' },
  logoFallback: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 28, fontWeight: '800', color: Colors.white, fontFamily: Fonts.extrabold },
  photoPlus: { fontSize: 24, color: Colors.gray },
  coverPicker: { height: 80, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, borderStyle: 'dashed', overflow: 'hidden' },
  coverPreview: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverHint: { fontSize: 11, color: Colors.gray },
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#CC3333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  deleteSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, gap: 12 },
  deleteSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.grayBorder, alignSelf: 'center', marginBottom: 8 },
  deleteWarningIcon: { alignSelf: 'center', marginBottom: 4 },
  deleteWarningEmoji: { fontSize: 40 },
  deleteSheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.black, fontFamily: Fonts.bold, textAlign: 'center' },
  deleteSheetBody: { fontSize: 14, color: '#555', fontFamily: Fonts.regular, lineHeight: 22, textAlign: 'left', backgroundColor: '#FFF5F5', borderRadius: 12, padding: 16 },
  deleteSheetActions: { gap: 10, marginTop: 4 },
  deleteConfirmBtn: { backgroundColor: '#CC3333', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  deleteConfirmText: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
  deleteCancelBtn: { backgroundColor: Colors.grayLight, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  deleteCancelText: { fontSize: 15, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold },
  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.grayBorder,
  },
});
