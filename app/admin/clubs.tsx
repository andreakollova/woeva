import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, Image, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';

type ClubRow = {
  id: string;
  name: string;
  category: string;
  cover_url: string | null;
  logo_url: string | null;
  member_count: number;
  rating: number;
  city: string;
  created_at: string;
  creator_id: string;
  creator_name: string;
  creator_email: string | null;
};

type ClubDetail = ClubRow & {
  eventCount: number;
  description: string | null;
};

export default function AdminClubsScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [filtered, setFiltered] = useState<ClubRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ClubDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadClubs() {
    const { data } = await supabase
      .from('clubs')
      .select('id, name, category, cover_url, logo_url, member_count, rating, city, created_at, creator_id, creator:profiles!clubs_creator_id_fkey(name, email)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!data) { setLoading(false); setRefreshing(false); return; }
    const rows: ClubRow[] = (data as any[]).map(c => ({
      ...c,
      creator_name: (c.creator as any)?.name?.split(' ')[0] ?? '—',
      creator_email: (c.creator as any)?.email ?? null,
    }));
    setClubs(rows);
    setFiltered(rows);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadClubs(); }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(clubs); return; }
    setFiltered(clubs.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.creator_name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    ));
  }, [search, clubs]);

  async function openDetail(c: ClubRow) {
    setSelected({ ...c, eventCount: 0, description: null });
    const [{ count: eventCount }, { data: clubData }] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('club_id', c.id),
      supabase.from('clubs').select('description').eq('id', c.id).single(),
    ]);
    setSelected({ ...c, eventCount: eventCount ?? 0, description: clubData?.description ?? null });
  }

  async function logAction(action: string, targetName: string, note?: string) {
    await supabase.from('admin_log').insert({
      admin_id: adminUser?.id,
      action,
      target_type: 'club',
      target_id: selected?.id,
      target_name: targetName,
      note: note ?? null,
    });
  }

  async function deleteClubConfirm1() {
    if (!selected) return;
    Alert.alert(
      'Vymazať klub',
      `Vymazať "${selected.name}"? Všetky podujatia, členovia a chaty budú natrvalo odstránené.`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        { text: 'Pokračovať', style: 'destructive', onPress: deleteClubConfirm2 },
      ]
    );
  }

  async function deleteClubConfirm2() {
    if (!selected) return;
    Alert.alert(
      'Posledná kontrola',
      `"${selected.name}" bude natrvalo vymazaný. ${selected.member_count} členovia budú upozornení.`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        {
          text: 'Vymazať navždy', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);

            // Get affected members/attendees for notification
            const { data: members } = await supabase
              .from('club_members')
              .select('user_id, profile:profiles(push_token, email)')
              .eq('club_id', selected.id)
              .eq('status', 'approved');

            const affectedUsers = (members ?? []).map((m: any) => ({
              push_token: m.profile?.push_token ?? null,
              email: m.profile?.email ?? null,
            }));

            await logAction('delete_club', selected.name);

            const { notify: notifyLib } = require('@/lib/notify');
            await notifyLib.clubDeleted({ clubName: selected.name, affectedUsers });

            await supabase.from('clubs').delete().eq('id', selected.id);
            setClubs(prev => prev.filter(c => c.id !== selected.id));
            setSelected(null);
            setActionLoading(false);
          },
        },
      ]
    );
  }

  const renderClub = ({ item }: { item: ClubRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
      <View style={styles.cover}>
        {item.logo_url || item.cover_url
          ? <Image source={{ uri: (item.logo_url ?? item.cover_url)! }} style={StyleSheet.absoluteFill as any} />
          : <Text style={styles.coverInitial}>{item.name.charAt(0)}</Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowSub}>{item.category} · {item.creator_name}</Text>
        <Text style={styles.rowSub}>{item.member_count} členov</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Hľadaj názov, kategóriu, zakladateľa..."
          placeholderTextColor={Colors.gray}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={renderClub}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadClubs(); }} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Detail klubu</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
              {(selected.cover_url || selected.logo_url) && (
                <Image source={{ uri: (selected.cover_url ?? selected.logo_url)! }} style={styles.detailCover} />
              )}

              <Text style={styles.detailName}>{selected.name}</Text>
              <Text style={styles.detailSub}>{selected.category} · {selected.city}</Text>
              <Text style={styles.detailSub}>Zakladateľ: {selected.creator_name}</Text>
              {selected.description ? <Text style={styles.detailDesc}>{selected.description}</Text> : null}

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{selected.member_count}</Text>
                  <Text style={styles.statLbl}>Členovia</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{selected.eventCount}</Text>
                  <Text style={styles.statLbl}>Podujatia</Text>
                </View>
              </View>

              <View style={styles.actionSection}>
                <Text style={styles.actionSectionTitle}>NEBEZPEČNÁ ZÓNA</Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FFF0F0' }]}
                  onPress={deleteClubConfirm1}
                  disabled={actionLoading}
                >
                  <Text style={[styles.actionBtnText, { color: '#CC0000' }]}>Natrvalo vymazať klub</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  count: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  search: { backgroundColor: Colors.grayLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  sep: { height: 1, backgroundColor: Colors.grayBorder, marginLeft: 76 },
  cover: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.grayBorder, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverInitial: { fontSize: 22, color: Colors.white, fontWeight: '700' },
  rowName: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  detailCover: { width: '100%', height: 160, borderRadius: 16 },
  detailName: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  detailSub: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },
  detailDesc: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statLbl: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center' },
  actionSection: { gap: 10 },
  actionSectionTitle: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase' },
  actionBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
});
