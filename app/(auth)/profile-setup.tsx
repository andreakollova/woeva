import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from '@/context/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [googleAvatar, setGoogleAvatar] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const pic = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;
      if (pic) setGoogleAvatar(pic);
      const metaName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '';
      if (metaName) setName(metaName);
    });
  }, []);
  const [loading, setLoading] = useState(false);
  const [socialAvatars, setSocialAvatars] = useState<{ id: string; avatar_url: string }[]>([]);

  React.useEffect(() => {
    supabase.from('profiles').select('id, avatar_url').not('avatar_url', 'is', null).limit(12).then(({ data }) => {
      setSocialAvatars((data ?? []).filter((p: any) => p.avatar_url));
    });
  }, []);

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
        if (name.trim()) patch.name = name.trim();
        if (avatar_url) patch.avatar_url = `${avatar_url}?t=${Date.now()}`;
        else if (googleAvatar) patch.avatar_url = googleAvatar;
        if (bio.trim()) patch.bio = bio.trim();
        await supabase.from('profiles').upsert(patch);
      }
    } finally {
      setLoading(false);
    }
    router.push('/(auth)/interests');
  }

  const hasPhoto = !!avatar || !!googleAvatar;
  const displayAvatar = avatar ?? googleAvatar;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Heading */}
        <View style={styles.header}>
          <Text style={styles.title}>{t.auth.profileSetupTitle}</Text>
          <Text style={styles.subtitle}>{t.auth.profileSetupSubtitle}</Text>
        </View>

        {/* Avatar picker */}
        <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.85}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarEmpty}>
              <Text style={styles.avatarIcon}>+</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>{hasPhoto ? '✓' : '+'}</Text>
          </View>
        </TouchableOpacity>

        {hasPhoto && (
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} style={styles.changePhotoBtn}>
            <Text style={styles.changePhotoText}>{t.auth.changePhoto}</Text>
          </TouchableOpacity>
        )}

        {/* Social proof */}
        {!hasPhoto && (
          <View style={styles.socialProof}>
            <View style={styles.avatarRow}>
              {socialAvatars.slice(0, 8).map((p, i) => (
                <Image
                  key={p.id}
                  source={{ uri: p.avatar_url }}
                  style={[styles.socialAvatar, i > 0 && { marginLeft: -10 }]}
                  onError={() => setSocialAvatars(prev => prev.filter(a => a.id !== p.id))}
                />
              ))}
            </View>
            <Text style={styles.socialProofText}>{t.auth.addYourPhoto}</Text>
          </View>
        )}

        {/* Name */}
        <View style={styles.bioWrap}>
          <Text style={styles.label}>{t.auth.yourName}</Text>
          <TextInput
            style={[styles.bioInput, { minHeight: undefined, height: 52, paddingVertical: 14 }]}
            placeholder={t.auth.fullNamePlaceholder}
            placeholderTextColor={Colors.gray}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoCapitalize="words"
          />
        </View>

        {/* Bio */}
        <View style={styles.bioWrap}>
          <Text style={styles.label}>{t.auth.shortBio} <Text style={styles.optional}>{t.auth.bioOptional}</Text></Text>
          <TextInput
            style={styles.bioInput}
            placeholder={t.auth.bioPlaceholder}
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
            label={hasPhoto || bio.trim() ? t.auth.continueBtn : t.auth.continueWithoutPhoto}
            onPress={() => handleContinue(false)}
            loading={loading}
            variant={hasPhoto ? 'lime' : 'black'}
          />
          <TouchableOpacity style={styles.skipBottom} onPress={() => handleContinue(true)} activeOpacity={0.7}>
            <Text style={styles.skipText}>{t.auth.skip}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },

  skipBottom: { alignSelf: 'center', marginTop: 16, paddingVertical: 4 },
  skipText: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, textDecorationLine: 'underline' },

  header: { marginBottom: 40, gap: 6 },
  title: { fontSize: 32, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular, lineHeight: 22 },

  avatarWrap: { alignSelf: 'center', marginBottom: 14, position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarEmpty: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.grayLight,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 2, borderColor: Colors.grayBorder, borderStyle: 'dashed',
  },
  avatarIcon: { fontSize: 40, color: Colors.gray, fontWeight: '300', lineHeight: 44 },
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

  socialProof: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: '#E0E0E0',
  },
  socialAvatarPlaceholder: {
    backgroundColor: '#E8E8E8',
  },
  socialProofText: {
    fontSize: 13,
    color: Colors.gray,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },

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
