import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StyleSheet } from 'react-native';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LanguageProvider>
        <AuthProvider>
        <StripeProvider publishableKey={STRIPE_KEY} merchantIdentifier="merchant.com.woeva.app">
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
            <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            <Stack.Screen name="event/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="event/[id]/edit" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="event/create/step1" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="event/create/step2" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="event/create/step3" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="event/create/published" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="club/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/[id]/members" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/create/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="chat/[roomId]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/payment-methods" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/notifications" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/about" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/delete-account" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings/legal" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="notifications/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="event/[id]/rate" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="dashboard/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="club/[id]/edit" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="admin" options={{ animation: 'slide_from_right' }} />
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
