/**
 * Client-side chat moderation.
 * Checks for Slovak/Czech profanity, violence, weapons, and other sensitive content.
 * Uses substring matching so declensions are caught automatically.
 */

const BLOCKED_PATTERNS = [
  // Vulgarities (Slovak/Czech, root forms — catches declensions)
  'pič', 'pich', 'kurv', 'kurba', 'štetk', 'stetk', 'piča', 'pica',
  'hovno', 'hujd', 'huj', 'chuj', 'prde', 'prdel', 'kokot', 'kokos', // kokos ok but kokot not
  'debil', 'idiot', 'kretin', 'blbec', 'blbci', 'blbos',
  'skurven', 'jeben', 'jebat', 'jebnut', 'vyjeban', 'zajeban', 'pojeban',
  'pizdec', 'blyad', 'suka', 'suko',
  'zasran', 'posran', 'vykur', 'vykurovať',
  'mrdat', 'mrdac', 'mrdnut',
  'hajzel', 'šulin', 'šuli',
  'srač', 'sračk',

  // Violence / threats
  'zabijem', 'zabij', 'zabit', 'zabil', 'vrazdit', 'vraždit',
  'zaútočím', 'utočit', 'uderet', 'uderit', 'zbít', 'zbit',
  'vyhrážam', 'vyhrážk', 'vyhrazk', 'hrozba',
  'smrť', 'smrt', 'mrtv',
  'zbran', 'zbraň', 'zbrán',
  'nôž', 'noz', 'pištoľ', 'pistol', 'puška', 'puska', 'revolver',
  'granát', 'granat', 'bomba', 'výbušn', 'vybusn', 'výbuch',
  'strielat', 'strelba', 'zastrel', 'zastriel',
  'bodnut', 'bodnem', 'sečná',
  'terorizm', 'terorist', 'jihad',

  // Drugs
  'heroín', 'heroin', 'kokaín', 'kokain', 'metamfet', 'pervitín', 'pervitin',
  'dealovať', 'dealer', 'predám drogy', 'drogy predám',

  // Hate speech (base forms)
  'cigán', 'cigan', 'negr', 'žid', // slurring — root catches inflections
  'nacizm', 'nacist', 'fašizm', 'fašist', 'hitler', 'heil',
  'rasist',
];

// Normalise: lowercase, remove diacritics, collapse spaces
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsBlockedContent(message: string): boolean {
  const norm = normalise(message);
  return BLOCKED_PATTERNS.some(pattern => norm.includes(normalise(pattern)));
}
