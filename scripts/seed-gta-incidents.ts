/**
 * Seed script — 2,500 realistic safety incidents across Southern Ontario.
 *
 * Usage:
 *   npx tsx scripts/seed-gta-incidents.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Mongoose Post model (inline to avoid tsx import resolution issues)
// ---------------------------------------------------------------------------
const PostSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    raw_text: { type: String, required: true },
    categories: { type: [String], default: [] },
    severity_index: { type: Number, default: null },
    severity: { type: String, default: null },
    location_text: { type: String, default: null },
    is_anonymous: { type: Boolean, default: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
PostSchema.index({ location: '2dsphere' }, { sparse: true });
const PostModel = mongoose.models.Post || mongoose.model('Post', PostSchema);

// ═══════════════════════════════════════════════════════════════════════════
//  PIECEWISE COASTLINE GUARD
// ═══════════════════════════════════════════════════════════════════════════
// Anchor points tracing the Lake Ontario north shore, sorted west → east
const SHORE_ANCHORS: [number, number][] = [
  [-79.87, 43.25], // Hamilton harbour
  [-79.80, 43.32], // Burlington
  [-79.67, 43.43], // Oakville
  [-79.58, 43.53], // Mississauga / Port Credit
  [-79.38, 43.63], // Downtown Toronto
  [-79.15, 43.75], // Scarborough
];

function shoreMinLat(lng: number): number {
  if (lng <= SHORE_ANCHORS[0][0]) return SHORE_ANCHORS[0][1];
  if (lng >= SHORE_ANCHORS[SHORE_ANCHORS.length - 1][0]) {
    return SHORE_ANCHORS[SHORE_ANCHORS.length - 1][1];
  }
  for (let i = 0; i < SHORE_ANCHORS.length - 1; i++) {
    const [x0, y0] = SHORE_ANCHORS[i];
    const [x1, y1] = SHORE_ANCHORS[i + 1];
    if (lng >= x0 && lng <= x1) {
      const t = (lng - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 43.25;
}

function isValidLand(lat: number, lng: number): boolean {
  if (lat < 42.6) return false;  // Lake Erie floor
  if (lat > 44.5) return false;  // too far north
  // Lake Ontario zone: enforce piecewise shore + 500 m buffer
  if (lng >= -79.90 && lng <= -78.80) {
    if (lat < shoreMinLat(lng) + 0.005) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MICRO-HUBS — grouped by city
// ═══════════════════════════════════════════════════════════════════════════
interface Hub {
  name: string;
  center: [number, number]; // [lng, lat]
  sigmaLng: number;
  sigmaLat: number;
  locationTexts: string[];
}

// --- Toronto / Scarborough / North York  (40 %, 1000 pts) ----------------
const TORONTO_HUBS: Hub[] = [
  { name: 'Yonge-Dundas',
    center: [-79.3806, 43.6561], sigmaLng: 0.007, sigmaLat: 0.005,
    locationTexts: ['Yonge-Dundas Square', 'Eaton Centre', 'Dundas & Bay'] },
  { name: 'Union / Financial District',
    center: [-79.3815, 43.6530], sigmaLng: 0.008, sigmaLat: 0.003,
    locationTexts: ['Union Station', 'King & Bay', 'PATH concourse', 'Front & York'] },
  { name: 'Queen West / Kensington',
    center: [-79.4020, 43.6500], sigmaLng: 0.009, sigmaLat: 0.005,
    locationTexts: ['Queen & Spadina', 'Kensington Market', 'Ossington Strip', 'Trinity Bellwoods'] },
  { name: 'Church-Wellesley / Ryerson',
    center: [-79.3790, 43.6630], sigmaLng: 0.006, sigmaLat: 0.006,
    locationTexts: ['Church & Wellesley', 'Ryerson campus', 'Allan Gardens', 'Dundas & Jarvis'] },
  { name: 'Liberty Village / King West',
    center: [-79.4210, 43.6510], sigmaLng: 0.008, sigmaLat: 0.003,
    locationTexts: ['Liberty Village', 'King & Dufferin', 'Exhibition Place'] },
  { name: 'St. Lawrence / Distillery',
    center: [-79.3640, 43.6590], sigmaLng: 0.007, sigmaLat: 0.003,
    locationTexts: ['St. Lawrence Market', 'Distillery District', 'The Esplanade'] },
  { name: 'Yonge & Eglinton',
    center: [-79.3985, 43.7065], sigmaLng: 0.005, sigmaLat: 0.004,
    locationTexts: ['Yonge & Eglinton', 'Eglinton Station', 'Mt. Pleasant & Eglinton'] },
  { name: 'Yonge & Sheppard',
    center: [-79.4108, 43.7615], sigmaLng: 0.006, sigmaLat: 0.005,
    locationTexts: ['North York Centre', 'Sheppard & Yonge', 'Mel Lastman Square'] },
  { name: 'Yonge & Finch',
    center: [-79.4150, 43.7810], sigmaLng: 0.005, sigmaLat: 0.004,
    locationTexts: ['Yonge & Finch', 'Finch Station', 'Drewry & Yonge'] },
  { name: 'Scarborough Town Centre',
    center: [-79.2578, 43.7750], sigmaLng: 0.008, sigmaLat: 0.006,
    locationTexts: ['Scarborough Town Centre', 'McCowan & Ellesmere', 'STC Transit Hub'] },
  { name: 'The Danforth / East York',
    center: [-79.3280, 43.6860], sigmaLng: 0.009, sigmaLat: 0.004,
    locationTexts: ['Broadview Station', 'Pape & Danforth', 'Main Street Station', 'Woodbine & Danforth'] },
  { name: 'York University',
    center: [-79.5019, 43.7735], sigmaLng: 0.004, sigmaLat: 0.003,
    locationTexts: ['York U campus', 'Keele & Steeles', 'Pioneer Village Station'] },
];

// --- Mississauga incl. UTM  (12 %, 300 pts) ------------------------------
const MISSISSAUGA_HUBS: Hub[] = [
  { name: 'Square One / City Centre',
    center: [-79.6441, 43.5930], sigmaLng: 0.007, sigmaLat: 0.005,
    locationTexts: ['Square One Mall', 'Mississauga City Centre', 'Celebration Square', 'Living Arts Centre'] },
  { name: 'UTM Campus',
    center: [-79.6625, 43.5510], sigmaLng: 0.004, sigmaLat: 0.003,
    locationTexts: ['UTM Campus', 'Mississauga Rd & Dundas', 'Erindale Park', 'UTM Bus Loop'] },
  { name: 'Port Credit',
    center: [-79.5830, 43.5510], sigmaLng: 0.004, sigmaLat: 0.003,
    locationTexts: ['Port Credit GO Station', 'Lakeshore & Hurontario', 'Port Credit Marina'] },
];

// --- Brampton  (10 %, 250 pts) -------------------------------------------
const BRAMPTON_HUBS: Hub[] = [
  { name: 'Bramalea',
    center: [-79.7100, 43.7080], sigmaLng: 0.007, sigmaLat: 0.006,
    locationTexts: ['Bramalea City Centre', 'Bramalea GO Station', 'Clark & Steeles'] },
  { name: 'Downtown Brampton',
    center: [-79.7624, 43.6850], sigmaLng: 0.006, sigmaLat: 0.005,
    locationTexts: ['Queen & Main Brampton', 'Brampton GO Station', 'Garden Square', 'Gage Park'] },
];

// --- Hamilton incl. McMaster  (10 %, 250 pts) ----------------------------
const HAMILTON_HUBS: Hub[] = [
  { name: 'Downtown Hamilton',
    center: [-79.8710, 43.2570], sigmaLng: 0.006, sigmaLat: 0.005,
    locationTexts: ['James St N', 'Hamilton GO Centre', 'Jackson Square', 'King & James'] },
  { name: 'McMaster University',
    center: [-79.9190, 43.2610], sigmaLng: 0.004, sigmaLat: 0.003,
    locationTexts: ['McMaster campus', 'Main & Longwood', 'Westdale Village'] },
  { name: 'Hamilton Mountain',
    center: [-79.8650, 43.2350], sigmaLng: 0.008, sigmaLat: 0.006,
    locationTexts: ['Limeridge Mall', 'Upper James & Mohawk', 'Mohawk College'] },
];

// --- Kitchener-Waterloo  (8 %, 200 pts) ----------------------------------
const KW_HUBS: Hub[] = [
  { name: 'UWaterloo / Laurier',
    center: [-80.5275, 43.4723], sigmaLng: 0.005, sigmaLat: 0.004,
    locationTexts: ['UWaterloo campus', 'Laurier campus', 'University Ave & King'] },
  { name: 'Uptown Waterloo',
    center: [-80.5210, 43.4640], sigmaLng: 0.004, sigmaLat: 0.003,
    locationTexts: ['Waterloo Town Square', 'King & Erb', 'Uptown Waterloo'] },
  { name: 'Downtown Kitchener',
    center: [-80.4930, 43.4510], sigmaLng: 0.006, sigmaLat: 0.005,
    locationTexts: ['Kitchener Market', 'Victoria Park', 'Charles St Transit Hub', 'ION LRT stop'] },
];

// --- London incl. Western  (5 %, 125 pts) --------------------------------
const LONDON_HUBS: Hub[] = [
  { name: 'Western University',
    center: [-81.2740, 43.0096], sigmaLng: 0.004, sigmaLat: 0.003,
    locationTexts: ['Western campus', 'Richmond & Oxford', 'Masonville Place'] },
  { name: 'Downtown London',
    center: [-81.2530, 42.9830], sigmaLng: 0.006, sigmaLat: 0.005,
    locationTexts: ['Dundas & Richmond', 'Victoria Park London', 'London Transit Terminal', 'Fanshawe College downtown'] },
];

// ═══════════════════════════════════════════════════════════════════════════
//  HIGHWAY CORRIDORS — for 15 % commuter-noise (375 points)
// ═══════════════════════════════════════════════════════════════════════════
interface Corridor {
  name: string;
  waypoints: [number, number][]; // [lng, lat] in order
  locationTexts: string[];
}

const CORRIDORS: Corridor[] = [
  {
    name: 'Hwy 401 (London → Toronto)',
    waypoints: [
      [-81.25, 42.98], // London
      [-80.95, 43.12], // Woodstock
      [-80.49, 43.42], // Kitchener
      [-80.25, 43.52], // Guelph
      [-79.87, 43.68], // Milton / 401-407 junction
      [-79.65, 43.70], // Mississauga 401
      [-79.50, 43.72], // Etobicoke 401
      [-79.38, 43.72], // North York 401
      [-79.28, 43.74], // Scarborough 401
    ],
    locationTexts: [
      'a 401 rest stop', 'a highway on-ramp', 'an ONroute plaza',
      'a gas station off the 401', 'a truck stop', 'a commuter parking lot',
    ],
  },
  {
    name: 'Hwy 403 (KW → Hamilton)',
    waypoints: [
      [-80.46, 43.40], // Kitchener south
      [-80.32, 43.38], // Cambridge / Hespeler
      [-80.20, 43.35], // Brantford area
      [-79.98, 43.28], // Ancaster
      [-79.88, 43.26], // Hamilton west end
    ],
    locationTexts: [
      'a 403 rest area', 'a highway shoulder', 'a commuter parking lot',
      'a gas station off the 403', 'a Tim Hortons near the highway',
    ],
  },
  {
    name: 'QEW (Hamilton → Toronto)',
    waypoints: [
      [-79.85, 43.32], // Burlington QEW
      [-79.75, 43.38], // Oakville QEW
      [-79.63, 43.48], // Mississauga QEW
      [-79.52, 43.58], // Etobicoke / Lakeshore
      [-79.42, 43.63], // Gardiner / Toronto
    ],
    locationTexts: [
      'a QEW service centre', 'a commuter GO lot', 'a highway on-ramp',
      'a gas station near the QEW', 'a rest stop',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  CATEGORIES + TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════
interface CategoryProfile {
  category: string;
  baseSeverity: [number, number];
  templates: string[];
}

const CATEGORIES: CategoryProfile[] = [
  {
    category: 'Catcalling',
    baseSeverity: [2, 4],
    templates: [
      'A group of men yelled crude comments at me as I walked past {location}.',
      'Someone shouted sexually explicit remarks from a car near {location}.',
      'While waiting at the bus stop near {location}, a man made kissing noises and catcalled me.',
      'Got whistled at and called "sweetheart" by strangers hanging out near {location}.',
      'A guy on a bike slowed down and yelled something vulgar at me near {location}.',
      'Walking to work past {location} and two men made explicit comments about my body.',
      'Someone leaned out of a truck window and shouted at me near {location}.',
      'Was catcalled by a group sitting on a bench at {location} while I was jogging.',
      'A man walking behind me near {location} kept making comments about my appearance.',
      'Got honked at and catcalled near {location} — felt unsafe walking alone.',
    ],
  },
  {
    category: 'Stalking',
    baseSeverity: [6, 8],
    templates: [
      'A man followed me for several blocks after I left {location}. He crossed the street when I did.',
      'Someone has been waiting outside {location} every day this week when I leave work.',
      'I noticed the same person following me on three separate occasions near {location}.',
      'A stranger followed me off the subway near {location} and tried to talk to me repeatedly.',
      'Was followed from {location} to my car — the person matched my pace the entire time.',
      'After leaving {location}, I noticed a man following me. He only stopped when I entered a store.',
      'Someone keeps showing up at {location} whenever I\'m there. I think they\'re tracking my schedule.',
      'A person on a bicycle followed me for 10 minutes around {location} after dark.',
      'Noticed the same car slowly trailing me as I walked home from {location}.',
      'A stranger followed me into the parking garage near {location}. I had to ask security for help.',
    ],
  },
  {
    category: 'Ogling',
    baseSeverity: [1, 3],
    templates: [
      'A man was staring at me intensely on the platform at {location}. Very uncomfortable.',
      'Someone at {location} kept looking me up and down for several minutes.',
      'While sitting at a café near {location}, a man at the next table was openly staring at me.',
      'A guy on the bus near {location} kept turning around to look at me the entire ride.',
      'Felt very uncomfortable — a group of men near {location} were openly staring and whispering.',
      'Someone standing near {location} was watching me through the store window for a long time.',
      'At {location}, a man kept making prolonged eye contact even after I looked away multiple times.',
      'Was eating lunch near {location} and noticed someone photographing me from across the food court.',
      'While studying at {location}, someone sat across from me and just stared without saying anything.',
      'A man near {location} was very obviously looking me up and down as I walked past.',
    ],
  },
  {
    category: 'Verbal Harassment',
    baseSeverity: [3, 6],
    templates: [
      'A stranger at {location} got aggressive when I ignored his advances and started swearing at me.',
      'Someone near {location} made threatening comments when I refused to give them my number.',
      'Was verbally harassed by a man near {location} who made derogatory comments about my ethnicity.',
      'While walking near {location}, a man blocked my path and made intimidating remarks.',
      'A person at {location} screamed insults at me after I said I wasn\'t interested in talking.',
      'Got verbally harassed near {location} — the person called me slurs when I didn\'t respond.',
      'A man near {location} said deeply inappropriate things and got angry when I tried to walk away.',
      'Someone on the train near {location} started harassing me about what I was wearing.',
      'Near {location}, a stranger grabbed my attention and then made sexually degrading comments.',
      'Was threatened near {location} after refusing to engage with a stranger who approached me.',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function gauss(mean: number, sigma: number): number {
  const u1 = Math.random() || 1e-4;
  const u2 = Math.random();
  return mean + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randomDate(days: number): Date {
  return new Date(Date.now() - Math.random() * days * 86_400_000);
}

function isNight(d: Date): boolean {
  const h = d.getHours();
  return h >= 21 || h < 6;
}

function severity(base: [number, number], ts: Date): number {
  let s = Math.round(rand(base[0], base[1]));
  if (isNight(ts)) s += Math.random() < 0.5 ? 2 : 1;
  return Math.min(s, 10);
}

/** Re-roll until the point is on valid land */
function landCoords(genLng: () => number, genLat: () => number): [number, number] {
  for (let i = 0; i < 500; i++) {
    const lng = genLng();
    const lat = genLat();
    if (isValidLand(lat, lng)) return [lng, lat];
  }
  return [-79.38, 43.70]; // safe fallback
}

