/**
 * Places Hera should treat as in-coverage (Southern/Southwestern Ontario),
 * including towns near seeded incident corridors even if they aren't hub labels.
 */
export interface CoveragePlace {
  name: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  /** Suggested search radius so nearby corridor/hub reports are included */
  radiusKm: number;
}

export const COVERAGE_PLACES: CoveragePlace[] = [
  // --- GTA / Toronto ---
  { name: 'Toronto', aliases: ['downtown toronto', 'dt toronto', 'the 6'], latitude: 43.6532, longitude: -79.3832, radiusKm: 12 },
  { name: 'North York', aliases: ['north york centre'], latitude: 43.7615, longitude: -79.4111, radiusKm: 8 },
  { name: 'Scarborough', aliases: ['scarborough town centre', 'stc'], latitude: 43.7731, longitude: -79.2578, radiusKm: 8 },
  { name: 'Etobicoke', aliases: [], latitude: 43.654, longitude: -79.567, radiusKm: 8 },
  { name: 'East York', aliases: ['the danforth', 'danforth'], latitude: 43.686, longitude: -79.328, radiusKm: 6 },
  { name: 'York University', aliases: ['york u'], latitude: 43.7735, longitude: -79.5019, radiusKm: 5 },

  // --- Peel / Halton ---
  { name: 'Mississauga', aliases: ['square one', 'city centre mississauga'], latitude: 43.589, longitude: -79.6441, radiusKm: 10 },
  { name: 'Port Credit', aliases: [], latitude: 43.551, longitude: -79.583, radiusKm: 5 },
  { name: 'UTM', aliases: ['utm campus', 'university of toronto mississauga'], latitude: 43.548, longitude: -79.6625, radiusKm: 5 },
  { name: 'Brampton', aliases: ['bramalea', 'downtown brampton'], latitude: 43.7315, longitude: -79.7624, radiusKm: 10 },
  { name: 'Oakville', aliases: [], latitude: 43.45, longitude: -79.67, radiusKm: 8 },
  { name: 'Burlington', aliases: ['appleby'], latitude: 43.325, longitude: -79.799, radiusKm: 8 },
  { name: 'Milton', aliases: [], latitude: 43.5183, longitude: -79.8774, radiusKm: 12 },
  { name: 'Georgetown', aliases: [], latitude: 43.6502, longitude: -79.9036, radiusKm: 15 },

  // --- Hamilton / Niagara ---
  { name: 'Hamilton', aliases: ['downtown hamilton', 'hamilton mountain'], latitude: 43.2557, longitude: -79.8711, radiusKm: 10 },
  { name: 'McMaster', aliases: ['mcmaster university', 'westdale'], latitude: 43.261, longitude: -79.919, radiusKm: 5 },
  { name: 'St. Catharines', aliases: ['st catharines', 'saint catharines'], latitude: 43.1594, longitude: -79.2469, radiusKm: 12 },
  { name: 'Niagara Falls', aliases: ['niagara', 'clifton hill'], latitude: 43.0896, longitude: -79.0849, radiusKm: 12 },
  { name: 'Niagara-on-the-Lake', aliases: ['notl'], latitude: 43.2557, longitude: -79.0719, radiusKm: 15 },
  { name: 'Welland', aliases: [], latitude: 42.9922, longitude: -79.2485, radiusKm: 18 },
  { name: 'Grimsby', aliases: [], latitude: 43.195, longitude: -79.571, radiusKm: 15 },
  { name: 'Ancaster', aliases: [], latitude: 43.217, longitude: -79.987, radiusKm: 10 },
  { name: 'Dundas', aliases: ['dundas ontario'], latitude: 43.266, longitude: -79.954, radiusKm: 10 },
  { name: 'Stoney Creek', aliases: [], latitude: 43.217, longitude: -79.766, radiusKm: 10 },

  // --- Waterloo region + nearby towns (Fergus, etc.) ---
  { name: 'Kitchener', aliases: ['downtown kitchener'], latitude: 43.4516, longitude: -80.4925, radiusKm: 10 },
  { name: 'Waterloo', aliases: ['uptown waterloo', 'uwaterloo', 'laurier'], latitude: 43.4643, longitude: -80.5204, radiusKm: 8 },
  { name: 'Cambridge', aliases: ['hespler', 'hespeler', 'galt'], latitude: 43.3616, longitude: -80.3144, radiusKm: 12 },
  { name: 'Guelph', aliases: ['university of guelph', 'u of g'], latitude: 43.5448, longitude: -80.2482, radiusKm: 10 },
  { name: 'Fergus', aliases: ['fergus ontario', 'centre wellington'], latitude: 43.703, longitude: -80.377, radiusKm: 20 },
  { name: 'Elora', aliases: [], latitude: 43.685, longitude: -80.43, radiusKm: 20 },
  { name: 'Orangeville', aliases: [], latitude: 43.92, longitude: -80.094, radiusKm: 25 },
  { name: 'Acton', aliases: [], latitude: 43.633, longitude: -80.033, radiusKm: 18 },
  { name: 'Rockwood', aliases: [], latitude: 43.62, longitude: -80.14, radiusKm: 15 },

  // --- London / southwest ---
  { name: 'London', aliases: ['london ontario', 'london on', 'western university', 'fanshawe'], latitude: 42.9849, longitude: -81.2453, radiusKm: 12 },
  { name: 'St. Thomas', aliases: ['st thomas'], latitude: 42.777, longitude: -81.193, radiusKm: 20 },
  { name: 'Woodstock', aliases: [], latitude: 43.131, longitude: -80.747, radiusKm: 20 },
  { name: 'Ingersoll', aliases: [], latitude: 43.039, longitude: -80.882, radiusKm: 20 },
  { name: 'Stratford', aliases: [], latitude: 43.37, longitude: -80.982, radiusKm: 25 },
  { name: 'Listowel', aliases: [], latitude: 43.731, longitude: -80.953, radiusKm: 25 },
  { name: 'Brantford', aliases: [], latitude: 43.139, longitude: -80.264, radiusKm: 15 },
  { name: 'Paris', aliases: ['paris ontario'], latitude: 43.193, longitude: -80.384, radiusKm: 18 },
  { name: 'Simcoe', aliases: ['simcoe ontario'], latitude: 42.837, longitude: -80.304, radiusKm: 25 },
  { name: 'Tillsonburg', aliases: [], latitude: 42.861, longitude: -80.733, radiusKm: 25 },
  { name: 'Chatham', aliases: ['chatham-kent', 'chatham kent'], latitude: 42.405, longitude: -82.182, radiusKm: 30 },
  { name: 'Sarnia', aliases: [], latitude: 42.974, longitude: -82.407, radiusKm: 35 },
  { name: 'Windsor', aliases: ['downtown windsor', 'uwindsor'], latitude: 42.3149, longitude: -83.0364, radiusKm: 10 },
  { name: 'Leamington', aliases: [], latitude: 42.053, longitude: -82.6, radiusKm: 30 },

  // --- Durham / east ---
  { name: 'Oshawa', aliases: ['downtown oshawa', 'ontario tech', 'durham college'], latitude: 43.8971, longitude: -78.8658, radiusKm: 10 },
  { name: 'Whitby', aliases: [], latitude: 43.8975, longitude: -78.9428, radiusKm: 8 },
  { name: 'Ajax', aliases: [], latitude: 43.8509, longitude: -79.0204, radiusKm: 8 },
  { name: 'Pickering', aliases: [], latitude: 43.8384, longitude: -79.0868, radiusKm: 10 },
  { name: 'Bowmanville', aliases: ['clarington'], latitude: 43.9126, longitude: -78.688, radiusKm: 15 },
  { name: 'Port Perry', aliases: [], latitude: 44.105, longitude: -78.943, radiusKm: 25 },

  // --- Simcoe / north edge ---
  { name: 'Barrie', aliases: ['downtown barrie', 'georgian college'], latitude: 44.3894, longitude: -79.6903, radiusKm: 10 },
  { name: 'Orillia', aliases: [], latitude: 44.6082, longitude: -79.4207, radiusKm: 25 },
  { name: 'Bradford', aliases: ['bradford west gwillimbury'], latitude: 44.114, longitude: -79.56, radiusKm: 15 },
  { name: 'Newmarket', aliases: [], latitude: 44.0592, longitude: -79.4613, radiusKm: 15 },
  { name: 'Aurora', aliases: [], latitude: 44.0065, longitude: -79.4504, radiusKm: 15 },
  { name: 'Richmond Hill', aliases: [], latitude: 43.8828, longitude: -79.4403, radiusKm: 12 },
  { name: 'Markham', aliases: [], latitude: 43.8561, longitude: -79.337, radiusKm: 12 },
  { name: 'Vaughan', aliases: ['maple', 'woodbridge'], latitude: 43.8361, longitude: -79.4985, radiusKm: 12 },
];

function normalizePlaceQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findCoveragePlace(query: string): CoveragePlace | null {
  const q = normalizePlaceQuery(query);
  if (!q) return null;

  // Prefer longer / more specific alias matches
  let best: { place: CoveragePlace; score: number } | null = null;

  for (const place of COVERAGE_PLACES) {
    const candidates = [place.name, ...place.aliases].map(normalizePlaceQuery);
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (q === candidate || q.includes(candidate) || candidate.includes(q)) {
        const score = candidate.length + (q === candidate ? 100 : 0);
        if (!best || score > best.score) {
          best = { place, score };
        }
      }
    }
  }

  return best?.place ?? null;
}

export function coverageAllowlistSummary(): string {
  return COVERAGE_PLACES.map((place) => place.name).join(', ');
}

export function coverageCoordinateHints(): string {
  return COVERAGE_PLACES.map(
    (place) =>
      `${place.name}: latitude ${place.latitude}, longitude ${place.longitude} (search ~${place.radiusKm}km)`
  ).join('\n  ');
}
