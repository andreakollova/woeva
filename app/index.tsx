import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (session) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)');
    }
  }, [session, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.black} size="large" />
    </View>
  );
}
