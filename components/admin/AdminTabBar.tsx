import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

export type AdminTab = 'index' | 'users' | 'activity' | 'billing' | 'more';

function OverviewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth={1.6} />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth={1.6} />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth={1.6} />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

function UsersIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-1.5A4.5 4.5 0 0012.5 15h-7A4.5 4.5 0 001 19.5V21" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="9" cy="7.5" r="3.5" stroke={color} strokeWidth={1.6} />
      <Path d="M23 21v-1.5a4.5 4.5 0 00-3-4.24" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ActivityIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BillingIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth={1.6} />
      <Path d="M2 10h20" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M6 15h4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function MoreIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="5" cy="12" r="1.2" fill={color} />
      <Circle cx="12" cy="12" r="1.2" fill={color} />
      <Circle cx="19" cy="12" r="1.2" fill={color} />
    </Svg>
  );
}

const TABS: { key: AdminTab; route: string; label: string; Icon: React.FC<{ color: string }> }[] = [
  { key: 'index',    route: '/admin',           label: 'Prehľad',      Icon: OverviewIcon },
  { key: 'users',    route: '/admin/users',    label: 'Používatelia', Icon: UsersIcon },
  { key: 'activity', route: '/admin/activity', label: 'Aktivita',     Icon: ActivityIcon },
  { key: 'billing',  route: '/admin/billing',  label: 'Fakturácia',   Icon: BillingIcon },
  { key: 'more',     route: '/admin/more',     label: 'Viac',         Icon: MoreIcon },
];

interface Props {
  active: AdminTab;
  reportsBadge?: number;
}

export function AdminTabBar({ active, reportsBadge = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        {TABS.map(tab => {
          const isActive = tab.key === active;

          const color = isActive ? Colors.lime : 'rgba(255,255,255,0.35)';
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => { if (!isActive) router.replace(tab.route as any); }}
              activeOpacity={0.75}
            >
              <tab.Icon color={color} />
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.black,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1C1C1C',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tabActive: {},
  label: { fontSize: 10, fontWeight: '500', fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.3)' },
  labelActive: { color: Colors.lime, fontWeight: '700', fontFamily: Fonts.bold },
});
