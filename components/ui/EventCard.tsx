import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, ImageStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Event } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface EventCardProps {
  event: Event;
  featured?: boolean;
  attending?: boolean;
}

export function EventCard({ event, featured, attending }: EventCardProps) {
  const router = useRouter();
  const { profile, user } = useAuth();

  const d = getEventDate(event.date, event.is_recurring);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNum = d.getDate();
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const isToday = new Date().toDateString() === d.toDateString();

  const priceLabel = event.is_free || event.price === 0 ? 'Free' : `€${event.price}`;
  const isFree = event.is_free || event.price === 0;
  const clubName = event.club?.name ?? null;
  // Use attendees length as fallback if going_count is stale/0
  const goingCount = Math.max(event.going_count ?? 0, event.attendees?.length ?? 0, attending ? 1 : 0);

  if (featured) {
    return (
      <TouchableOpacity
        style={styles.featured}
        onPress={() => router.push(`/event/${event.id}`)}
        activeOpacity={0.93}
      >
        {event.cover_url ? (
          <ImageBackground
            source={{ uri: event.cover_url }}
            style={styles.featuredBg}
            imageStyle={styles.featuredImage}
          >
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
              <Defs>
                <SvgGrad id="fg" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000" stopOpacity="0" />
                  <Stop offset="0.45" stopColor="#000" stopOpacity="0.12" />
                  <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
                </SvgGrad>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#fg)" />
            </Svg>
            <FeaturedContent
              event={event}
              isToday={isToday}
              dayName={dayName}
              dayNum={dayNum}
              monthShort={monthShort}
              priceLabel={priceLabel}
              isFree={isFree}
              clubName={clubName}
              goingCount={goingCount}
              dark
            />
          </ImageBackground>
        ) : (
          <View style={[styles.featuredBg, { backgroundColor: Colors.black }]}>
            <FeaturedContent
              event={event}
              isToday={isToday}
              dayName={dayName}
              dayNum={dayNum}
              monthShort={monthShort}
              priceLabel={priceLabel}
              isFree={isFree}
              clubName={clubName}
              goingCount={goingCount}
              dark={false}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Row card ──
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/event/${event.id}`)}
      activeOpacity={0.8}
    >
      {/* Date block */}
      <View style={[styles.dateBlock, isToday && styles.dateBlockToday, attending && styles.dateBlockGoing]}>
        <Text style={[styles.dateBlockDay, isToday && styles.dateBlockTextToday]}>
          {isToday ? 'NOW' : dayName}
        </Text>
        <Text style={[styles.dateBlockNum, isToday && styles.dateBlockTextToday]}>{dayNum}</Text>
        <Text style={[styles.dateBlockMonth, isToday && styles.dateBlockTextToday]}>{monthShort}</Text>
      </View>

      {/* Info */}
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.rowMetaRow}>
          {event.time ? <Text style={styles.rowMeta}>{event.time}</Text> : null}
          {event.venue ? (
            <>
              <Text style={styles.rowDot}>·</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>{event.venue.split(',')[0].trim()}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.rowBottomRow}>
          {(goingCount > 0 || attending) && <GoingAvatars count={goingCount} attendees={event.attendees} attending={attending} userProfile={profile} userId={user?.id} />}
          {clubName ? <Text style={styles.rowClub} numberOfLines={1}>{clubName}</Text> : null}
          <View style={[styles.pricePill, isFree && styles.pricePillFree]}>
            <Text style={[styles.pricePillText, isFree && styles.pricePillTextFree]}>{priceLabel}</Text>
          </View>
        </View>
      </View>

      {/* Thumb */}
      <View style={styles.rowThumbWrap}>
        {event.cover_url ? (
          <Image source={{ uri: event.cover_url }} style={styles.rowThumb} />
        ) : (
          <View style={[styles.rowThumb, { backgroundColor: Colors.grayLight }]} />
        )}
        {attending && (
          <View style={styles.goingBadge}>
            <Text style={styles.goingBadgeText}>✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const SAMPLE_AVATARS = [
  require('@/assets/images/sample_av1.jpg'),
  require('@/assets/images/sample_av2.jpg'),
  require('@/assets/images/sample_av3.jpg'),
  require('@/assets/images/sample_av4.jpg'),
];

type AttendeeProfile = { id: string; name: string; avatar_url: string | null } | null | undefined;

function GoingAvatars({ count, attendees, attending, userProfile, userId }: {
  count: number;
  attendees?: Array<{ profile?: AttendeeProfile }>;
  attending?: boolean;
  userProfile?: { name?: string | null; avatar_url?: string | null } | null;
  userId?: string;
}) {
  // Check if user is in attendees list (fallback when attending prop not yet set)
  const userInList = userId ? (attendees ?? []).some((a: any) => a?.profile?.id === userId) : false;
  const isAttending = attending || userInList;

  // Build ordered list: exclude current user, others fill remaining slots
  const others = (attendees ?? []).filter((a: any) => a?.profile?.id !== userId);
  const sorted = [...others].sort((a, b) => (b.profile?.avatar_url ? 1 : 0) - (a.profile?.avatar_url ? 1 : 0));

  const effectiveCount = Math.max(count, isAttending ? 1 : 0);
  const visible = Math.min(effectiveCount, 3);
  const overflow = effectiveCount - visible;

  return (
    <View style={avStyles.row}>
      {Array.from({ length: visible }).map((_, i) => {
        const ml = i === 0 ? 0 : -7;
        const zIdx = 3 - i;
        // First slot: user's avatar if attending
        if (i === 0 && isAttending) {
          const initial = (userProfile?.name ?? '?').charAt(0).toUpperCase();
          return (
            <View key="me" style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.white, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', marginLeft: ml, zIndex: zIdx, overflow: 'hidden' }}>
              <Text style={{ fontSize: 7, fontWeight: '400', color: Colors.black }}>{initial}</Text>
              {userProfile?.avatar_url ? <Image source={{ uri: userProfile.avatar_url }} style={StyleSheet.absoluteFill as ImageStyle} /> : null}
            </View>
          );
        }
        // Other slots
        const slotIndex = isAttending ? i - 1 : i;
        const att = sorted[slotIndex];
        if (att?.profile?.avatar_url) {
          return <Image key={i} source={{ uri: att.profile.avatar_url }} style={[avStyles.circle, { marginLeft: ml, zIndex: zIdx }] as ImageStyle} />;
        }
        return <Image key={i} source={SAMPLE_AVATARS[i % SAMPLE_AVATARS.length]} style={[avStyles.circle, { marginLeft: ml, zIndex: zIdx }] as ImageStyle} />;
      })}
      {overflow > 0 && (
        <View style={[avStyles.circle, avStyles.overflow, { marginLeft: -3 }]}>
          <Text style={avStyles.overflowText} adjustsFontSizeToFit numberOfLines={1}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const avStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.white },
  overflow: { backgroundColor: '#888', alignItems: 'center', justifyContent: 'center', minWidth: 18, width: 'auto', paddingHorizontal: 3 },
  overflowText: { fontSize: 6, fontWeight: '800', color: Colors.white },
  fallback: { backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontSize: 7, fontWeight: '800', color: Colors.black },
});

function FeaturedContent({ event, isToday, dayName, dayNum, monthShort, priceLabel, isFree, clubName, goingCount, dark }: any) {
  const textColor = dark ? Colors.white : Colors.white;
  const subColor = dark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.7)';

  return (
    <View style={styles.featuredContent}>
      {/* Top row: category + price */}
      <View style={styles.featuredTopRow}>
        {event.category ? (
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{event.category.toUpperCase()}</Text>
          </View>
        ) : <View />}
        <View style={[styles.featuredPricePill, isFree && styles.featuredPricePillFree]}>
          <Text style={[styles.featuredPriceText, isFree && styles.featuredPriceTextFree]}>{priceLabel}</Text>
        </View>
      </View>

      {/* Bottom: date badge + title + meta */}
      <View style={styles.featuredBottom}>
        <View style={styles.featuredDateBadge}>
          <Text style={styles.featuredDateDay}>{isToday ? 'TODAY' : dayName}</Text>
          <Text style={styles.featuredDateNum}>{dayNum}</Text>
        </View>
        <View style={styles.featuredTextCol}>
          <Text style={[styles.featuredTitle, { color: textColor }]} numberOfLines={2}>{event.title}</Text>
          <Text style={[styles.featuredMeta, { color: subColor }]} numberOfLines={1}>
            {clubName ? `${clubName}  ·  ` : ''}{event.time}{goingCount > 0 ? `  ·  ${goingCount} going` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getEventDate(date: string, isRecurring?: boolean): Date {
  const d = new Date(date + 'T00:00:00');
  if (!isRecurring) return d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (d < today) d.setDate(d.getDate() + 7);
  return d;
}

const styles = StyleSheet.create({
  // ── Featured ──
  featured: { borderRadius: 20, overflow: 'hidden', height: 240 },
  featuredBg: { flex: 1 },
  featuredImage: { borderRadius: 20 },
  featuredContent: { flex: 1, justifyContent: 'space-between', padding: 16 },
  featuredTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  categoryPill: {
    backgroundColor: Colors.lime, borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryPillText: { fontSize: 9, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  featuredPricePill: {
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  featuredPricePillFree: { backgroundColor: Colors.lime },
  featuredPriceText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  featuredPriceTextFree: { color: Colors.black },

  featuredBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  featuredDateBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 46,
  },
  featuredDateDay: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },
  featuredDateNum: { fontSize: 22, fontWeight: '800', color: Colors.white, lineHeight: 26, fontFamily: Fonts.extrabold },
  featuredTextCol: { flex: 1 },
  featuredTitle: { fontSize: 20, fontWeight: '800', color: Colors.white, letterSpacing: -0.3, marginBottom: 4, fontFamily: Fonts.extrabold },
  featuredMeta: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.regular },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dateBlock: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.grayLight,
    borderRadius: 12,
    paddingVertical: 8,
    gap: 0,
  },
  dateBlockToday: { backgroundColor: Colors.black },
  dateBlockGoing: { backgroundColor: Colors.lime },
  dateBlockDay: { fontSize: 9, fontWeight: '700', color: Colors.gray, letterSpacing: 0.5 },
  dateBlockNum: { fontSize: 22, fontWeight: '800', color: Colors.black, lineHeight: 26, fontFamily: Fonts.extrabold },
  dateBlockMonth: { fontSize: 9, fontWeight: '600', color: Colors.gray, letterSpacing: 0.3 },
  dateBlockTextToday: { color: Colors.white },

  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold, letterSpacing: -0.2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowMeta: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, flexShrink: 1 },
  rowDot: { fontSize: 12, color: Colors.grayBorder },
  rowBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  rowClub: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.medium, flexShrink: 1, flexGrow: 0 },
  pricePill: {
    backgroundColor: Colors.grayLight, borderRadius: 50,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pricePillFree: { backgroundColor: Colors.lime },
  pricePillText: { fontSize: 10, fontWeight: '700', color: Colors.gray },
  pricePillTextFree: { color: Colors.black },
  goingBadge: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  goingBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.black },

  rowThumbWrap: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  rowThumb: { width: 64, height: 64 },
});
