import { BackButton } from '@/components/ui/BackButton';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/uploadImage';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES } from '@/types';

const CITIES = ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica', 'Other'];

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refetchProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [loading, setLoading] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [1, 1] });
    if (!result.canceled) setAvatar(result.assets[0].uri);
  }

  async function handleSave() {
    if (!user) return;
    setLoading(true);

    let avatar_url = profile?.avatar_url ?? null;
    if (avatar && avatar !== profile?.avatar_url) {
      const ext = (avatar.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
      const uploaded = await uploadImage(avatar, 'avatars', `avatars/${user.id}.${ext}`);
      if (!uploaded) {
        Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
        setLoading(false);
        return;
      }
      avatar_url = `${uploaded}?t=${Date.now()}`;
    }

    const { error } = await supabase.from('profiles').upsert({ id: user.id, name, bio, city, avatar_url, interests });
    setLoading(false);
    if (error) { Alert.alert('Error saving', error.message); return; }
    await refetchProfile?.();
    setSaved(true);
    setTimeout(() => router.back(), 1400);
  }

  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>Edit profile</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>✎</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Fields */}
        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={[styles.fieldInput, focusedField === 'name' && styles.fieldInputFocused]}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={Colors.gray}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Bio */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti, focusedField === 'bio' && styles.fieldInputFocused]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people a bit about yourself..."
              placeholderTextColor={Colors.gray}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              onFocus={() => setFocusedField('bio')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* City */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>City</Text>
            <TouchableOpacity
              style={[styles.fieldInput, styles.fieldInputRow, focusedField === 'city' && styles.fieldInputFocused]}
              onPress={() => setShowCities(!showCities)}
            >
              <Text style={city ? styles.fieldValue : styles.fieldPlaceholder}>{city || 'Select city'}</Text>
              <Text style={styles.chevron}>{showCities ? '▴' : '▾'}</Text>
            </TouchableOpacity>
            {showCities && (
              <View style={styles.dropdown}>
                {CITIES.map((c, i) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.dropdownItem, i === CITIES.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => { setCity(c); setShowCities(false); }}
                  >
                    <Text style={[styles.dropdownText, city === c && styles.dropdownTextActive]}>{c}</Text>
                    {city === c && <Text style={styles.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Interests */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Interests</Text>
            <Text style={styles.fieldHint}>Select what you're into — used to recommend events</Text>
            <View style={styles.chipsWrap}>
              {CATEGORIES.map(cat => {
                const active = interests.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setInterests(prev => active ? prev.filter(i => i !== cat) : [...prev, cat])}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Save changes" onPress={handleSave} loading={loading} variant="black" />
      </View>

      <Toast visible={saved} title="Profile saved" subtitle="Looking good!" onHide={() => setSaved(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, fontWeight: '600', color: Colors.black },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  avatarSection: { alignItems: 'center', marginBottom: 36, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 40, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.black,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  avatarBadgeText: { fontSize: 13, color: Colors.white },
  avatarHint: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular },
  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.black,
    backgroundColor: Colors.white,
  },
  fieldInputFocused: { borderColor: Colors.black },
  fieldInputMulti: { height: 100, textAlignVertical: 'top' },
  fieldInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.black },
  fieldPlaceholder: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.gray },
  chevron: { fontSize: 13, color: Colors.gray },
  dropdown: {
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: -8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: Colors.grayBorder,
  },
  dropdownText: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.black },
  dropdownTextActive: { fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  dropdownCheck: { fontSize: 15, color: Colors.lime, fontWeight: '700' },
  fieldHint: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: -4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight, borderWidth: 1.5, borderColor: 'transparent' },
  chipActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.black, fontWeight: '500' },
  chipTextActive: { color: Colors.lime, fontWeight: '700', fontFamily: Fonts.bold },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, backgroundColor: Colors.white },
});
