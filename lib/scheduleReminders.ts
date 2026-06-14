import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'event_reminders_v1';

async function getMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveMap(map: Record<string, string[]>) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(map)); } catch {}
}

/**
 * Schedule local push reminders when user joins an event.
 * - Evening before at 19:19
 * - 2 hours before (only if event starts at 10:00 or later)
 */
export async function scheduleEventReminders(
  eventId: string,
  eventDate: string,   // 'YYYY-MM-DD'
  eventTime: string,   // 'HH:MM'
  eventTitle: string,
) {
  // Cancel any existing reminders for this event first
  await cancelEventReminders(eventId);

  const [h, mi] = eventTime.split(':').map(Number);
  const [y, mo, d] = eventDate.split('-').map(Number);
  const now = new Date();
  const ids: string[] = [];

  // 1. Evening before at 19:19
  const dayBefore = new Date(y, mo - 1, d - 1, 19, 19, 0);
  if (dayBefore > now) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Zajtra máš event!',
          body: eventTitle,
          data: { event_id: eventId },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
      });
      ids.push(id);
    } catch {}
  }

  // 2. 2 hours before (only for events starting at 10:00 or later)
  if (h >= 10) {
    const eventStart = new Date(y, mo - 1, d, h, mi, 0);
    const twoHoursBefore = new Date(eventStart.getTime() - 2 * 60 * 60 * 1000);
    if (twoHoursBefore > now) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Za 2 hodiny máš event!',
            body: eventTitle,
            data: { event_id: eventId },
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: twoHoursBefore },
        });
        ids.push(id);
      } catch {}
    }
  }

  if (ids.length > 0) {
    const map = await getMap();
    map[eventId] = ids;
    await saveMap(map);
  }
}

/** Cancel all scheduled reminders for an event (when user leaves). */
export async function cancelEventReminders(eventId: string) {
  const map = await getMap();
  const ids = map[eventId] ?? [];
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  if (ids.length > 0) {
    delete map[eventId];
    await saveMap(map);
  }
}
