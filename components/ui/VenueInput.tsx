import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useTranslations } from '@/context/LanguageContext';

const GOOGLE_API_KEY = 'AIzaSyDhtj5z-Us7Ic01tHuaJxC_mLTZPG3moj0';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
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
  const { lang } = useTranslations();
  const [results, setResults] = useState<VenueResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(query: string) {
    onChange(query);
    setConfirmed(false);
    setResults([]);
    if (query.length < 3) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const acUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=sk&components=country:sk&types=geocode`;
        const acRes = await fetch(acUrl);
        const acData = await acRes.json();
        const predictions: PlacePrediction[] = acData.predictions ?? [];

        const details = await Promise.all(predictions.slice(0, 6).map(async (p) => {
          const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry,address_components&key=${GOOGLE_API_KEY}`;
          const detRes = await fetch(detUrl);
          const detData = await detRes.json();
          const loc = detData.result?.geometry?.location;
          const comps: any[] = detData.result?.address_components ?? [];
          const city = comps.find((c: any) => c.types.includes('locality'))?.long_name
            ?? comps.find((c: any) => c.types.includes('administrative_area_level_2'))?.long_name
            ?? '';
          return loc ? {
            name: p.description,
            city,
            lat: loc.lat,
            lng: loc.lng,
          } : null;
        }));

        setResults(details.filter(Boolean) as VenueResult[]);
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
  }

  const th = dark ? darkTheme : lightTheme;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: th.label }]}>{lang === 'sk' ? 'Miesto' : 'Address'}</Text>
      <View style={styles.inputContainer}>
        <View style={[styles.inputWrap, { borderColor: th.border, backgroundColor: th.bg }, focused && { borderColor: th.focusBorder }, confirmed && styles.inputConfirmed]}>
          <TextInput
            style={[styles.input, { color: th.text }]}
            value={value}
            onChangeText={search}
            placeholder={lang === 'sk' ? 'Začni písať adresu...' : 'Start typing an address...'}
            placeholderTextColor={th.placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            selectionColor={Colors.lime}
            maxLength={200}
          />
          {loading && <ActivityIndicator size="small" color={Colors.gray} style={styles.spinner} />}
          {confirmed && !loading && <Text style={styles.confirmedIcon}>✓</Text>}
        </View>
        {results.length > 0 && (
          <View style={[styles.dropdown, { backgroundColor: th.bg, borderColor: th.border }]}>
            <ScrollView keyboardShouldPersistTaps="always" nestedScrollEnabled>
              {results.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.item, i < results.length - 1 && styles.itemBorder]}
                  onPress={() => select(r)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemName, { color: th.text }]} numberOfLines={1}>{r.name}</Text>
                  {r.city ? <Text style={styles.itemCity}>{r.city}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      {value.length > 0 && !confirmed && !loading && results.length === 0 && (
        <Text style={styles.hint}>{lang === 'sk' ? '↑ Vyber zo zoznamu pre pin na mape' : '↑ Select from the list to pin on map'}</Text>
      )}
      {confirmed && (
        <Text style={styles.confirmedHint}>{lang === 'sk' ? '📍 Miesto potvrdené — zobrazí sa na mape' : '📍 Location confirmed — will appear on map'}</Text>
      )}
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
  wrapper: { zIndex: 999 },
  inputContainer: { position: 'relative', zIndex: 999 },
  dropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
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
