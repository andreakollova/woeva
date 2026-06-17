import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

function NotificationHandler() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const { loading } = useAuth();

  useEffect(() => {
    if (!response || loading) return;
    const data = response.notification.request.content.data as any;
    if (!data) return;
    if (data.type === 'chat' && data.event_id) {
      router.push(`/chat/${data.event_id}`);
    } else if (data.event_id) {
      router.push(`/event/${data.event_id}`);
    }
  }, [response, loading]);

  return null;
}

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts(
    Platform.OS === 'ios'
      ? {}
      : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold }
  );

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LanguageProvider>
        <AuthProvider>
        <StripeProvider publishableKey={STRIPE_KEY} merchantIdentifier="merchant.com.woeva.app">
          <StatusBar style="light" />
          <NotificationHandler />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            <Stack.Screen name="event/[id]" options={{ animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: '#0A0A0A' } }} />
            <Stack.Screen name="event/[id]/payment" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="event/create/step1" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="event/create/published" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack>
        </StripeProvider>
        </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
