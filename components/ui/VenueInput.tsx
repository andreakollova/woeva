import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Keyboard, Modal,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    amenity?: string;
    cafe?: string;
    restaurant?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

interface VenueResult {
  name: string;
  city: string;
  lat: number;
  lng: number;
}

interface VenueInputProps {
  value: string;
  onChange: (venue: string, lat?: number, lng?: number) => void;
  dark?: boolean;
}

export function VenueInput({ value, onChange, dark }: VenueInputProps) {
  const [results, setResults] = useState<VenueResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const wrapperRef = useRef<View>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-measure when results appear (keyboard may have shifted layout)
  useEffect(() => {
    if (results.length > 0) measureWrapper();
  }, [results.length]);

  function measureWrapper() {
    wrapperRef.current?.measureInWindow((x, y, width, height) => {
      setDropdownLeft(x);
      setDropdownTop(y + height + 4);
      setDropdownWidth(width);
    });
  }

  function getLabel(r: NominatimResult): string {
    const parts = r.display_name.split(', ');
    return parts.slice(0, 3).join(', ');
  }

  function getCity(r: NominatimResult): string {
    return r.address.city ?? r.address.town ?? r.address.village ?? '';
  }

  async function search(query: string) {
    onChange(query);
    setConfirmed(false);
    setResults([]);
    if (query.length < 3) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'sk,en' } });
        const data: NominatimResult[] = await res.json();
        setResults(data.map(r => ({
          name: getLabel(r),
          city: getCity(r),
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        })));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function select(r: VenueResult) {
    onChange(r.name, r.lat, r.lng);
    setConfirmed(true);
    setResults([]);
    Keyboard.dismiss();
  }

  const th = dark ? darkTheme : lightTheme;

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Text style={[styles.label, { color: th.label }]}>Address</Text>
      <View style={[styles.inputWrap, { borderColor: th.border, backgroundColor: th.bg }, focused && { borderColor: th.focusBorder }, confirmed && styles.inputConfirmed]}>
        <TextInput
          style={[styles.input, { color: th.text }]}
          value={value}
          onChangeText={search}
          placeholder="Start typing an address..."
          placeholderTextColor={th.placeholder}
          onFocus={() => { setFocused(true); measureWrapper(); }}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          selectionColor={Colors.lime}
        />
        {loading && <ActivityIndicator size="small" color={Colors.gray} style={styles.spinner} />}
        {confirmed && !loading && <Text style={styles.confirmedIcon}>✓</Text>}
      </View>
      {value.length > 0 && !confirmed && !loading && results.length === 0 && (
        <Text style={styles.hint}>↑ Select from the list to pin on map</Text>
      )}
      {confirmed && (
        <Text style={styles.confirmedHint}>📍 Location confirmed — will appear on map</Text>
      )}

      <Modal visible={results.length > 0} transparent animationType="none" statusBarTranslucent onRequestClose={() => setResults([])}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setResults([])}>
          <View style={[styles.dropdown, { top: dropdownTop, left: dropdownLeft, width: dropdownWidth }]}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.item, i < results.length - 1 && styles.itemBorder]}
                  onPress={() => select(r)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemName} numberOfLines={1}>{r.name}</Text>
                  {r.city ? <Text style={styles.itemCity}>{r.city}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const lightTheme = {
  label: Colors.black, text: Colors.black, bg: Colors.white,
  border: Colors.grayBorder, focusBorder: Colors.black, placeholder: Colors.gray,
};
const darkTheme = {
  label: '#ffffff', text: '#ffffff', bg: '#161616',
  border: '#2a2a2a', focusBorder: Colors.lime, placeholder: '#555',
};

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.black,
    marginBottom: 6,
  },
  inputWrap: {
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: Colors.black,
  },
  inputConfirmed: {
    borderColor: '#22C55E',
  },
  confirmedIcon: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '700',
    marginLeft: 6,
  },
  hint: {
    fontSize: 11,
    color: Colors.gray,
    fontFamily: Fonts.regular,
    marginTop: 4,
    marginLeft: 2,
  },
  confirmedHint: {
    fontSize: 11,
    color: '#22C55E',
    fontFamily: Fonts.regular,
    marginTop: 4,
    marginLeft: 2,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.black,
    fontFamily: Fonts.regular,
  },
  spinner: {
    marginLeft: 8,
  },
  wrapper: {},
  dropdown: {
    position: 'absolute',
    zIndex: 999,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    maxHeight: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderColor: Colors.grayBorder,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Fonts.medium,
    color: Colors.black,
  },
  itemCity: {
    fontSize: 12,
    color: Colors.gray,
    fontFamily: Fonts.regular,
  },
});
