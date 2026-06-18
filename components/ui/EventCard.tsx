import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground, ImageStyle, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Event } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';
import { formatVenue, clubDisplayName } from '@/lib/formatVenue';

interface EventCardProps {
  event: Event;
  featured?: boolean;
  attending?: boolean;
}

export function EventCard({ event, featured, attending }: EventCardProps) {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { lang } = useTranslations();
  const locale = lang === 'sk' ? 'sk-SK' : 'en-US';

  const d = getEventDate(event.date, event.is_recurring);
  const coverUrl = getRotatingCover(event);
  const dayName = d.toLocaleDateString(locale, { weekday: 'short' }).toUpperCase();
  const dayNum = d.getDate();
  const monthShort = d.toLocaleDateString(locale, { month: 'short' }).toUpperCase();
  const isToday = new Date().toDateString() === d.toDateString();

  const { t } = useTranslations();
  const isPayAtDoor = !!(event as any).pay_at_door;
  const isFree = !isPayAtDoor && (event.is_free || event.price === 0);
  const priceLabel = isPayAtDoor ? `€${event.price} ${lang === 'sk' ? 'na mieste' : 'at door'}` : (isFree ? t.event.freeLabel : `€${event.price}`);
  const clubName = clubDisplayName(event.club?.name) || (event as any).creator?.name || null;
  // Use attendees length as fallback if going_count is stale/0
  const goingCount = Math.max(event.going_count ?? 0, event.attendees?.length ?? 0, attending ? 1 : 0);

  const [imageLoading, setImageLoading] = useState(true);

  if (featured) {
    return (
      <View style={{ overflow: 'visible' }}>
      <TouchableOpacity
        style={styles.featured}
        onPress={() => router.push(`/event/${event.id}`)}
        activeOpacity={0.93}
      >
        {coverUrl ? (
          <ImageBackground
            source={{ uri: coverUrl }}
            style={styles.featuredBg}
            imageStyle={styles.featuredImage}
            onLoadEnd={() => setImageLoading(false)}
          >
            {imageLoading && (
              <ActivityIndicator color="rgba(200,255,0,0.5)" size="small" style={styles.featuredLoader} />
            )}
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
              attending={attending}
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
              attending={attending}
              dark={false}
            />
          </View>
        )}
      </TouchableOpacity>
      {event.category ? (
        <View style={styles.featuredCategoryPill} pointerEvents="none">
          <Text style={styles.categoryPillText}>{(({ 'Movement & Sport':'Pohyb & Šport', 'Wellness & Body':'Wellness & Telo', 'Food & Drinks':'Jedlo & Pitie', 'Art & Creation':'Umenie & Tvorba', 'Music & Nightlife':'Hudba & Nočný život', 'Learning & Mind':'Vzdelávanie', 'Community & Belonging':'Komunita' } as Record<string,string>)[(event.category.split(',').find((c: string) => c.trim().includes('&')) ?? event.category.split(',')[0]).trim()] ?? (event.category.split(',').find((c: string) => c.trim().includes('&')) ?? event.category.split(',')[0]).trim()).toUpperCase()}</Text>
        </View>
      ) : null}
      </View>
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
      {(() => {
        const isGoing = attending || (!event.is_recurring && event.creator_id === user?.id);
        return (
          <View style={[styles.dateBlock, isToday && styles.dateBlockToday, isGoing && styles.dateBlockGoing]}>
            <Text style={[styles.dateBlockDay, isToday && styles.dateBlockTextToday, isGoing && styles.dateBlockTextGoing]}>
              {isToday ? 'NOW' : dayName}
            </Text>
            <Text style={[styles.dateBlockNum, isToday && styles.dateBlockTextToday, isGoing && styles.dateBlockTextGoing]}>{dayNum}</Text>
            <Text style={[styles.dateBlockMonth, isToday && styles.dateBlockTextToday, isGoing && styles.dateBlockTextGoing]}>{monthShort}</Text>
          </View>
        );
      })()}

      {/* Info */}
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.rowMetaRow}>
          <Text style={styles.rowMeta}>{formatTime(event.time)}</Text>
          {event.venue ? (
            <>
              <Text style={styles.rowDot}>·</Text>
              <Text style={[styles.rowMeta, { flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                {formatVenue(event.venue)}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.rowBottomRow}>
          {(goingCount > 0 || attending) && <GoingAvatars count={goingCount} attendees={event.attendees} attending={attending} userProfile={profile} userId={user?.id} />}
          {clubName ? <Text style={styles.rowClub} numberOfLines={1}>{clubName}</Text> : null}
          {event.capacity != null && (
            goingCount >= event.capacity
              ? <View style={styles.capacityFullPill}><Text style={styles.capacityFullText}>{lang === 'sk' ? 'Plné' : 'Full'}</Text></View>
              : <View style={styles.capacityPill}><Text style={styles.capacityText}>{goingCount}/{event.capacity}</Text></View>
          )}
          <View style={[styles.pricePill, isFree && styles.pricePillFree]}>
            <Text style={[styles.pricePillText, isFree && styles.pricePillTextFree]}>{priceLabel}</Text>
          </View>
        </View>
      </View>

      {/* Thumb + going badge overlay */}
      <View style={{ position: 'relative' }}>
        <View style={styles.rowThumbWrap}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={event.venue?.toLowerCase().includes('freshmarket') ? styles.rowThumbRight : styles.rowThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.rowThumb, { backgroundColor: Colors.grayLight }]} />
          )}
        </View>
        {attending && (
          <View style={styles.goingBadge}>
            <Text style={styles.goingBadgeText}>✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}


type AttendeeProfile = { id: string; name: string; avatar_url: string | null } | null | undefined;

function GoingAvatars({ count, attendees, attending, userProfile, userId }: {
  count: number;
  attendees?: Array<{ profile?: AttendeeProfile }>;
  attending?: boolean;
  userProfile?: { name?: string | null; avatar_url?: string | null } | null;
  userId?: string;
}) {
  const isAttending = attending ?? false;

  // Build ordered list: exclude current user and bot, prioritise profiles with avatars
  const BOT_ID = '00000000-0000-0000-0000-000000000001';
  const others = (attendees ?? []).filter((a: any) => a?.profile?.id !== userId && a?.profile?.id !== BOT_ID);
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
          // Prefer the attendee record from the DB (has avatar_url reliably)
          const meFromList = (attendees ?? []).find((a: any) => a?.profile?.id === userId);
          const myProfile = meFromList?.profile ?? userProfile;
          const initial = (myProfile?.name ?? (userProfile?.name ?? '?')).charAt(0).toUpperCase();
          return (
            <View key="me" style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.white, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', marginLeft: ml, zIndex: zIdx, overflow: 'hidden' }}>
              <Text style={{ fontSize: 7, fontWeight: '400', color: Colors.black }}>{initial}</Text>
              {myProfile?.avatar_url ? <Image source={{ uri: myProfile.avatar_url }} style={StyleSheet.absoluteFill as ImageStyle} /> : null}
            </View>
          );
        }
        // Other slots
        const slotIndex = isAttending ? i - 1 : i;
        const att = sorted[slotIndex];
        if (att?.profile?.avatar_url) {
          return <Image key={i} source={{ uri: att.profile.avatar_url }} style={[avStyles.circle, { marginLeft: ml, zIndex: zIdx }] as ImageStyle} />;
        }
        const initial = (att?.profile?.name ?? '?').charAt(0).toUpperCase();
        return (
          <View key={i} style={[avStyles.circle, avStyles.overflow, { marginLeft: ml, zIndex: zIdx }]}>
            <Text style={avStyles.overflowText}>{initial}</Text>
          </View>
        );
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

function FeaturedContent({ event, isToday, dayName, dayNum, monthShort, priceLabel, isFree, clubName, goingCount, attending, dark }: any) {
  const { t, lang } = useTranslations();
  const textColor = dark ? Colors.white : Colors.white;
  const subColor = dark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.7)';

  const capacityStr = event.capacity != null
    ? (goingCount >= event.capacity
        ? (lang === 'sk' ? `Plné ${goingCount}/${event.capacity}` : `Full ${goingCount}/${event.capacity}`)
        : `${goingCount}/${event.capacity}`)
    : null;

  return (
    <View style={styles.featuredContent}>
      {/* Top row: price + going badge */}
      <View style={styles.featuredTopRow}>
        <View />
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.featuredPricePill, isFree && styles.featuredPricePillFree]}>
            <Text style={[styles.featuredPriceText, isFree && styles.featuredPriceTextFree]}>{priceLabel}</Text>
          </View>
          {attending && (
            <View style={styles.featuredGoingBadge}>
              <Text style={styles.goingBadgeText}>✓</Text>
            </View>
          )}
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
            {clubName ? `${clubName}  ·  ` : ''}{formatTime(event.time)}{event.capacity != null ? `  ·  ${goingCount}/${event.capacity}` : (goingCount > 0 ? `  ·  ${t.event.going_count(goingCount)}` : '')}
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatTime(time?: string | null): string {
  if (!time || time === '00:00' || time === '0:00') return 'Celý deň';
  return time.slice(0, 5);
}

function getRotatingCover(event: { cover_url: string | null; cover_urls?: string[] | null; date: string; is_recurring?: boolean }): string | null {
  const covers = event.cover_urls?.length ? event.cover_urls : (event.cover_url ? [event.cover_url] : []);
  if (!covers.length) return null;
  if (!event.is_recurring || covers.length === 1) return covers[0];
  // Use _recurringStartDate (set during expansion) to compute occurrence index
  const originalDate = (event as any)._recurringStartDate ?? event.date;
  const start = new Date(originalDate + 'T00:00:00');
  const occDate = new Date(event.date + 'T00:00:00');
  const weekIndex = Math.max(0, Math.round((occDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  return covers[weekIndex % covers.length];
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
  featured: { borderRadius: 20, borderBottomRightRadius: 0, overflow: 'hidden', height: 240 },
  featuredBg: { flex: 1, backgroundColor: Colors.black },
  featuredLoader: { position: 'absolute', top: 16, right: 16 },
  featuredImage: { borderRadius: 20, borderBottomRightRadius: 0 },
  featuredContent: { flex: 1, justifyContent: 'space-between', padding: 16 },
  featuredTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  categoryPill: {
    backgroundColor: Colors.lime, borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  featuredCategoryPill: {
    position: 'absolute',
    top: 16,
    left: 0,
    backgroundColor: Colors.lime,
    borderTopRightRadius: 50,
    borderBottomRightRadius: 50,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 5,
  },
  categoryPillText: { fontSize: 9, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  featuredPricePill: {
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  featuredPricePillFree: { backgroundColor: Colors.lime },
  featuredPriceText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  featuredPriceTextFree: { color: Colors.black },

  featuredBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 72 },
  featuredDateBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, borderBottomLeftRadius: 0,
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
    borderBottomLeftRadius: 0,
    paddingVertical: 8,
    gap: 0,
  },
  dateBlockToday: {},
  dateBlockGoing: { backgroundColor: Colors.lime },
  dateBlockDay: { fontSize: 9, fontWeight: '700', color: Colors.gray, letterSpacing: 0.5 },
  dateBlockNum: { fontSize: 22, fontWeight: '800', color: Colors.black, lineHeight: 26, fontFamily: Fonts.extrabold },
  dateBlockMonth: { fontSize: 9, fontWeight: '600', color: Colors.gray, letterSpacing: 0.3 },
  dateBlockTextToday: {},
  dateBlockTextGoing: { color: Colors.black },

  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.black, fontFamily: Fonts.semibold, letterSpacing: -0.2 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowMeta: { fontSize: 12, color: Colors.gray, fontFamily: Fonts.regular, flexShrink: 1 },
  rowDot: { fontSize: 10, fontWeight: '900', color: Colors.gray, marginHorizontal: -1 },
  rowBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  rowClub: { fontSize: 10, color: Colors.gray, fontFamily: Fonts.medium, flexShrink: 1, flexGrow: 0 },
  pricePill: {
    backgroundColor: Colors.grayLight, borderRadius: 50,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pricePillFree: { backgroundColor: Colors.lime },
  pricePillText: { fontSize: 10, fontWeight: '700', color: Colors.gray },
  pricePillTextFree: { color: Colors.black },
  capacityPill: { backgroundColor: Colors.grayLight, borderRadius: 50, paddingHorizontal: 7, paddingVertical: 2 },
  capacityText: { fontSize: 10, fontWeight: '700', color: Colors.gray },
  capacityFullPill: { backgroundColor: '#FFE5E5', borderRadius: 50, paddingHorizontal: 7, paddingVertical: 2 },
  capacityFullText: { fontSize: 10, fontWeight: '700', color: '#FF3B30' },
  goingBadge: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  goingBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.black },
  featuredGoingBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },

  rowThumbWrap: { width: 64, height: 64, borderRadius: 12, borderTopRightRadius: 0, overflow: 'hidden' },
  rowThumb: { width: 64, height: 64 },
  rowThumbRight: { position: 'absolute', right: 0, height: 64, width: 180 },
});
