import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Keyboard,
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
}

export function VenueInput({ value, onChange }: VenueInputProps) {
  const [results, setResults] = useState<VenueResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getLabel(r: NominatimResult): string {
    const parts = r.display_name.split(', ');
    return parts.slice(0, 3).join(', ');
  }

  function getCity(r: NominatimResult): string {
    return r.address.city ?? r.address.town ?? r.address.village ?? '';
  }

  async function search(query: string) {
    onChange(query);
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
    setResults([]);
    Keyboard.dismiss();
  }

  return (
    <View>
      <Text style={styles.label}>Venue</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={search}
          placeholder="Start typing an address..."
          placeholderTextColor={Colors.gray}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); }}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={Colors.gray} style={styles.spinner} />}
      </View>

      {results.length > 0 && (
        <View style={styles.dropdown}>
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
      )}
    </View>
  );
}

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
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.black,
    fontFamily: Fonts.regular,
  },
  spinner: {
    marginLeft: 8,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: Colors.grayBorder,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    maxHeight: 260,
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
