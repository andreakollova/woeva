import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

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

const TAB_ICONS: Record<string, (color: string) => React.ReactNode> = {
  index: (c) => <HomeIcon color={c} />,
  search: (c) => <SearchIcon color={c} />,
  booked: (c) => <BookedIcon color={c} />,
  profile: (c) => <ProfileIcon color={c} />,
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  search: 'Search',
  booked: 'Booked',
  profile: 'Profile',
};

function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [hasClub, setHasClub] = useState<boolean | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!user) { setHasClub(null); return; }
    supabase.from('clubs').select('id').eq('creator_id', user.id).limit(1).then(({ data }) => {
      setHasClub((data ?? []).length > 0);
    });
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
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.menuTitle}>Create</Text>

            {/* New Club */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); router.push('/club/create'); }}
              activeOpacity={0.8}
            >
              <View style={styles.menuItemIcon}><Text style={styles.menuItemEmoji}>🏠</Text></View>
              <View style={styles.menuItemText}>
                <Text style={styles.menuItemTitle}>New club</Text>
                <Text style={styles.menuItemSub}>Start your own community</Text>
              </View>
            </TouchableOpacity>

            {/* New Event */}
            <TouchableOpacity
              style={[styles.menuItem, !hasClub && styles.menuItemLocked]}
              onPress={() => {
                if (!hasClub) return;
                setShowMenu(false);
                router.push('/event/create/step1');
              }}
              activeOpacity={hasClub ? 0.8 : 1}
            >
              <View style={[styles.menuItemIcon, !hasClub && styles.menuItemIconLocked]}>
                <Text style={styles.menuItemEmoji}>{hasClub ? '🎉' : '🔒'}</Text>
              </View>
              <View style={styles.menuItemText}>
                <Text style={[styles.menuItemTitle, !hasClub && styles.menuItemTitleLocked]}>New event</Text>
                <Text style={styles.menuItemSub}>
                  {hasClub ? 'Add an event to your club' : 'Create a club first to add events'}
                </Text>
              </View>
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: Colors.white,
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
    gap: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: Colors.gray,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: Colors.grayLight,
    borderRadius: 16,
  },
  menuItemLocked: {
    opacity: 0.5,
  },
  menuItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIconLocked: {
    backgroundColor: Colors.grayBorder,
  },
  menuItemEmoji: { fontSize: 22 },
  menuItemText: { flex: 1, gap: 2 },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semibold,
    color: Colors.black,
  },
  menuItemTitleLocked: { color: Colors.gray },
  menuItemSub: {
    fontSize: 13,
    color: Colors.gray,
    fontFamily: Fonts.regular,
  },
});
