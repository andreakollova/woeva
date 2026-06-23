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

// Global pending route — survives component remounts during cold start
let _pendingRoute: string | null = null;

function NotificationHandler() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const { loading } = useAuth();
  const [appReady, setAppReady] = React.useState(false);
  const handledRef = React.useRef<string | null>(null);

  // Mark app as ready after initial render cycle completes
  React.useEffect(() => {
    const timer = setTimeout(() => setAppReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Extract route from notification response
  useEffect(() => {
    if (!response || loading) return;
    const id = response.notification.request.identifier;
    if (handledRef.current === id) return;

    const data = response.notification.request.content.data as any;
    if (!data) return;

    let route: string | null = null;
    if (data.type === 'event_chat' && (data.room_id || data.event_id)) route = `/chat/${data.room_id || data.event_id}`;
    else if ((data.type === 'admin_invite' || data.type === 'coordinator_invite' || data.action === 'admin_invite' || data.action === 'coordinator_invite') && data.club_id) route = `/club/${data.club_id}`;
    else if ((data.type === 'admin_accepted' || data.type === 'coordinator_accepted') && data.club_id) route = `/club/${data.club_id}/members`;
    else if (data.event_id) route = `/event/${data.event_id}`;
    else if (data.club_id) route = `/club/${data.club_id}`;

    if (!route) return;
    _pendingRoute = route;
    handledRef.current = id;
  }, [response, loading]);

  // Navigate when app is ready AND there's a pending route
  useEffect(() => {
    if (!appReady || !_pendingRoute) return;
    const route = _pendingRoute;
    _pendingRoute = null;
    // Use InteractionManager to wait for all UI to settle
    const { InteractionManager } = require('react-native');
    InteractionManager.runAfterInteractions(() => {
      try { router.push(route as any); } catch {}
    });
  }, [appReady, _pendingRoute]);

  // Re-check pending route periodically (handles race conditions)
  useEffect(() => {
    if (!appReady) return;
    const interval = setInterval(() => {
      if (_pendingRoute) {
        const route = _pendingRoute;
        _pendingRoute = null;
        try { router.push(route as any); } catch {}
      }
    }, 500);
    return () => clearInterval(interval);
  }, [appReady]);

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
            <Stack.Screen name="club/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/[id]/settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/[id]/edit" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/[id]/members" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/create" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="invite/[token]" options={{ animation: 'fade' }} />
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
