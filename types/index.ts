export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  interests: string[];
  phone: string | null;
}

export interface Event {
  id: string;
  creator_id: string;
  title: string;
  tagline: string | null;
  category: string;
  cover_url: string | null;
  date: string;
  time: string;
  duration: number;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  price: number;
  going_count: number;
  is_free: boolean;
  city: string;
  created_at: string;
  creator?: Profile;
}

export interface Club {
  id: string;
  creator_id: string;
  name: string;
  tagline: string | null;
  category: string;
  cover_url: string | null;
  member_count: number;
  rating: number;
  city: string;
  created_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: 'approved' | 'pending';
  joined_at: string;
  profile?: Profile;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  paid: boolean;
  payment_intent_id: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Review {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export interface Report {
  id: string;
  type: 'inappropriate' | 'spam' | 'harassment';
  target_id: string;
  reporter_id: string;
  reason: string;
  status: 'open' | 'in_review' | 'closed';
  created_at: string;
}

export const CATEGORIES = [
  'Sport', 'Coffee', 'Sober party', 'Party', 'Music', 'Art',
  'Marathon', 'Film', 'Yoga', 'Tech', 'Gardening', 'Gaming',
  'Running', 'Hockey', 'Dance', 'Food', 'Networking',
] as const;

export type Category = typeof CATEGORIES[number];
