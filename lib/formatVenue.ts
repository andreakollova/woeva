/**
 * Returns the display name for a club.
 * "Woeva Picks KE", "Woeva Picks BA", etc. → "Woeva Picks"
 */
export function clubDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  if (name.toLowerCase().startsWith('woeva picks')) return 'Woeva Picks';
  return name;
}

/**
 * Cleans geocoded venue strings like "5944/7A, Rybničná, Bratislava"
 * into readable "Rybničná 5944/7A"
 * Handles Slovak address numbers: 5944/7A, 10/A, 123B etc. (start with a digit)
 */
export function formatVenue(venue: string | null | undefined): string {
  if (!venue) return '';
  const parts = venue.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) return parts[0];

  // A "number part" is anything starting with a digit (covers 5944/7A, 123B, 10/A)
  const isNumberPart = (s: string) => /^\d/.test(s);
  const streetPart = parts.find(p => !isNumberPart(p)) ?? parts[0];
  const numberPart = parts.find(p => isNumberPart(p));

  if (numberPart) return `${streetPart} ${numberPart}`;
  return streetPart;
}