/** Interpolate along a polyline and add perpendicular Gaussian jitter */
function corridorPoint(waypoints: [number, number][], sigma: number): [number, number] {
  const seg = Math.floor(Math.random() * (waypoints.length - 1));
  const t = Math.random();
  const [x0, y0] = waypoints[seg];
  const [x1, y1] = waypoints[seg + 1];
  return [gauss(x0 + t * (x1 - x0), sigma), gauss(y0 + t * (y1 - y0), sigma)];
}

function makeDoc(
  text: string, cat: string, sev: number,
  lng: number, lat: number,
  locText: string, area: string,
  ts: Date,
): Record<string, unknown> {
  return {
    raw_text: text,
    categories: [cat],
    severity_index: sev,
    location: { type: 'Point', coordinates: [lng, lat] },
    location_text: `${locText}, ${area}`,
    is_anonymous: true,
    created_at: ts,
    user_id: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  GENERATION — 2,500 total
// ═══════════════════════════════════════════════════════════════════════════
interface CityPool { hubs: Hub[]; count: number }

const CITY_POOLS: CityPool[] = [
  { hubs: TORONTO_HUBS,     count: 1000 },
  { hubs: MISSISSAUGA_HUBS, count: 300  },
  { hubs: BRAMPTON_HUBS,    count: 250  },
  { hubs: HAMILTON_HUBS,    count: 250  },
  { hubs: KW_HUBS,          count: 200  },
  { hubs: LONDON_HUBS,      count: 125  },
];
const CORRIDOR_COUNT = 375; // 15 %

function generate(): Record<string, unknown>[] {
  const docs: Record<string, unknown>[] = [];

  // --- City hub pools (85 %) ---
  for (const pool of CITY_POOLS) {
    for (let i = 0; i < pool.count; i++) {
      const hub = pick(pool.hubs);
      const cat = pick(CATEGORIES);
      const ts = randomDate(7);
      const [lng, lat] = landCoords(
        () => gauss(hub.center[0], hub.sigmaLng),
        () => gauss(hub.center[1], hub.sigmaLat),
      );
      const text = pick(cat.templates).replace('{location}', pick(hub.locationTexts));
      docs.push(makeDoc(text, cat.category, severity(cat.baseSeverity, ts), lng, lat, pick(hub.locationTexts), hub.name, ts));
    }
  }

  // --- Highway corridor noise (15 %) ---
  for (let i = 0; i < CORRIDOR_COUNT; i++) {
    const corridor = pick(CORRIDORS);
    const cat = pick(CATEGORIES);
    const ts = randomDate(7);
    const [lng, lat] = landCoords(
      () => corridorPoint(corridor.waypoints, 0.02)[0],
      () => corridorPoint(corridor.waypoints, 0.02)[1],
    );
    const locText = pick(corridor.locationTexts);
    const text = pick(cat.templates).replace('{location}', locText);
    docs.push(makeDoc(text, cat.category, severity(cat.baseSeverity, ts), lng, lat, locText, corridor.name, ts));
  }

  return docs;
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set.'); process.exit(1); }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);

  console.log('Clearing posts collection...');
  const del = await PostModel.deleteMany({});
  console.log(`  Deleted ${del.deletedCount} documents.`);

  const docs = generate();
  console.log(`Inserting ${docs.length} incidents...`);

  const BATCH = 500;
  for (let i = 0; i < docs.length; i += BATCH) {
    await PostModel.insertMany(docs.slice(i, i + BATCH), { ordered: false });
    console.log(`  ${Math.min(i + BATCH, docs.length)} / ${docs.length}`);
  }

  // --- Stats ---
  const byCat: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  let nightN = 0;
  for (const d of docs) {
    const c = (d.categories as string[])[0];
    byCat[c] = (byCat[c] || 0) + 1;
    const a = (d.location_text as string).split(', ').pop() ?? '?';
    byArea[a] = (byArea[a] || 0) + 1;
    if (isNight(d.created_at as Date)) nightN++;
  }

  console.log(`\nDone! ${docs.length} Southern Ontario incidents seeded.`);
  console.log(`Nighttime (severity-boosted): ${nightN}\n`);
  console.log('By category:');
  for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${c}: ${n}`);
  console.log('\nBy area (top 20):');
  for (const [a, n] of Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${a}: ${n}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
