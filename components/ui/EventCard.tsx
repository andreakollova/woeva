import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Event } from '@/types';

interface EventCardProps {
  event: Event;
  featured?: boolean;
}

export function EventCard({ event, featured }: EventCardProps) {
  const router = useRouter();

  const timeLabel = getTimeLabel(event.date, event.time);
  const priceLabel = event.is_free ? 'free' : `€${event.price}`;

  if (featured) {
    return (
      <TouchableOpacity
        style={styles.featured}
        onPress={() => router.push(`/event/${event.id}`)}
        activeOpacity={0.92}
      >
        {event.cover_url ? (
          <ImageBackground source={{ uri: event.cover_url }} style={styles.featuredBg} imageStyle={styles.featuredImage}>
            <View style={styles.featuredOverlay} />
            <View style={styles.featuredContent}>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{timeLabel}</Text>
              </View>
              <Text style={styles.featuredTitle}>{event.title}</Text>
              <Text style={styles.featuredMeta}>{event.venue}  {event.going_count} going  {priceLabel}</Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.featuredBg, { backgroundColor: Colors.lime }]}>
            <View style={styles.featuredContent}>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{timeLabel}</Text>
              </View>
              <Text style={[styles.featuredTitle, { color: Colors.black }]}>{event.title}</Text>
              <Text style={[styles.featuredMeta, { color: Colors.black }]}>{event.venue}  {event.going_count} going  {priceLabel}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/event/${event.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.rowThumb}>
        {event.cover_url && <Image source={{ uri: event.cover_url }} style={styles.rowImage} />}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowMeta}>{formatDate(event.date)}  {event.time}  ·  {event.venue?.toUpperCase()}</Text>
        <Text style={styles.rowTitle}>{event.title}</Text>
        <Text style={styles.rowSub}>{event.going_count} going · {priceLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

function getTimeLabel(date: string, time: string) {
  const today = new Date();
  const evDate = new Date(date);
  const isToday = today.toDateString() === evDate.toDateString();
  return isToday ? `TONIGHT · ${time}` : `${formatDate(date)} · ${time}`;
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  featured: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
  },
  featuredBg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  featuredImage: {
    borderRadius: 16,
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  featuredContent: {
    padding: 16,
    gap: 4,
  },
  timeBadge: {
    backgroundColor: Colors.black,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  timeBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    letterSpacing: 0.5,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  featuredMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400',
    fontFamily: Fonts.regular,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: Colors.grayLight,
    overflow: 'hidden',
  },
  rowImage: {
    width: '100%',
    height: '100%',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowMeta: {
    fontSize: 11,
    color: Colors.gray,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    letterSpacing: 0.3,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: Colors.black,
  },
  rowSub: {
    fontSize: 13,
    color: Colors.gray,
    fontFamily: Fonts.regular,
  },
});
