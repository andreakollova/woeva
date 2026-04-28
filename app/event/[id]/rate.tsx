import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user || rating === 0) return;
    setLoading(true);
    await supabase.from('reviews').insert({ event_id: id, user_id: user.id, rating, comment });
    setLoading(false);
    router.back();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backIcon}>{'<'}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Tell us your experience</Text>
      <Text style={styles.title}>Rate your Woeva event</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
            <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.commentLabel}>How was it?</Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Optional..."
        placeholderTextColor={Colors.gray}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <Button
        label="Submit review"
        onPress={handleSubmit}
        loading={loading}
        disabled={rating === 0}
        variant="lime"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  backBtn: { marginBottom: 32 },
  backIcon: { fontSize: 20, color: Colors.black },
  label: { fontSize: 13, color: Colors.gray, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.black, letterSpacing: -0.5, marginBottom: 24 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  star: { fontSize: 40, color: Colors.grayBorder },
  starActive: { color: Colors.lime },
  commentLabel: { fontSize: 14, fontWeight: '500', color: Colors.black, marginBottom: 8 },
  commentInput: {
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.black,
    height: 120,
    marginBottom: 24,
  },
});
