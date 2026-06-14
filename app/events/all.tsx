import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/ui/BackButton';
import { EventCard } from '@/components/ui/EventCard';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { expandRecurringEvents } from '@/lib/expandRecurring';

export default function AllEventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userCity, setUserCity] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      // Get user's city from profile
      let city: string | null = null;
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('city').eq('id', user.id).single();
        city = prof?.city ?? null;
        setUserCity(city);
      }

      const today = new Date().toISOString().split('T')[0];
      let q = supabase
        .from('events')
        .select('*, club:clubs(id,name,cover_url), creator:profiles!creator_id(id,name,avatar_url), attendees:event_attendees(profile:profiles(id,name,avatar_url))')
        .or(`date.gte.${today},and(is_recurring.eq.true,recurring_end_date.gte.${today})`)
        .neq('status', 'cancelled')
        .order('date')
        .limit(200);

      if (city) q = q.eq('city', city);

      const { data } = await q;

      const now = new Date();
      const filtered = (data ?? []).filter((e: any) => {
        if (!e.date || !e.time) return true;
        const start = new Date(`${e.date}T${e.time}`);
        return now < new Date(start.getTime() + ((e.duration ?? 3) + 3) * 3600000);
      });
      setEvents(expandRecurringEvents(filtered));

      if (user) {
        const { data: att } = await supabase.from('event_attendees').select('event_id,occurrence_date').eq('user_id', user.id);
        const ids = new Set<string>();
        (att ?? []).forEach((a: any) => {
          if (a.occurrence_date) ids.add(`${a.event_id}_${a.occurrence_date}`);
          else ids.add(a.event_id);
        });
        setAttendingIds(ids);
      }
      setLoading(false);
    })();
  }, [user]));


  const displayed = search.trim()
    ? events.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()) || e.venue?.toLowerCase().includes(search.toLowerCase()))
    : events;

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton onPress={goBack} />
        <Text style={styles.title}>{userCity ?? 'Všetky udalosti'}</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Hľadaj udalosť, miesto..."
          placeholderTextColor={Colors.gray}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {loading ? (
          <Text style={styles.empty}>Načítavam...</Text>
        ) : displayed.length === 0 ? (
          <Text style={styles.empty}>Žiadne udalosti</Text>
        ) : displayed.map((event, i) => (
          <React.Fragment key={event.id}>
            <EventCard event={event} attending={attendingIds.has(event.id)} />
            {i < displayed.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingBottom:10 },
  title: { fontSize:17, fontWeight:'700', fontFamily:Fonts.bold, color:Colors.black },
  searchWrap: { paddingHorizontal:20, paddingBottom:10 },
  search: { backgroundColor:Colors.grayLight, borderRadius:14, paddingHorizontal:14, paddingVertical:10, fontSize:14, color:Colors.black, fontFamily:Fonts.regular },
  list: { paddingHorizontal: 20 },
  divider: { height:1, backgroundColor:Colors.grayBorder, marginVertical:2 },
  empty: { color:Colors.gray, fontSize:14, textAlign:'center', marginTop:40 },
});
