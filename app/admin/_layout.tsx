import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile !== null && !profile.is_admin) {
      router.replace('/(tabs)');
    }
  }, [profile, loading]);

  if (loading || !profile?.is_admin) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="more" />
      <Stack.Screen name="events" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="clubs" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="categories" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="broadcast" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
