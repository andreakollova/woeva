import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const CITIES = ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Nitra', 'Banská Bystrica', 'Other'];

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refetchProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [loading, setLoading] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [saved, setSaved] = useState(false);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [1, 1] });
    if (!result.canceled) setAvatar(result.assets[0].uri);
  }

  async function handleSave() {
    if (!user) return;
    setLoading(true);

    let avatar_url = profile?.avatar_url ?? null;
    if (avatar && avatar !== profile?.avatar_url) {
      const ext = avatar.split('.').pop();
      const path = `avatars/${user.id}.${ext}`;
      const blob = await fetch(avatar).then(r => r.blob());
      await supabase.storage.from('avatars').upload(path, blob, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      avatar_url = data.publicUrl;
    }

    const { error } = await supabase.from('profiles').upsert({ id: user.id, name, bio, city, avatar_url });
    setLoading(false);
    if (error) { Alert.alert('Error saving', error.message); return; }
    await refetchProfile?.();
    setSaved(true);
    setTimeout(() => router.back(), 1600);
  }

  const initial = name.charAt(0).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit profile info</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              <Text style={styles.avatarEditIcon}>✎</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Input label="Your name" value={name} onChangeText={setName} placeholder="Daniela Vranovská" />

          <View>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Bratislava based. Book lover, love to eat"
              placeholderTextColor={Colors.gray}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View>
            <Text style={styles.label}>City</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setShowCities(!showCities)}>
              <Text style={city ? styles.selectorValue : styles.selectorPlaceholder}>{city || 'Bratislava'}</Text>
              <Text style={styles.chevron}>▾</Text>
            </TouchableOpacity>
            {showCities && (
              <View style={styles.dropdown}>
                {CITIES.map(c => (
                  <TouchableOpacity key={c} style={styles.dropdownItem} onPress={() => { setCity(c); setShowCities(false); }}>
                    <Text style={[styles.dropdownText, city === c && styles.dropdownTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Save" onPress={handleSave} loading={loading} variant="lime" />
      </View>
      <Toast visible={saved} title="Profile saved" subtitle="Looking good!" onHide={() => setSaved(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  title: { fontSize: 20, fontWeight: '700', color: Colors.black },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 36, fontWeight: '700', color: Colors.black },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  avatarEditIcon: { fontSize: 13 },
  form: { gap: 20 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  bioInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.black, height: 90 },
  selector: { height: 52, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorValue: { fontSize: 16, color: Colors.black },
  selectorPlaceholder: { fontSize: 16, color: Colors.gray },
  chevron: { fontSize: 14, color: Colors.gray },
  dropdown: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  dropdownText: { fontSize: 15, color: Colors.black },
  dropdownTextActive: { fontWeight: '700', color: Colors.lime },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, backgroundColor: Colors.white },
});
