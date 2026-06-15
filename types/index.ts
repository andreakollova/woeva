export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  interests: string[];
  phone: string | null;
  push_token: string | null;
  notifications_enabled: boolean;
  notif_new_event_my_tags: boolean;
  notif_new_event_all: boolean;
  notif_club_events: boolean;
  notif_chat: boolean;
  notif_attendees: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  creator_id: string | null;
  billing_info: Record<string, any>;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  events_data: any[];
  gross: number;
  stripe_fee: number;
  woeva_fee: number;
  net: number;
  status: 'draft' | 'issued' | 'paid';
  created_at: string;
  creator?: { name: string; email: string | null };
}

export interface AdminLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  note: string | null;
  created_at: string;
}

export interface Blacklist {
  id: string;
  user_id: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  creator_id: string;
  club_id: string | null;
  title: string;
  tagline: string | null;
  category: string;
  tags: string[];
  cover_url: string | null;
  cover_urls?: string[] | null;
  date: string;
  time: string;
  duration: number;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  price: number;
  going_count: number;
  is_free: boolean;
  is_recurring: boolean;
  city: string;
  created_at: string;
  source?: string | null;
  pay_at_door?: boolean | null;
  capacity?: number | null;
  cancelled_dates?: string[] | null;
  publish_at?: string | null;
  recurring_open_weekday?: number | null;
  recurring_open_time?: string | null;
  status: 'active' | 'cancelled';
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_note: string | null;
  creator?: Profile;
  club?: { id: string; name: string; cover_url: string | null; logo_url?: string | null } | null;
  attendees?: Array<{ profile?: { id: string; name: string; avatar_url: string | null } | null }>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'event_cancelled' | 'new_event' | 'event_chat' | 'club_event' | 'admin_invite' | 'join';
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

export interface Club {
  id: string;
  creator_id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  tags: string[];
  cover_url: string | null;
  logo_url: string | null;
  member_count: number;
  rating: number;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
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
  'Movement & Sport',
  'Wellness & Body',
  'Food & Drinks',
  'Art & Creation',
  'Music & Nightlife',
  'Learning & Mind',
  'Community & Belonging',
] as const;

export const CATEGORY_SK: Record<string, string> = {
  'Movement & Sport': 'Pohyb & Šport',
  'Wellness & Body': 'Wellness & Telo',
  'Food & Drinks': 'Jedlo & Pitie',
  'Art & Creation': 'Umenie & Tvorba',
  'Music & Nightlife': 'Hudba & Nightlife',
  'Learning & Mind': 'Vzdelávanie & Myseľ',
  'Community & Belonging': 'Komunita & Spolupatričnosť',
};

export const CATEGORY_EN: Record<string, string> = {};

export type CategoryName = typeof CATEGORIES[number];
