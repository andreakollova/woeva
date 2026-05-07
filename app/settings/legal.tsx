import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { BackButton } from '@/components/ui/BackButton';
import { useTranslations } from '@/context/LanguageContext';

const PRIVACY_POLICY = `Last updated: May 2026

Woeva ("we", "us", "our") operates the Woeva mobile application. This policy explains what data we collect and how we use it.

DATA WE COLLECT
• Account data: name, email address, profile photo
• Location: city and approximate GPS location (only when you grant permission) to show nearby events
• Device token: push notification token to send you event updates
• Content: events you create, clubs you manage, messages you send in event chats
• Usage: events you join or leave, reviews you leave

HOW WE USE YOUR DATA
• To provide and personalise the app experience
• To send push and email notifications about events you are attending or managing
• To process payments via Stripe (payment data is handled solely by Stripe and never stored by us)
• To show your profile and content to other users in the context of events and clubs

DATA SHARING
• We do not sell your personal data
• Stripe processes payment data under their own privacy policy
• Supabase provides our database and authentication infrastructure
• Push notifications are delivered via Expo's push service

YOUR RIGHTS
• You may edit or delete your profile at any time in Settings → Profile
• You may delete your account and all associated data in Settings → Delete account
• You may revoke location and notification permissions in your device settings at any time

DATA RETENTION
Deleting your account permanently removes your profile, events, clubs, messages, and all associated data within 30 days.

CONTACT
For privacy questions contact us at: hello@woeva.app`;

const TERMS = `Last updated: May 2026

By using Woeva you agree to these Terms of Service.

1. ELIGIBILITY
You must be at least 16 years old to use Woeva. By using the app you confirm that you meet this requirement.

2. ACCOUNT RESPONSIBILITY
You are responsible for keeping your account credentials secure and for all activity that occurs under your account.

3. CONTENT
You retain ownership of content you create (events, clubs, messages). By posting content you grant Woeva a non-exclusive licence to display it within the app. You must not post illegal, harmful, or misleading content.

4. EVENTS AND PAYMENTS
Event creators are responsible for the accuracy of event details. Payments are processed by Stripe. Our refund policy is: full refund if an event is cancelled 48+ hours before start; no refund if cancelled less than 48 hours before start.

5. PROHIBITED CONDUCT
You may not: impersonate others, spam users, use the app for illegal activity, scrape or systematically extract data, or attempt to compromise the security of the platform.

6. TERMINATION
We reserve the right to suspend or delete accounts that violate these terms.

7. LIMITATION OF LIABILITY
Woeva is provided "as is". We are not liable for losses arising from your use of the platform beyond the maximum extent permitted by applicable law.

8. GOVERNING LAW
These terms are governed by the laws of the Slovak Republic.

9. CONTACT
Questions? Email us at: hello@woeva.app`;

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type: 'privacy' | 'terms' }>();
  const { t } = useTranslations();

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? t.about.privacyPolicy : t.about.termsOfService;
  const content = isPrivacy ? PRIVACY_POLICY : TERMS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.body}>{content}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  body: { fontSize: 13, color: Colors.gray, lineHeight: 22, fontFamily: Fonts.regular },
});
