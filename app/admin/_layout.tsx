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
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="events" />
      <Stack.Screen name="clubs" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="broadcast" />
      <Stack.Screen name="chat" />
    </Stack>
  );
}
