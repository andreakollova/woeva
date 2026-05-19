import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from '@/context/LanguageContext';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 21V13h6v8" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7.5" stroke={color} strokeWidth={1.6} />
      <Path d="M20.5 20.5l-4-4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function BookedIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="17" rx="2" stroke={color} strokeWidth={1.6} />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-1.5A4.5 4.5 0 0015.5 15h-7A4.5 4.5 0 004 19.5V21" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="7.5" r="3.5" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

function DashboardIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="2" stroke={color} strokeWidth={1.6} />
      <Rect x="14" y="3" width="7" height="7" rx="2" stroke={color} strokeWidth={1.6} />
      <Rect x="3" y="14" width="7" height="7" rx="2" stroke={color} strokeWidth={1.6} />
      <Rect x="14" y="14" width="7" height="7" rx="2" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

const TAB_ICONS: Record<string, (color: string) => React.ReactNode> = {
  index: (c) => <HomeIcon color={c} />,
  search: (c) => <SearchIcon color={c} />,
  booked: (c) => <BookedIcon color={c} />,
  profile: (c) => <ProfileIcon color={c} />,
  dashboard: (c) => <DashboardIcon color={c} />,
};

function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { t, lang } = useTranslations();

  const TAB_LABELS: Record<string, string> = lang === 'sk' ? {
    index: 'Domov',
    search: 'Hľadať',
    booked: 'Lístky',
    profile: 'Profil',
    dashboard: 'Dashboard',
  } : {
    index: 'Home',
    search: 'Search',
    booked: 'Tickets',
    profile: 'Profile',
    dashboard: 'Dashboard',
  };
  const [myClubs, setMyClubs] = useState<{ id: string; name: string }[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!user) { setMyClubs([]); return; }
    supabase.from('clubs').select('id, name').eq('creator_id', user.id)
      .then(({ data }) => setMyClubs(data ?? []));
  }, [user]);

  function handleCreatePress() {
    if (loading) return;
    if (!user) { router.push('/(auth)/login'); return; }
    setShowMenu(true);
  }

  return (
    <>
      {/* Create menu sheet */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 4 }]}>
            {/* New Event - dominant */}
            <TouchableOpacity
              style={styles.menuItemHero}
              onPress={() => { setShowMenu(false); router.push('/event/create/step2'); }}
              activeOpacity={0.88}
            >
              <Text style={styles.menuItemHeroEmoji}>🎉</Text>
              <View>
                <Text style={styles.menuItemHeroTitle}>{t.event.newEvent}</Text>
                <Text style={styles.menuItemHeroSub}>{t.event.newEventSub}</Text>
              </View>
            </TouchableOpacity>

            {/* Secondary row */}
            <View style={styles.menuSecondaryRow}>
              {myClubs.length === 0 && (
                <TouchableOpacity style={styles.menuSecondaryItem} onPress={() => { setShowMenu(false); router.push('/club/create'); }} activeOpacity={0.7}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={9} cy={7} r={4} stroke={Colors.gray} strokeWidth={1.8} />
                    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.menuSecondaryTitle}>{t.club.createClub}</Text>
                </TouchableOpacity>
              )}
              {myClubs.length === 1 && (
                <TouchableOpacity style={styles.menuSecondaryItem} onPress={() => { setShowMenu(false); router.push(`/club/${myClubs[0].id}` as any); }} activeOpacity={0.7}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={9} cy={7} r={4} stroke={Colors.gray} strokeWidth={1.8} />
                    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.menuSecondaryTitle}>{t.club.myClub}</Text>
                </TouchableOpacity>
              )}
              {myClubs.length >= 2 && (
                <TouchableOpacity style={styles.menuSecondaryItem} onPress={() => { setShowMenu(false); router.push('/dashboard'); }} activeOpacity={0.7}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={Colors.gray} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={9} cy={7} r={4} stroke={Colors.gray} strokeWidth={1.8} />
                  </Svg>
                  <Text style={styles.menuSecondaryTitle}>My clubs ({myClubs.length})</Text>
                </TouchableOpacity>
              )}

              {/* Dashboard - always visible */}
              <View style={styles.menuSecondaryDivider} />
              <TouchableOpacity
                style={styles.menuSecondaryItem}
                onPress={() => { setShowMenu(false); router.push('/dashboard'); }}
                activeOpacity={0.7}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={12} width={4} height={9} rx={1} stroke={Colors.gray} strokeWidth={1.8} />
                  <Rect x={10} y={7} width={4} height={14} rx={1} stroke={Colors.gray} strokeWidth={1.8} />
                  <Rect x={17} y={3} width={4} height={18} rx={1} stroke={Colors.gray} strokeWidth={1.8} />
                </Svg>
                <Text style={styles.menuSecondaryTitle}>Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          if (route.name === 'create') {
            return (
              <TouchableOpacity
                key="create"
                style={styles.createBtn}
                onPress={handleCreatePress}
                activeOpacity={0.85}
              >
                <Text style={styles.createIcon}>+</Text>
              </TouchableOpacity>
            );
          }

          const isFocused = state.index === index;
          const activeColor = isFocused ? Colors.lime : 'rgba(255,255,255,0.5)';
          const iconFn = TAB_ICONS[route.name];
          const label = TAB_LABELS[route.name];

          if (!iconFn) return null;

          return (
            <TouchableOpacity
              key={route.name}
              style={styles.tab}
              onPress={() => { if (!isFocused) navigation.navigate(route.name); }}
              activeOpacity={0.7}
            >
              {iconFn(activeColor)}
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
    </>
  );
}

export default function TabsLayout() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile?.is_admin) router.replace('/admin');
  }, [profile?.is_admin]);

  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="booked" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    backgroundColor: Colors.black,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 68,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.5)',
  },
  labelActive: {
    color: Colors.lime,
  },
  createBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  createIcon: {
    fontSize: 26,
    fontWeight: '300',
    color: Colors.black,
    lineHeight: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 10,
  },

  // Hero item - New event
  menuItemHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: Colors.lime,
    borderRadius: 20,
  },
  menuItemHeroEmoji: { fontSize: 28 },
  menuItemHeroTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: Colors.black,
  },
  menuItemHeroSub: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: Fonts.regular,
    marginTop: 1,
  },

  // Secondary row
  menuSecondaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.grayBorder,
    paddingTop: 12,
    marginTop: 2,
  },
  menuSecondaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 4,
  },
  menuSecondaryDivider: {
    width: 1,
    backgroundColor: Colors.grayBorder,
    marginVertical: 2,
  },
  menuSecondaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.gray,
  },
});
