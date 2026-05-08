import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BackButton } from '@/components/ui/BackButton';

type RoomRow = {
  id: string;
  event_id: string;
  event_title: string;
  message_count: number;
  last_message: string | null;
  last_message_at: string | null;
  has_reports: boolean;
};

type MessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

function timeFmt(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `pred ${mins} min`;
  if (mins < 1440) return `pred ${Math.floor(mins / 60)} h`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AdminChatScreen() {
  const insets = useSafeAreaInsets();
  const { user: adminUser } = useAuth();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  async function loadRooms() {
    const { data: roomData } = await supabase
      .from('chat_rooms')
      .select('id, event_id, event:events(title)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!roomData) { setLoading(false); setRefreshing(false); return; }

    // Get message counts + last messages
    const roomsWithData: RoomRow[] = await Promise.all(
      (roomData as any[]).map(async (room) => {
        const [{ count }, { data: lastMsg }] = await Promise.all([
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('room_id', room.id),
          supabase.from('messages').select('content, created_at').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        // Check if this room's event has reports
        const { count: reportCount } = await supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('target_id', room.id)
          .eq('status', 'open');

        return {
          id: room.id,
          event_id: room.event_id,
          event_title: (room.event as any)?.title ?? '(deleted event)',
          message_count: count ?? 0,
          last_message: lastMsg?.content ?? null,
          last_message_at: lastMsg?.created_at ?? null,
          has_reports: (reportCount ?? 0) > 0,
        };
      })
    );

    setRooms(roomsWithData.sort((a, b) => {
      if (a.has_reports !== b.has_reports) return a.has_reports ? -1 : 1;
      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    }));
    setLoading(false);
    setRefreshing(false);
  }

  async function openRoom(room: RoomRow) {
    setSelectedRoom(room);
    setMessagesLoading(true);
    setMessages([]);
    const { data } = await supabase
      .from('messages')
      .select('id, room_id, sender_id, content, created_at, sender:profiles!messages_sender_id_fkey(name)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(100);

    setMessages((data ?? []).map((m: any) => ({
      ...m,
      sender_name: m.sender?.name ?? '—',
    })));
    setMessagesLoading(false);
  }

  async function deleteMessage(msg: MessageRow) {
    Alert.alert(
      'Vymazať správu',
      `Vymazať túto správu od ${msg.sender_name}?`,
      [
        { text: 'Zrušiť', style: 'cancel' },
        {
          text: 'Vymazať', style: 'destructive',
          onPress: async () => {
            await supabase.from('messages').delete().eq('id', msg.id);
            await supabase.from('admin_log').insert({
              admin_id: adminUser?.id,
              action: 'delete_message',
              target_type: 'message',
              target_id: msg.id,
              note: `Room: ${selectedRoom?.event_title}. Message: "${msg.content.slice(0, 80)}"`,
            });
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          },
        },
      ]
    );
  }

  useEffect(() => { loadRooms(); }, []);

  const renderRoom = ({ item }: { item: RoomRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => openRoom(item)} activeOpacity={0.7}>
      <View style={[styles.roomIcon, item.has_reports && styles.roomIconFlagged]}>
        <Text style={styles.roomIconText}>{item.has_reports ? '🚩' : '💬'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.event_title}</Text>
        {item.last_message ? (
          <Text style={styles.rowSub} numberOfLines={1}>{item.last_message}</Text>
        ) : (
          <Text style={[styles.rowSub, { fontStyle: 'italic' }]}>Žiadne správy</Text>
        )}
        <Text style={styles.rowMeta}>{item.message_count} správ{item.last_message_at ? ` · ${timeFmt(item.last_message_at)}` : ''}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: MessageRow }) => (
    <TouchableOpacity
      style={styles.msgRow}
      onLongPress={() => deleteMessage(item)}
      activeOpacity={0.8}
    >
      <View style={styles.msgAvatar}>
        <Text style={styles.msgAvatarText}>{(item.sender_name || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.msgContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={styles.msgSender}>{item.sender_name}</Text>
          <Text style={styles.msgTime}>{timeFmt(item.created_at)}</Text>
        </View>
        <Text style={styles.msgText}>{item.content}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Chat Monitor</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          renderItem={renderRoom}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRooms(); }} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* Room messages modal */}
      <Modal visible={!!selectedRoom} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedRoom(null)}>
        {selectedRoom && (
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRoom(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedRoom.event_title}</Text>
              <View style={{ width: 32 }} />
            </View>

            <Text style={styles.modalHint}>Dlhý stlak na správu ju vymaže</Text>

            {messagesLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Colors.black} />
            ) : messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>Žiadne správy v tomto chate</Text>
              </View>
            ) : (
              <FlatList
                data={messages}
                keyExtractor={m => m.id}
                renderItem={renderMessage}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                inverted
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  sep: { height: 1, backgroundColor: Colors.grayBorder, marginLeft: 72 },
  roomIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  roomIconFlagged: { backgroundColor: '#FFE0E0' },
  roomIconText: { fontSize: 20 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.semibold, color: Colors.black },
  rowSub: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  rowMeta: { fontSize: 11, color: Colors.grayBorder, fontFamily: Fonts.regular, marginTop: 2 },
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.grayBorder },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  modalClose: { fontSize: 18, color: Colors.gray, padding: 4 },
  modalHint: { textAlign: 'center', fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular, paddingVertical: 8 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChatText: { fontSize: 15, color: Colors.gray, fontFamily: Fonts.regular },
  msgRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.grayBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  msgContent: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 12, padding: 10, gap: 3 },
  msgSender: { fontSize: 12, fontWeight: '700', fontFamily: Fonts.semibold, color: Colors.black },
  msgTime: { fontSize: 11, color: Colors.gray, fontFamily: Fonts.regular },
  msgText: { fontSize: 14, color: Colors.black, fontFamily: Fonts.regular, lineHeight: 20 },
});
