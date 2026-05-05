import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';
import { useAuth } from '@/context/AuthContext';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
    loadEventTitle();

    // Real-time subscription
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles(name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data ?? []);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    // Mark as read
    await AsyncStorage.setItem(`chat_read_${roomId}`, new Date().toISOString());
  }

  async function loadEventTitle() {
    const { data } = await supabase.from('events').select('title').eq('id', roomId).single();
    if (data) setEventTitle(data.title);
  }

  async function sendMessage() {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    await supabase.from('messages').insert({ room_id: roomId, sender_id: user.id, content: msg });
  }

  function renderItem({ item }: { item: Message }) {
    const isMe = item.sender_id === user?.id;
    const senderName = (item.sender as any)?.name ?? 'Unknown';
    const initial = senderName.charAt(0).toUpperCase();

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.senderAvatar}>
            <Text style={styles.senderInitial}>{initial}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe && styles.bubbleMe]}>
          {!isMe && <Text style={styles.senderName}>{senderName}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle}</Text>
          <Text style={styles.headerSub}>Group chat</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: Colors.grayBorder, gap: 12 },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 20, color: Colors.black },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.black },
  headerSub: { fontSize: 12, color: Colors.gray },
  list: { padding: 16, gap: 8 },
  msgRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  senderAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  senderInitial: { fontSize: 13, fontWeight: '700', color: Colors.black },
  bubble: { maxWidth: '75%', backgroundColor: Colors.grayLight, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, gap: 3 },
  bubbleMe: { backgroundColor: Colors.black, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '600', color: Colors.gray, marginBottom: 2 },
  msgText: { fontSize: 15, color: Colors.black, lineHeight: 20 },
  msgTextMe: { color: Colors.white },
  msgTime: { fontSize: 10, color: Colors.gray, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.5)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, gap: 10, borderTopWidth: 1, borderColor: Colors.grayBorder },
  input: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.black, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 18, fontWeight: '700', color: Colors.black },
});
