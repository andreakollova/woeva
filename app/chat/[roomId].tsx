import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';
import { useAuth } from '@/context/AuthContext';

type ProfileCache = Record<string, { name: string; avatar_url: string | null }>;

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [profileCache, setProfileCache] = useState<ProfileCache>({});
  const [hostName, setHostName] = useState('');
  const [hostAvatar, setHostAvatar] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
    loadEventTitle();

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async payload => {
        const msg = payload.new as Message;
        // Enrich with profile if not already cached
        if (msg.sender_id === user?.id) {
          setProfileCache(c => ({ ...c, [user.id]: { name: profile?.name ?? '', avatar_url: profile?.avatar_url ?? null } }));
        } else {
          const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', msg.sender_id).single();
          if (data) setProfileCache(c => ({ ...c, [msg.sender_id]: data }));
        }
        setMessages(prev => [...prev, msg]);
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

    const msgs = data ?? [];
    // Build profile cache from joined data
    const cache: ProfileCache = {};
    msgs.forEach((m: any) => {
      if (m.sender_id && m.sender) cache[m.sender_id] = m.sender;
    });
    // Always include current user
    if (user && profile) cache[user.id] = { name: profile.name ?? '', avatar_url: profile.avatar_url ?? null };
    setProfileCache(cache);
    setMessages(msgs);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    await AsyncStorage.setItem(`chat_read_${roomId}`, new Date().toISOString());
  }

  async function loadEventTitle() {
    const { data } = await supabase
      .from('events')
      .select('title, creator:profiles!creator_id(name, avatar_url)')
      .eq('id', roomId)
      .single();
    if (data) {
      setEventTitle(data.title);
      const creator = (data as any).creator;
      if (creator) {
        setHostName((creator.name ?? '').split(' ')[0]);
        setHostAvatar(creator.avatar_url ?? null);
      }
    }
  }

  async function sendMessage() {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    await supabase.from('messages').insert({ room_id: roomId, sender_id: user.id, content: msg });
  }

  function renderItem({ item }: { item: Message }) {
    const isMe = item.sender_id === user?.id;
    const sender = profileCache[item.sender_id] ?? (item.sender as any) ?? null;
    const firstName = (sender?.name ?? '').split(' ')[0] || '?';
    const initial = firstName.charAt(0).toUpperCase();
    const avatarUrl = sender?.avatar_url ?? null;

    const Avatar = (
      <View style={styles.senderAvatarWrap}>
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} style={styles.senderAvatarImg} />
          : <View style={[styles.senderAvatarImg, styles.senderAvatarFallback]}>
              <Text style={styles.senderInitial}>{initial}</Text>
            </View>
        }
      </View>
    );

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && Avatar}
        <View style={[styles.bubble, isMe && styles.bubbleMe]}>
          {!isMe && <Text style={styles.senderName}>{firstName}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isMe && Avatar}
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
          {hostName ? (
            <View style={styles.headerHostRow}>
              {hostAvatar
                ? <Image source={{ uri: hostAvatar }} style={styles.headerHostAvatar} />
                : <View style={[styles.headerHostAvatar, styles.headerHostAvatarFallback]}>
                    <Text style={styles.headerHostInitial}>{hostName.charAt(0).toUpperCase()}</Text>
                  </View>
              }
              <Text style={styles.headerSub}>{hostName}</Text>
            </View>
          ) : (
            <Text style={styles.headerSub}>Group chat</Text>
          )}
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
  headerHostRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerHostAvatar: { width: 16, height: 16, borderRadius: 8 },
  headerHostAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  headerHostInitial: { fontSize: 8, fontWeight: '700', color: Colors.black },
  headerSub: { fontSize: 12, color: Colors.gray },
  list: { padding: 16, gap: 8 },
  msgRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  senderAvatarWrap: { flexShrink: 0, alignSelf: 'flex-end' },
  senderAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  senderAvatarFallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
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
