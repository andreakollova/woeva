import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BackButton } from '@/components/ui/BackButton';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { clubDisplayName } from '@/lib/formatVenue';

function memberLabel(count: number): string {
  if (count === 1) return '1 člen';
  if (count >= 2 && count <= 4) return `${count} členovia`;
  return `${count} členov`;
}

export default function AllClubsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { city: cityParam } = useLocalSearchParams<{ city?: string }>();
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      let q = supabase
        .from('clubs')
        .select('id, name, logo_url, cover_url, member_count, city')
        .order('member_count', { ascending: false })
        .limit(100);
      if (cityParam) q = (q as any).ilike('city', `%${cityParam}%`);
      const { data } = await q;
      setClubs(data ?? []);
      setLoading(false);
    })();
  }, [cityParam]);

  const displayed = search.trim()
    ? clubs.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase()))
    : clubs;

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton onPress={goBack} />
        <Text style={styles.title}>Kluby</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Hľadaj klub, mesto..."
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
          <Text style={styles.empty}>Žiadne kluby</Text>
        ) : displayed.map((club, i) => (
          <React.Fragment key={club.id}>
            <ClubRow club={club} onPress={() => router.push(`/club/${club.id}` as any)} />
            {i < displayed.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

function ClubRow({ club, onPress }: { club: any; onPress: () => void }) {
  const [err, setErr] = useState(false);
  const logo = club.logo_url ?? club.cover_url;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.logo}>
        {logo && !err
          ? <Image source={{ uri: logo }} style={StyleSheet.absoluteFill as any} resizeMode="cover" onError={() => setErr(true)} />
          : <Text style={styles.logoInitial}>{club.name?.charAt(0) ?? '?'}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{clubDisplayName(club.name)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {club.city ? `${club.city}` : ''}{club.member_count ? `  ·  ${memberLabel(club.member_count)}` : ''}
        </Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingBottom:10 },
  title: { fontSize:17, fontWeight:'700', fontFamily:Fonts.bold, color:Colors.black },
  searchWrap: { paddingHorizontal:20, paddingBottom:10 },
  search: { backgroundColor:Colors.grayLight, borderRadius:14, paddingHorizontal:14, paddingVertical:10, fontSize:14, color:Colors.black, fontFamily:Fonts.regular },
  list: { paddingHorizontal:20 },
  divider: { height:1, backgroundColor:Colors.grayBorder, marginVertical:2 },
  empty: { color:Colors.gray, fontSize:14, textAlign:'center', marginTop:40 },
  row: { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:12 },
  logo: { width:52, height:52, borderRadius:16, backgroundColor:Colors.lime, overflow:'hidden', alignItems:'center', justifyContent:'center', flexShrink:0 },
  logoInitial: { fontSize:22, fontWeight:'800', color:Colors.black },
  name: { fontSize:15, fontWeight:'700', fontFamily:Fonts.bold, color:Colors.black, marginBottom:2 },
  meta: { fontSize:12, color:Colors.gray, fontFamily:Fonts.regular },
  arrow: { fontSize:22, color:Colors.gray, paddingLeft:4 },
});
