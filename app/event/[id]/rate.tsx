import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/context/AuthContext';

export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState('');

  useEffect(() => {
    supabase
      .from('events')
      .select('title, club_id, club:clubs(id, name)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setEventTitle(data.title);
        setClubId(data.club_id ?? null);
        setClubName((data.club as any)?.name ?? '');
      });
  }, [id]);

  async function handleSubmit() {
    if (!user || rating === 0) return;
    setLoading(true);

    // Insert rating
    await supabase.from('reviews').insert({
      event_id: id,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
    });

    // Recalculate club average rating
    if (clubId) {
      const { data } = await supabase
        .from('reviews')
        .select('rating, event:events!inner(club_id)')
        .eq('event.club_id', clubId);

      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        await supabase
          .from('clubs')
          .update({ rating: Math.round(avg * 10) / 10 })
          .eq('id', clubId);
      }
    }

    setLoading(false);
    router.back();
  }

  const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <BackButton />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Rate the event</Text>
        <Text style={styles.title}>{eventTitle || 'How was it?'}</Text>
        {clubName ? <Text style={styles.clubName}>by {clubName}</Text> : null}
      </View>

      {/* Stars */}
      <View style={styles.starsWrap}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text style={styles.ratingLabel}>{labels[rating]}</Text>
        )}
      </View>

      {/* Comment */}
      <Text style={styles.commentLabel}>Anything to add? <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Great vibe, would go again..."
        placeholderTextColor={Colors.gray}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Button
        label="Submit rating"
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
  header: { marginTop: 24, marginBottom: 32 },
  eyebrow: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.medium, marginBottom: 6, letterSpacing: 0.3 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.black, letterSpacing: -0.5, fontFamily: Fonts.extrabold, marginBottom: 4 },
  clubName: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  starsWrap: { alignItems: 'center', marginBottom: 36, gap: 10 },
  stars: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 44, color: Colors.grayBorder },
  starActive: { color: Colors.lime },
  ratingLabel: { fontSize: 16, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold },
  commentLabel: { fontSize: 14, fontWeight: '600', color: Colors.black, fontFamily: Fonts.semibold, marginBottom: 10 },
  optional: { fontSize: 13, fontWeight: '400', color: Colors.gray, fontFamily: Fonts.regular },
  commentInput: {
    borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 14,
    padding: 14, fontSize: 15, color: Colors.black,
    height: 110, marginBottom: 24, fontFamily: Fonts.regular,
  },
});
