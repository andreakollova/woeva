import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

export const PENDING_INVITE_KEY = 'woeva_pending_invite_token';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refetchProfile: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION with the stored session on startup
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        registerPushToken(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
    processPendingInvite(userId);
  }

  async function processPendingInvite(userId: string) {
    try {
      const token = await AsyncStorage.getItem(PENDING_INVITE_KEY);
      if (!token) return;
      await AsyncStorage.removeItem(PENDING_INVITE_KEY);

      const { data: invite } = await supabase
        .from('pending_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (!invite || new Date(invite.expires_at) < new Date()) return;

      if (invite.role === 'admin') {
        await supabase.from('club_members').upsert(
          { club_id: invite.club_id, user_id: userId, role: 'admin', status: 'approved' },
          { onConflict: 'club_id,user_id' }
        );
      } else {
        await supabase.from('coordinators').upsert(
          { club_id: invite.club_id, event_id: invite.event_id ?? null, user_id: userId, invited_by: invite.invited_by, status: 'active' },
          { onConflict: 'club_id,event_id,user_id' }
        );
      }

      await supabase.from('pending_invites')
        .update({ status: 'accepted', accepted_by: userId })
        .eq('token', token);

      if (invite.invited_by) {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).single();
        const notifTitle = invite.role === 'admin' ? 'Pozvánka prijatá' : 'Koordinátor sa pripojil';
        const notifBody = `${profile?.name ?? 'Niekto'} prijal/a pozvánku do klubu ${invite.club_name}.`;
        await supabase.from('notifications').insert({
          user_id: invite.invited_by,
          type: invite.role === 'admin' ? 'admin_accepted' : 'coordinator_accepted',
          title: notifTitle,
          body: notifBody,
          data: { club_id: invite.club_id },
        });
        // Send push to inviter
        const { data: inviterProfile } = await supabase
          .from('profiles')
          .select('push_token')
          .eq('id', invite.invited_by)
          .or('notifications_enabled.is.null,notifications_enabled.eq.true')
          .single();
        if (inviterProfile?.push_token?.startsWith('ExponentPushToken[')) {
          await supabase.functions.invoke('send-push', {
            body: { tokens: [inviterProfile.push_token], title: notifTitle, body: notifBody, data: { club_id: invite.club_id } },
          });
        }
      }
    } catch (_) {}
  }

  async function registerPushToken(userId: string) {
    if (Platform.OS === 'web') return;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: '8eddd0fa-6bb8-47a2-bb21-5eaa63f470a2' })).data;
      // Clear this token from any other profiles (same device, different accounts)
      await supabase.from('profiles').update({ push_token: null }).eq('push_token', token).neq('id', userId);
      await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    } catch (_) {}
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refetchProfile: () => user && fetchProfile(user.id) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
