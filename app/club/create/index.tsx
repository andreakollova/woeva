import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { WMark } from '@/components/ui/WMark';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORIES } from '@/types';

export default function CreateClubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9] });
    if (!result.canceled) setCover(result.assets[0].uri);
  }

  async function handleCreate() {
    if (!name || !user) return;
    setLoading(true);

    let cover_url: string | null = null;
    if (cover) {
      const ext = cover.split('.').pop();
      const path = `clubs/${Date.now()}.${ext}`;
      const blob = await fetch(cover).then(r => r.blob());
      await supabase.storage.from('club-covers').upload(path, blob);
      const { data } = supabase.storage.from('club-covers').getPublicUrl(path);
      cover_url = data.publicUrl;
    }

    const { data, error } = await supabase.from('clubs').insert({
      creator_id: user.id,
      name,
      tagline,
      category,
      cover_url,
      member_count: 1,
      rating: 0,
      city: 'Bratislava',
    }).select().single();

    if (!error && data) {
      await supabase.from('club_members').insert({ club_id: data.id, user_id: user.id, role: 'admin', status: 'approved' });
    }

    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
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
          <WMark size={28} color={Colors.lime} />
          <View style={styles.stepBadge}><Text style={styles.stepText}>2 / 3</Text></View>
        </View>

        <Text style={styles.title}>New club</Text>

        <View style={styles.form}>
          <Input label="Club name" value={name} onChangeText={setName} placeholder="Run club BA" />
          <Input label="Tagline" value={tagline} onChangeText={setTagline} placeholder="Running for everyone" />

          <View>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setShowCategories(!showCategories)}>
              <Text style={category ? styles.selectorValue : styles.selectorPlaceholder}>{category || 'Sport - Running'}</Text>
            </TouchableOpacity>
            {showCategories && (
              <View style={styles.dropdown}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} style={styles.dropdownItem} onPress={() => { setCategory(cat); setShowCategories(false); }}>
                    <Text style={[styles.dropdownText, category === cat && styles.dropdownTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View>
            <Text style={styles.label}>Cover photo</Text>
            <TouchableOpacity style={styles.coverPicker} onPress={pickImage}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverEmpty}>
                  <Text style={styles.coverPlus}>+</Text>
                  <Text style={styles.coverHint}>Add cover image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button label="Create Club" onPress={handleCreate} loading={loading} disabled={!name} variant="black" />
        <Button label="Back" onPress={() => router.back()} variant="ghost" />
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
  label: { fontSize: 14, fontWeight: '500', color: Colors.black, marginBottom: 6 },
  selector: { height: 52, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  selectorValue: { fontSize: 16, color: Colors.black },
  selectorPlaceholder: { fontSize: 16, color: Colors.gray },
  dropdown: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, marginTop: 4, overflow: 'hidden', maxHeight: 200 },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  dropdownText: { fontSize: 15, color: Colors.black },
  dropdownTextActive: { fontWeight: '700', color: Colors.lime },
  coverPicker: { height: 160, borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, borderStyle: 'dashed', overflow: 'hidden' },
  coverPreview: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverPlus: { fontSize: 32, color: Colors.gray },
  coverHint: { fontSize: 14, color: Colors.gray },
  footer: { paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: Colors.grayBorder, gap: 8, backgroundColor: Colors.white },
});
