import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { ClubMember } from '@/types';
import { useTranslations } from '@/context/LanguageContext';

export default function ClubMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [approved, setApproved] = useState<ClubMember[]>([]);
  const [pending, setPending] = useState<ClubMember[]>([]);
  const [tab, setTab] = useState<'members' | 'requests'>('members');
  const { t } = useTranslations();

  useEffect(() => { loadMembers(); }, [id]);

  async function loadMembers() {
    const { data: all } = await supabase
      .from('club_members')
      .select('*, profile:profiles(*)')
      .eq('club_id', id)
      .order('joined_at', { ascending: false });

    setApproved((all ?? []).filter(m => m.status === 'approved'));
    setPending((all ?? []).filter(m => m.status === 'pending'));
  }

  async function approve(memberId: string) {
    await supabase.from('club_members').update({ status: 'approved' }).eq('id', memberId);
    loadMembers();
  }

  async function reject(memberId: string) {
    Alert.alert(t.club.removeRequest, t.club.declineRequest, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.club.decline, style: 'destructive', onPress: async () => {
        await supabase.from('club_members').delete().eq('id', memberId);
        loadMembers();
      }},
    ]);
  }

  async function removeMember(memberId: string, name: string) {
    Alert.alert(t.club.removeMember, t.club.removeMemberSimple(name), [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.club.remove, style: 'destructive', onPress: async () => {
        await supabase.from('club_members').delete().eq('id', memberId);
        loadMembers();
      }},
    ]);
  }

  const list = tab === 'members' ? approved : pending;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{t.club.members}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'members' && styles.tabActive]} onPress={() => setTab('members')}>
          <Text style={[styles.tabText, tab === 'members' && styles.tabTextActive]}>{t.club.membersTab(approved.length)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'requests' && styles.tabActive]} onPress={() => setTab('requests')}>
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            {pending.length > 0 ? t.club.requestsTabCount(pending.length) : t.club.requestsTab}
          </Text>
          {pending.length > 0 && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tab === 'members' ? t.club.noMembersYet : t.club.noPendingRequests}</Text>
          </View>
        )}
        {list.map(member => {
          const profile = member.profile as any;
          const name = (profile?.name ?? 'Unknown').split(' ')[0];
          const initial = name.charAt(0).toUpperCase();
          return (
            <View key={member.id} style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{name}</Text>
                {member.role === 'admin' && <Text style={styles.adminBadge}>{t.club.adminRole}</Text>}
              </View>
              {tab === 'requests' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approve(member.id)}>
                    <Text style={styles.approveBtnText}>{t.club.accept}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(member.id)}>
                    <Text style={styles.rejectBtnText}>{t.club.decline}</Text>
                  </TouchableOpacity>
                </View>
              ) : member.role !== 'admin' ? (
                <TouchableOpacity onPress={() => removeMember(member.id, name)}>
                  <Text style={styles.removeText}>{t.club.remove}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, fontWeight: '600', color: Colors.black },
  headerTitle: { fontSize: 17, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, backgroundColor: Colors.grayLight, gap: 6 },
  tabActive: { backgroundColor: Colors.black },
  tabText: { fontSize: 14, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  tabTextActive: { color: Colors.white },
  badge: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lime },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: Colors.grayBorder },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.black },
  adminBadge: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  actions: { flexDirection: 'row', gap: 8 },
  approveBtn: { backgroundColor: Colors.lime, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  approveBtnText: { fontSize: 13, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rejectBtn: { backgroundColor: Colors.grayLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  rejectBtnText: { fontSize: 13, fontWeight: '500', fontFamily: Fonts.medium, color: Colors.gray },
  removeText: { fontSize: 13, color: Colors.error, fontFamily: Fonts.medium },
});
