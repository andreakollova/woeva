import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, Image, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  blacklisted?: boolean;
};

type UserDetail = UserRow & {
  eventsCreated: number;
  clubsCreated: number;
  eventsAttended: number;
  blacklistReason: string | null;
  blacklistId: string | null;
};

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Avatar({ name, avatar_url, size = 40 }: { name: string; avatar_url: string | null; size?: number }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {avatar_url
        ? <Image source={{ uri: avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: Colors.black }}>{initial}</Text>
      }
    </View>
  );
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, city, avatar_url, is_admin, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!data) { setLoading(false); setRefreshing(false); return; }

    const { data: blacklistData } = await supabase
      .from('blacklist')
      .select('user_id');
    const blacklistSet = new Set((blacklistData ?? []).map((b: any) => b.user_id));

    const rows: UserRow[] = (data as any[]).map(u => ({ ...u, blacklisted: blacklistSet.has(u.id) }));
    setUsers(rows);
    setFiltered(rows);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(users); return; }
    setFiltered(users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q)
    ));
  }, [search, users]);

  async function openDetail(u: UserRow) {
    setDetailLoading(true);
    setSelected({ ...u, eventsCreated: 0, clubsCreated: 0, eventsAttended: 0, blacklistReason: null, blacklistId: null });

    const [
      { count: eventsCreated },
      { count: clubsCreated },
      { count: eventsAttended },
      { data: bl },
    ] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('creator_id', u.id),
      supabase.from('clubs').select('id', { count: 'exact', head: true }).eq('creator_id', u.id),
      supabase.from('event_attendees').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      supabase.from('blacklist').select('id, reason').eq('user_id', u.id).maybeSingle(),
    ]);

    setSelected({
      ...u,
      eventsCreated: eventsCreated ?? 0,
      clubsCreated: clubsCreated ?? 0,
      eventsAttended: eventsAttended ?? 0,
      blacklistReason: bl?.reason ?? null,
      blacklistId: bl?.id ?? null,
    });
    setDetailLoading(false);
  }

  async function logAction(action: string, targetName: string, note?: string) {
    await supabase.from('admin_log').insert({
      admin_id: adminUser?.id,
      action,
      target_type: 'user',
      target_id: selected?.id,
      target_name: targetName,
      note: note ?? null,
    });
  }

  async function blacklistUser() {
    if (!selected) return;
    Alert.alert(
      'Blacklist user',
      `Block ${selected.name || selected.email} from the platform?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Blacklist', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await supabase.from('blacklist').insert({
              user_id: selected.id,
              reason: blacklistReason || null,
              created_by: adminUser?.id,
            });
            await logAction('blacklist_user', selected.name || '', blacklistReason || undefined);
            setSelected(s => s ? { ...s, blacklistReason: blacklistReason || null, blacklistId: 'new' } : null);
            setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, blacklisted: true } : u));
            setBlacklistReason('');
            setActionLoading(false);
          },
        },
      ]
    );
  }

  async function unblacklistUser() {
    if (!selected) return;
    setActionLoading(true);
    await supabase.from('blacklist').delete().eq('user_id', selected.id);
    await logAction('unblacklist_user', selected.name || '');
    setSelected(s => s ? { ...s, blacklistReason: null, blacklistId: null } : null);
    setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, blacklisted: false } : u));
    setActionLoading(false);
  }

  async function deleteUserConfirm1() {
    if (!selected) return;
    Alert.alert(
      'Delete account',
      `Delete ${selected.name || selected.email}? All their events, clubs and data will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: deleteUserConfirm2 },
      ]
    );
  }

  async function deleteUserConfirm2() {
    if (!selected) return;
    Alert.alert(
      'Final confirmation',
      `This CANNOT be undone. "${selected.name || selected.email}" will be permanently deleted from the platform.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await logAction('delete_user', selected.name || selected.email || '', 'Admin-initiated deletion');
            await supabase.functions.invoke('admin-delete-user', { body: { userId: selected.id } });
            setUsers(prev => prev.filter(u => u.id !== selected.id));
            setSelected(null);
            setActionLoading(false);
          },
        },
      ]
    );
  }

  const renderUser = ({ item }: { item: UserRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => openDetail(item)} activeOpacity={0.7}>
      <Avatar name={item.name} avatar_url={item.avatar_url} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || '(no name)'}</Text>
          {item.is_admin && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>ADMIN</Text></View>}
          {item.blacklisted && <View style={styles.blacklistBadge}><Text style={styles.blacklistBadgeText}>BLOCKED</Text></View>}
        </View>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.email || '—'}</Text>
      </View>
      <Text style={styles.rowDate}>{timeAgo(item.created_at)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Users</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search name, email, city..."
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
          keyExtractor={u => u.id}
          renderItem={renderUser}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(); }} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* User detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>User detail</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 20 }}>
              {detailLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
              ) : (
                <>
                  {/* Profile */}
                  <View style={styles.profileRow}>
                    <Avatar name={selected.name} avatar_url={selected.avatar_url} size={56} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>{selected.name || '(no name)'}</Text>
                      <Text style={styles.profileEmail}>{selected.email || '—'}</Text>
                      {selected.city ? <Text style={styles.profileSub}>{selected.city}</Text> : null}
                      <Text style={styles.profileSub}>Joined {timeAgo(selected.created_at)}</Text>
                    </View>
                  </View>

                  {/* Badges */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {selected.is_admin && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>PLATFORM ADMIN</Text></View>}
                    {selected.blacklistId && <View style={styles.blacklistBadge}><Text style={styles.blacklistBadgeText}>BLOCKED</Text></View>}
                  </View>

                  {/* Stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{selected.eventsCreated}</Text>
                      <Text style={styles.statLbl}>Events created</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{selected.eventsAttended}</Text>
                      <Text style={styles.statLbl}>Events attended</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{selected.clubsCreated}</Text>
                      <Text style={styles.statLbl}>Clubs created</Text>
                    </View>
                  </View>

                  {/* Blacklist section */}
                  <View style={styles.actionSection}>
                    <Text style={styles.actionSectionTitle}>BLACKLIST</Text>
                    {selected.blacklistId ? (
                      <>
                        {selected.blacklistReason ? (
                          <Text style={styles.blacklistReasonText}>Reason: {selected.blacklistReason}</Text>
                        ) : null}
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: Colors.grayLight }]}
                          onPress={unblacklistUser}
                          disabled={actionLoading}
                        >
                          <Text style={styles.actionBtnText}>Remove from blacklist</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TextInput
                          style={styles.reasonInput}
                          placeholder="Reason (optional)"
                          placeholderTextColor={Colors.gray}
                          value={blacklistReason}
                          onChangeText={setBlacklistReason}
                        />
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#FFF0E8' }]}
                          onPress={blacklistUser}
                          disabled={actionLoading}
                        >
                          <Text style={[styles.actionBtnText, { color: '#E85D04' }]}>Blacklist user</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>

                  {/* Delete section */}
                  <View style={styles.actionSection}>
                    <Text style={styles.actionSectionTitle}>DANGER ZONE</Text>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FFF0F0' }]}
                      onPress={deleteUserConfirm1}
                      disabled={actionLoading}
                    >
                      <Text style={[styles.actionBtnText, { color: '#CC0000' }]}>Delete account permanently</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
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
  sep: { height: 1, backgroundColor: Colors.grayBorder, marginLeft: 72 },
  rowName: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowEmail: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  rowDate: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  adminBadge: { backgroundColor: Colors.lime, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  adminBadgeText: { fontSize: 9, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  blacklistBadge: { backgroundColor: '#FFE0E0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  blacklistBadgeText: { fontSize: 9, fontWeight: '700', color: '#CC0000' },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  profileRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingTop: 4 },
  profileName: { fontSize: 20, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  profileEmail: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  profileSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800', fontFamily: Fonts.extrabold, color: Colors.black },
  statLbl: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center' },
  actionSection: { gap: 10 },
  actionSectionTitle: { fontSize: 11, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.gray, letterSpacing: 1, textTransform: 'uppercase' },
  reasonInput: { borderWidth: 1.5, borderColor: Colors.grayBorder, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.black, fontFamily: Fonts.regular },
  actionBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  blacklistReasonText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, fontStyle: 'italic' },
});
