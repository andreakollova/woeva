import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { BackButton } from '@/components/ui/BackButton';
import { useTranslations } from '@/context/LanguageContext';

const PRIVACY_POLICY = `Last updated: May 2026

Woeva ("we", "us", "our") operates the Woeva mobile application. This policy explains what personal data we collect, why we collect it, and your rights under the General Data Protection Regulation (GDPR) and applicable Slovak law.

1. DATA WE COLLECT

Account data
• Name, email address, and profile photo when you register with email/password or via Apple Sign-In / Google Sign-In. When using social login we receive only the data you authorise the provider to share.

Location
• City (stored on your profile) and approximate GPS coordinates (only when you explicitly grant permission) to show events near you. GPS is never stored — it is used in-session only to rank nearby events.

Device & notifications
• Push notification token to deliver event reminders, chat messages, and activity alerts.

Content you create
• Events, club details, event cover photos, and chat messages you send in event rooms.

Usage
• Events you join or leave, ticket records, club memberships, and any reviews you submit.

Payment data
• Stripe processes all card payments. We store only the Stripe customer ID and connect account ID — no card numbers, CVVs, or full payment details are ever held by us.

Apple Wallet
• When you generate an Apple Wallet pass, your name and event details are embedded in the pass file, which is delivered directly to your device and stored only in Apple Wallet.

Camera & photo library
• Used only when you choose to upload an event cover photo. Images are uploaded to our secure storage and never processed for any other purpose.

2. HOW WE USE YOUR DATA
• To provide, operate, and personalise the Woeva experience
• To display your events and profile to other users in the context of events and clubs
• To send push notifications and emails about events you are attending or managing
• To process ticket payments and issue refunds via Stripe
• To generate Apple Wallet passes on request
• To show events relevant to your location (GPS used in-session, never stored)

3. LEGAL BASIS (GDPR)
• Contract performance: account management, event registration, payments
• Legitimate interests: push notifications for events you have joined, security monitoring
• Consent: GPS location access, optional marketing communications

4. DATA SHARING
• We do not sell your personal data to any third party
• Stripe (stripe.com) — payment processing, governed by Stripe's Privacy Policy
• Apple / Google — social sign-in, governed by their respective privacy policies
• Supabase — database and authentication infrastructure (EU data region)
• Expo — push notification delivery
• No other third parties receive your personal data

5. YOUR RIGHTS (GDPR)
You have the right to:
• Access: request a copy of your personal data
• Rectification: correct inaccurate data via Settings → Profile
• Erasure: delete your account and all data via Settings → Delete account
• Portability: request your data in a machine-readable format
• Objection: opt out of processing based on legitimate interests
• Withdraw consent: revoke location or notification permissions at any time in your device settings

To exercise any right, email us at hello@woeva.app. We will respond within 30 days.

6. DATA RETENTION
Your data is retained for as long as your account is active. Deleting your account permanently removes your profile, events, clubs, messages, tickets, and all associated data within 30 days. Anonymised aggregate statistics may be retained.

7. CHILDREN
Woeva is not directed at children under 16. We do not knowingly collect data from anyone under 16.

8. CONTACT & COMPLAINTS
For privacy questions: hello@woeva.app
You also have the right to lodge a complaint with the Slovak Data Protection Authority (dataprotection.gov.sk).`;

const TERMS = `Last updated: May 2026

By downloading or using Woeva you agree to these Terms of Service. Please read them carefully.

1. ELIGIBILITY
You must be at least 16 years old to use Woeva. By using the app you confirm that you meet this requirement.

2. ACCOUNT RESPONSIBILITY
You are responsible for keeping your login credentials secure and for all activity that occurs under your account. Notify us immediately at hello@woeva.app if you suspect unauthorised access. You may sign in with email/password, Apple Sign-In, or Google Sign-In.

3. CONTENT
You retain ownership of content you create (events, clubs, photos, messages). By posting content you grant Woeva a non-exclusive, royalty-free licence to display it within the app to other users. You must not post content that is illegal, harmful, misleading, discriminatory, or violates any third-party rights.

4. EVENTS
Event creators are responsible for the accuracy of event details including date, time, location, and price. Woeva is a platform connecting organisers and attendees — we are not the organiser of any event listed in the app.

5. TICKETS & PAYMENTS
Paid tickets are processed by Stripe. You may also purchase tickets payable at the door. Apple Wallet passes are available for your tickets.

Refund policy:
• Full refund if the organiser cancels the event, regardless of timing
• Full refund if you cancel your attendance 48+ hours before the event starts
• No refund for cancellations made less than 48 hours before the event

Refunds are processed to your original payment method within 5–10 business days.

6. CLUBS
Club owners may invite admins. Admin invitations are sent in-app and must be accepted. Admins may manage events on behalf of the club. Club owners are responsible for ensuring all club activity complies with these terms.

7. PROHIBITED CONDUCT
You may not:
• Impersonate any person or entity
• Harass, threaten, or abuse other users
• Post spam or unsolicited promotional content
• Use the app for any illegal purpose
• Scrape, crawl, or systematically extract data from the platform
• Attempt to compromise the security or integrity of the platform
• Create fake events or mislead attendees about event details

8. TERMINATION
We reserve the right to suspend or permanently delete accounts that violate these terms, at our sole discretion, with or without notice.

9. LIMITATION OF LIABILITY
Woeva is provided "as is" without warranties of any kind. We are not liable for the accuracy of event information posted by third-party organisers, cancellations, or losses arising from your use of the platform, to the maximum extent permitted by applicable law.

10. CHANGES TO TERMS
We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the updated terms. Material changes will be notified in-app.

11. GOVERNING LAW
These terms are governed by the laws of the Slovak Republic. Any disputes shall be subject to the jurisdiction of Slovak courts, without prejudice to your rights as a consumer under EU law.

12. CONTACT
Questions or complaints? Email us at: hello@woeva.app`;

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
