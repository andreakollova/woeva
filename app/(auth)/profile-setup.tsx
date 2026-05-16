import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Potrebné povolenie', 'Povol prístup k fotkám v nastaveniach.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      aspect: [1, 1],
      allowsEditing: true,
    });
    if (!result.canceled) setAvatar(result.assets[0].uri);
  }

  async function handleContinue(skip = false) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !skip) {
        let avatar_url: string | null = null;
        if (avatar) {
          const ext = (avatar.split('.').pop() ?? 'jpg').toLowerCase().replace('heic', 'jpg');
          avatar_url = await uploadImage(avatar, 'avatars', `avatars/${user.id}.${ext}`);
        }
        const patch: Record<string, unknown> = { id: user.id };
        if (avatar_url) patch.avatar_url = `${avatar_url}?t=${Date.now()}`;
        if (bio.trim()) patch.bio = bio.trim();
        if (avatar_url || bio.trim()) {
          await supabase.from('profiles').upsert(patch);
        }
      }
    } finally {
      setLoading(false);
    }
    router.push('/(auth)/interests');
  }

  const hasPhoto = !!avatar;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Skip button top-right */}
        <TouchableOpacity style={styles.skipTop} onPress={() => handleContinue(true)} activeOpacity={0.7}>
          <Text style={styles.skipText}>Preskočiť</Text>
        </TouchableOpacity>

        {/* Heading */}
        <View style={styles.header}>
          <Text style={styles.title}>Ako vyzeráš?</Text>
          <Text style={styles.subtitle}>
            Profilovka zvyšuje dôveru — ľudia ťa radšej pozvú na event.
          </Text>
        </View>

        {/* Avatar picker */}
        <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.85}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarEmpty}>
              <Text style={styles.avatarIcon}>📷</Text>
              <Text style={styles.avatarHint}>Pridaj fotku</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>{hasPhoto ? '✓' : '+'}</Text>
          </View>
        </TouchableOpacity>

        {hasPhoto && (
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} style={styles.changePhotoBtn}>
            <Text style={styles.changePhotoText}>Zmeniť fotku</Text>
          </TouchableOpacity>
        )}

        {/* Motivation nudge */}
        {!hasPhoto && (
          <View style={styles.nudge}>
            <Text style={styles.nudgeText}>
              👥  Udalosti s profilovkou dostávajú{' '}
              <Text style={styles.nudgeBold}>3× viac záujmu</Text>
            </Text>
          </View>
        )}

        {/* Bio */}
        <View style={styles.bioWrap}>
          <Text style={styles.label}>Krátke bio <Text style={styles.optional}>(nepovinné)</Text></Text>
          <TextInput
            style={styles.bioInput}
            placeholder="Pár slov o sebe..."
            placeholderTextColor={Colors.gray}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={120}
          />
          <Text style={styles.charCount}>{bio.length}/120</Text>
        </View>

        {/* Continue */}
        <View style={styles.footer}>
          <Button
            label={hasPhoto || bio.trim() ? 'Pokračovať →' : 'Pokračovať bez fotky'}
            onPress={() => handleContinue(false)}
            loading={loading}
            variant={hasPhoto ? 'lime' : 'black'}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },

  skipTop: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 2, marginBottom: 8 },
  skipText: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },

  header: { marginBottom: 36, gap: 8 },
  title: { fontSize: 30, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 22 },

  avatarWrap: { alignSelf: 'center', marginBottom: 12, position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarEmpty: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.grayLight,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 2, borderColor: Colors.grayBorder, borderStyle: 'dashed',
  },
  avatarIcon: { fontSize: 32 },
  avatarHint: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular },
  avatarBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.black,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  avatarBadgeText: { fontSize: 14, color: Colors.white, fontWeight: '700' },

  changePhotoBtn: { alignSelf: 'center', marginBottom: 20 },
  changePhotoText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, textDecorationLine: 'underline' },

  nudge: {
    backgroundColor: Colors.grayLight,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 28,
  },
  nudgeText: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, textAlign: 'center' },
  nudgeBold: { fontFamily: Fonts.bold, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, marginBottom: 8 },
  optional: { fontWeight: '400', color: Colors.gray, fontFamily: Fonts.regular },
  bioWrap: { marginBottom: 32 },
  bioInput: {
    borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.black, fontFamily: Fonts.regular,
    minHeight: 90, textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: Colors.gray, textAlign: 'right', marginTop: 4 },

  footer: {},
});
