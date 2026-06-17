import { BackButton } from '@/components/ui/BackButton';
import React, { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert, ScrollView, Keyboard } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Message } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

type ProfileCache = Record<string, { name: string; avatar_url: string | null }>;

const QUICK_EMOJIS = ['☕', '👍', '🙌', '😂', '🏃', '🚀', '❤️', '🔥', '🎉', '😍', '💪', '👏', '😎', '🥳', '✨'];

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { t: tr } = useTranslations();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [headerSub, setHeaderSub] = useState('');
  const [profileCache, setProfileCache] = useState<ProfileCache>({});
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (profile) {
      setProfileCache(c => ({ ...c, [user.id]: { name: profile.name ?? '', avatar_url: profile.avatar_url ?? null } }));
    }
    loadMessages();
    loadEventMeta();
    loadMuteState();

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async payload => {
        const msg = payload.new as Message;
        // Skip if already in list (optimistic update or own message)
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          // Replace temp optimistic message from same user if content matches
          const tempIdx = prev.findIndex(m => m.id.startsWith('temp-') && m.sender_id === msg.sender_id && m.content === msg.content);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = msg;
            return next;
          }
          return [...prev, msg];
        });
        if (msg.sender_id !== user?.id) {
          const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', msg.sender_id).single();
          if (data) setProfileCache(c => ({ ...c, [msg.sender_id]: data }));
        }
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, user?.id]);

  async function loadMuteState() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('muted_chats').eq('id', user.id).single();
    setMuted((data?.muted_chats ?? []).includes(roomId));
  }

  async function toggleMute() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('muted_chats').eq('id', user.id).single();
    const current: string[] = data?.muted_chats ?? [];
    const updated = muted ? current.filter((id: string) => id !== roomId) : [...current, roomId];
    await supabase.from('profiles').update({ muted_chats: updated }).eq('id', user.id);
    setMuted(!muted);
    Alert.alert(muted ? tr.chat.unmuted ?? 'Notifikácie zapnuté' : tr.chat.muted ?? 'Notifikácie vypnuté');
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles(name, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    const msgs = data ?? [];
    const cache: ProfileCache = {};
    msgs.forEach((m: any) => { if (m.sender_id && m.sender) cache[m.sender_id] = m.sender; });
    if (user && profile) cache[user.id] = { name: profile.name ?? '', avatar_url: profile.avatar_url ?? null };
    setProfileCache(cache);
    setMessages(msgs);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    await AsyncStorage.setItem(`chat_read_${roomId}`, new Date().toISOString());
  }

  async function loadEventMeta() {
    const { data } = await supabase
      .from('events')
      .select('title, creator_id, club_id, club:clubs(name), creator:profiles!creator_id(name)')
      .eq('id', roomId)
      .single();
    if (!data) return;

    setEventTitle(data.title);
    const clubName = (data as any).club?.name;
    const creatorName = (data as any).creator?.name?.split(' ')[0] ?? '';
    setHeaderSub(clubName ?? creatorName);

    // Collect admin IDs: creator + club admins
    const admins = new Set<string>();
    admins.add(data.creator_id);
    if (data.club_id) {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', data.club_id)
        .eq('role', 'admin')
        .eq('status', 'approved');
      (members ?? []).forEach((m: any) => admins.add(m.user_id));
    }
    setAdminIds(admins);
  }

  async function sendMessage(content?: string) {
    const msg = (content ?? text).trim();
    if (!msg || !user) return;


    if (!content) setText('');

    // Optimistic update - show immediately
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      room_id: roomId,
      sender_id: user.id,
      content: msg,
      created_at: new Date().toISOString(),
    } as Message;
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    const { data: inserted } = await supabase
      .from('messages')
      .insert({ room_id: roomId, sender_id: user.id, content: msg })
      .select()
      .single();

    // Replace temp with real record
    if (inserted) {
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? inserted : m));
    }

    const { data: attendees } = await supabase
      .from('event_attendees').select('user_id')
      .eq('event_id', roomId).neq('user_id', user.id);

    const senderFirst = (profile?.name ?? 'Someone').split(' ')[0];
    const pushBody = `${senderFirst}: ${msg.length > 60 ? msg.slice(0, 60) + '…' : msg}`;
    const pushTitle = `💬 ${eventTitle || 'Chat'}`;

    if (adminIds.has(user.id)) {
      // Admin wrote → push to attendees
      const attendeeIds = (attendees ?? []).map((a: any) => a.user_id);
      if (attendeeIds.length > 0) {
        const { data: pushProfiles } = await supabase
          .from('profiles')
          .select('push_token, muted_chats')
          .in('id', attendeeIds)
          .neq('notifications_enabled', false)
          .not('push_token', 'is', null);

        const tokens = (pushProfiles ?? [])
          .filter((p: any) => !(p.muted_chats ?? []).includes(roomId))
          .map((p: any) => p.push_token)
          .filter((t: string) => t?.startsWith('ExponentPushToken['));

        if (tokens.length > 0) {
          supabase.functions.invoke('send-push', {
            body: { tokens, title: pushTitle, body: pushBody, data: { event_id: roomId, type: 'chat' } },
          });
        }
      }
    } else if (adminIds.size > 0) {
      // Attendee wrote → push to creator / admins
      const adminIdList = Array.from(adminIds);
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('push_token, muted_chats')
        .in('id', adminIdList)
        .neq('id', user.id)
        .neq('notifications_enabled', false)
        .not('push_token', 'is', null);

      const adminTokens = (adminProfiles ?? [])
        .filter((p: any) => !(p.muted_chats ?? []).includes(roomId))
        .map((p: any) => p.push_token)
        .filter((t: string) => t?.startsWith('ExponentPushToken['));

      if (adminTokens.length > 0) {
        supabase.functions.invoke('send-push', {
          body: { tokens: adminTokens, title: pushTitle, body: pushBody, data: { event_id: roomId, type: 'chat' } },
        });
      }
    }
  }

  function handleOptions() {
    Alert.alert('Chat', undefined, [
      { text: muted ? '🔔 Zapnúť notifikácie' : '🔕 Stlmiť notifikácie', onPress: toggleMute },
      { text: tr.chat.reportChat, style: 'destructive', onPress: () => {
        Alert.alert(tr.chat.reportChat, tr.chat.reportChatMsg, [
          { text: tr.common.cancel, style: 'cancel' },
          { text: tr.chat.reportChat, style: 'destructive', onPress: async () => {
            await supabase.from('reports').insert({ reporter_id: user?.id, target_type: 'chat', target_id: roomId });
            Alert.alert(tr.chat.reported, tr.chat.reportedMsg);
          }},
        ]);
      }},
      { text: tr.common.cancel, style: 'cancel' },
    ]);
  }

  function renderItem({ item }: { item: Message }) {
    const isMe = item.sender_id === user?.id;
    const sender = profileCache[item.sender_id] ?? (item.sender as any) ?? null;
    const senderName = isMe ? (profile?.name ?? sender?.name ?? '') : (sender?.name ?? '');
    const firstName = senderName.split(' ')[0] || '?';
    const initial = firstName.charAt(0).toUpperCase();
    const avatarUrl = isMe ? (profile?.avatar_url ?? sender?.avatar_url ?? null) : (sender?.avatar_url ?? null);
    const isAdmin = adminIds.has(item.sender_id);

    const Avatar = (
      <View style={styles.senderAvatarWrap}>
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} style={styles.senderAvatarImg} />
          : <View style={[styles.senderAvatarImg, isMe ? styles.senderAvatarFallbackMe : styles.senderAvatarFallback]}>
              <Text style={styles.senderInitial}>{initial}</Text>
            </View>
        }
      </View>
    );

    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {Avatar}
        <View style={{ maxWidth: '78%' }}>
          <View style={[styles.senderNameRow, isMe && styles.senderNameRowMe]}>
            <Text style={styles.senderName}>{isMe ? tr.chat.you : firstName}</Text>
            {isAdmin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>★ {tr.chat.admin}</Text>
              </View>
            )}
            <Text style={styles.msgTimeInline}>
              {new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.bubble, isMe && styles.bubbleMe]}>
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          </View>
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
          <Text style={styles.headerSub} numberOfLines={1}>{headerSub || tr.chat.groupChat}</Text>
        </View>
        <TouchableOpacity onPress={handleOptions} style={styles.reportBtn}>
          <Text style={styles.reportIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />

      {/* Quick emoji bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.emojiBar}
        contentContainerStyle={styles.emojiBarContent}
      >
        {QUICK_EMOJIS.map(e => (
          <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => setText(prev => prev + e)} activeOpacity={0.7}>
            <Text style={styles.emojiText}>{e}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={tr.chat.messagePlaceholder}
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
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
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  headerSub: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, marginTop: 1 },
  reportBtn: { padding: 6 },
  reportIcon: { fontSize: 20, color: Colors.gray, lineHeight: 22 },
  list: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  senderAvatarWrap: { flexShrink: 0, alignSelf: 'flex-end' },
  senderAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  senderAvatarFallback: { backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.grayBorder, borderRadius: 15 },
  senderAvatarFallbackMe: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  senderInitial: { fontSize: 12, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },
  bubble: { alignSelf: 'flex-start', backgroundColor: Colors.grayLight, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, gap: 3 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: Colors.black, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  senderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  senderNameRowMe: { justifyContent: 'flex-end' },
  senderName: { fontSize: 11, fontWeight: '600', color: Colors.gray, fontFamily: Fonts.semibold },
  adminBadge: { backgroundColor: Colors.lime, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, flexDirection: 'row', alignItems: 'center' },
  adminBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, letterSpacing: 0.2 },
  msgText: { fontSize: 15, color: Colors.black, lineHeight: 20 },
  msgTextMe: { color: Colors.white },
  msgTimeInline: { fontSize: 10, color: Colors.gray, marginLeft: 'auto' },
  emojiBar: { flexGrow: 0, flexShrink: 0, borderTopWidth: 1, borderColor: Colors.grayBorder },
  emojiBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  emojiBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.grayLight, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 20 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, gap: 10, borderTopWidth: 1, borderColor: Colors.grayBorder, flexShrink: 0 },
  input: { flex: 1, backgroundColor: Colors.grayLight, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.black, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 18, fontWeight: '700', color: Colors.black },
});
