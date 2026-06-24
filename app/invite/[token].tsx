import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuth, PENDING_INVITE_KEY } from '@/context/AuthContext';

type Invite = {
  id: string;
  club_id: string;
  role: 'admin' | 'coordinator';
  event_id: string | null;
  token: string;
  club_name: string;
  inviter_name: string;
  status: string;
  expires_at: string;
};

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) fetchInvite();
  }, [token]);

  async function fetchInvite() {
    setLoading(true);
    const { data, error } = await supabase
      .from('pending_invites')
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) {
      setError('Pozvánka neexistuje alebo vypršala.');
    } else if (data.status !== 'pending') {
      setError('Táto pozvánka už bola použitá.');
    } else if (new Date(data.expires_at) < new Date()) {
      setError('Platnosť pozvánky vypršala.');
    } else {
      setInvite(data as Invite);
    }
    setLoading(false);
  }

  async function handleAccept() {
    if (!invite) return;

    // Not logged in → save token and go to auth
    if (!user) {
      await AsyncStorage.setItem(PENDING_INVITE_KEY, token!);
      router.push('/(auth)' as any);
      return;
    }

    setAccepting(true);
    try {
      if (invite.role === 'admin') {
        // Delete existing membership first (RLS blocks upsert UPDATE for non-admins)
        await supabase.from('club_members').delete().eq('club_id', invite.club_id).eq('user_id', user.id);
        await supabase.from('club_members').insert(
          { club_id: invite.club_id, user_id: user.id, role: 'admin', status: 'approved' }
        );
      } else {
        await supabase.from('coordinators').delete().eq('club_id', invite.club_id).eq('user_id', user.id);
        await supabase.from('coordinators').insert(
          { club_id: invite.club_id, event_id: invite.event_id ?? null, user_id: user.id, invited_by: invite.invited_by, status: 'active' }
        );
      }

      await supabase.from('pending_invites')
        .update({ status: 'accepted', accepted_by: user.id })
        .eq('token', token);

      // In-app + push notification to inviter
      if (invite.invited_by) {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
        const notifTitle = invite.role === 'admin' ? 'Pozvánka prijatá' : 'Koordinátor sa pripojil';
        const notifBody = `${profile?.name ?? 'Niekto'} prijal/a pozvánku do klubu ${invite.club_name}.`;
        await supabase.from('notifications').insert({
          user_id: invite.invited_by,
          type: invite.role === 'admin' ? 'admin_accepted' : 'coordinator_accepted',
          title: notifTitle,
          body: notifBody,
          data: { club_id: invite.club_id },
        });
        // Push to inviter/owner
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

      setDone(true);
      if (invite.role === 'coordinator') {
        const eventId = invite.event_id;
        setTimeout(() => router.replace({ pathname: '/dashboard', params: eventId ? { openEvent: eventId } : {} } as any), 1800);
      } else {
        setTimeout(() => router.replace(`/club/${invite.club_id}` as any), 1800);
      }
    } catch {
      Alert.alert('Chyba', 'Pozvánku sa nepodarilo prijať. Skús to znova.');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.black} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.center, { paddingTop: insets.top, paddingHorizontal: 32 }]}>
        <Text style={s.errorTitle}>Pozvánka neplatná</Text>
        <Text style={s.errorSub}>{error}</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.8}>
          <Text style={s.backBtnText}>Domov</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <View style={s.successIcon}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke={Colors.black} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={s.doneTitle}>Pozvánka prijatá!</Text>
        <Text style={s.doneSub}>Presmerováva ťa do klubu {invite?.club_name}...</Text>
      </View>
    );
  }

  const roleLabel = invite!.role === 'admin' ? 'správcu' : 'koordinátora';
  const roleDesc = invite!.role === 'admin'
    ? 'Budeš môcť spravovať eventy, členov a nastavenia klubu.'
    : 'Budeš môcť skenovať QR kódy a potvrdzovať príchody na eventy.';

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.card}>
        {/* Club initial avatar */}
        <View style={s.clubAvatar}>
          <Text style={s.clubInitial}>{invite!.club_name.charAt(0).toUpperCase()}</Text>
        </View>

        <Text style={s.inviteLabel}>Pozvánka</Text>
        <Text style={s.clubName}>{invite!.club_name}</Text>
        <Text style={s.inviteBy}>
          <Text style={{ color: Colors.gray }}>{invite!.inviter_name} ťa pozýva ako </Text>
          <Text style={{ fontFamily: Fonts.semibold, color: Colors.black }}>{roleLabel}</Text>
        </Text>

        <View style={s.descBox}>
          <Text style={s.descText}>{roleDesc}</Text>
        </View>

        <TouchableOpacity
          style={s.acceptBtn}
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator color={Colors.black} />
            : <Text style={s.acceptBtnText}>
                {user ? 'Prijať pozvánku' : 'Prihlás sa a prijmi pozvánku'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.declineBtn} onPress={() => router.replace('/(tabs)' as any)} activeOpacity={0.7}>
          <Text style={s.declineBtnText}>Odmietnuť</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, justifyContent: 'center', paddingHorizontal: 24 },
  center: { flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', gap: 12 },

  card: { backgroundColor: Colors.grayLight, borderRadius: 28, padding: 28, alignItems: 'center', gap: 6 },
  clubAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  clubInitial: { fontSize: 30, fontWeight: '800', color: Colors.lime, fontFamily: Fonts.extrabold },
  inviteLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray, letterSpacing: 0.8, textTransform: 'uppercase' },
  clubName: { fontSize: 22, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold, textAlign: 'center', marginTop: 2 },
  inviteBy: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 4 },

  descBox: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginTop: 8, width: '100%' },
  descText: { fontSize: 13, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20 },

  acceptBtn: { backgroundColor: Colors.lime, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginTop: 16 },
  acceptBtnText: { fontSize: 16, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold },

  declineBtn: { paddingVertical: 12, alignItems: 'center' },
  declineBtnText: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular },

  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: '800', color: Colors.black, fontFamily: Fonts.extrabold },
  doneSub: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center', paddingHorizontal: 32 },

  errorTitle: { fontSize: 20, fontWeight: '700', color: Colors.black, fontFamily: Fonts.bold, textAlign: 'center' },
  errorSub: { fontSize: 14, color: Colors.gray, fontFamily: Fonts.regular, textAlign: 'center' },
  backBtn: { marginTop: 16, backgroundColor: Colors.black, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13 },
  backBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white, fontFamily: Fonts.bold },
});
