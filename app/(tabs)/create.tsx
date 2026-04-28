// This tab is not rendered — create is handled by the + button in tab bar
// Redirects to event/create/step1 via the custom tab bar
import { Redirect } from 'expo-router';
export default function Create() {
  return <Redirect href="/event/create/step1" />;
}
