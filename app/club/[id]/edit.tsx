import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Image, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';
import { CATEGORIES } from '@/types';

export default function ClubEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.from('clubs').select('name, tagline, description, category, cover_url, logo_url').eq('id', id).single()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name ?? '');
        setTagline(data.tagline ?? '');
        setDescription(data.description ?? '');
        setCategory(data.category ?? '');
        setExistingCoverUrl(data.cover_url ?? null);
        setExistingLogoUrl(data.logo_url ?? null);
      });
  }, [id]);

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
      cover_url = await uploadImage(cover, 'club-covers', `${id}_cover_${ts}.${ext}`) ?? existingCoverUrl;
    }
    if (logo) {
      const ext = (logo.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      logo_url = await uploadImage(logo, 'club-logos', `${id}_logo_${ts}.${ext}`) ?? existingLogoUrl;
    }

    const { error } = await supabase.from('clubs').update({
      name: name.trim(),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      category: category || null,
      cover_url,
      logo_url,
    }).eq('id', id);

    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.back();
  }

  async function confirmDelete() {
    setDeleting(true);

    // Find upcoming events in this club
    const now = new Date().toISOString().slice(0, 10);
    const { data: upcomingEvents } = await supabase
      .from('events')
      .select('id, title')
      .eq('club_id', id)
      .gte('date', now);

    if (upcomingEvents && upcomingEvents.length > 0) {
      const eventIds = upcomingEvents.map(e => e.id);

      // Find all attendees of those events
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('user_id, event_id')
        .in('event_id', eventIds);

      // Send notification to each unique attendee
      if (attendees && attendees.length > 0) {
        const eventTitles: Record<string, string> = {};
        upcomingEvents.forEach(e => { eventTitles[e.id] = e.title; });

        const notifications = attendees.map(a => ({
          user_id: a.user_id,
          type: 'cancelled',
          title: 'Club deleted',
          body: `"${name}" was deleted. Your spot at "${eventTitles[a.event_id] ?? 'an event'}" has been cancelled.`,
          data: { event_id: a.event_id },
          read: false,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    // Delete the club (cascade handles events, members)
    await supabase.from('clubs').delete().eq('id', id);
    setDeleting(false);
    setShowDeleteModal(false);
    router.dismiss(2);
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
            <Text style={styles.deleteSheetTitle}>Delete "{name}"?</Text>
            <Text style={styles.deleteSheetBody}>
              This action is permanent and cannot be undone.{'\n\n'}
              • All events in this club will be removed{'\n'}
              • All members will lose access{'\n'}
              • Everyone registered for upcoming events will receive a cancellation notification
            </Text>
            <View style={styles.deleteSheetActions}>
              {deleting
                ? <ActivityIndicator color={Colors.black} style={{ marginVertical: 16 }} />
                : <>
                    <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete}>
                      <Text style={styles.deleteConfirmText}>Yes, delete club</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setShowDeleteModal(false)}>
                      <Text style={styles.deleteCancelText}>Keep club</Text>
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
          <Text style={styles.pageTitle}>Edit club</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.form}>
          <Input label="Club name" value={name} onChangeText={setName} placeholder="Your club name" />
          <Input label="Tagline" value={tagline} onChangeText={setTagline} placeholder="Short description" />

          {/* About */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>About</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder="What's your club about?"
              placeholderTextColor={Colors.gray}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Category chips */}
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipsWrap}>
              {CATEGORIES.map(cat => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(active ? '' : cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Logo + Cover */}
          <View style={styles.photosRow}>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Logo</Text>
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
              <Text style={styles.label}>Cover photo</Text>
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
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Save changes" onPress={handleSave} loading={loading} variant="black" disabled={!name.trim()} />
        <Button label="Cancel" onPress={() => router.back()} variant="ghost" />
        <TouchableOpacity style={styles.deleteBtn} onPress={() => setShowDeleteModal(true)}>
          <Text style={styles.deleteBtnText}>Delete club</Text>
        </TouchableOpacity>
      </View>
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
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8, backgroundColor: Colors.white },
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
});
