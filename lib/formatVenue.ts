/**
 * Cleans geocoded venue strings like "415/10, Františkánske námestie, Historické jadro"
 * into readable "Františkánske námestie 415/10"
 */
export function formatVenue(venue: string): string {
  const parts = venue.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) return parts[0];

  const isNumberPart = (s: string) => /^[\d/\s]+$/.test(s);
  const streetPart = parts.find(p => !isNumberPart(p)) ?? parts[0];
  const numberPart = parts.find(p => isNumberPart(p));

  if (numberPart) return `${streetPart} ${numberPart}`;
  // Multiple text parts — just return the street (first non-number, non-district)
  return streetPart;
}
