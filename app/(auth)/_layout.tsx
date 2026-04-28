import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="phone" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="otp" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="interests" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="permissions" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
