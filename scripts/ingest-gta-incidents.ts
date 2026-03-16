/**
 * One-time ingestion script for GTA police / open-data incident JSON/GeoJSON.
 *
 * Usage:
 *   npx tsx scripts/ingest-gta-incidents.ts <path-to-dataset.json>
 *
 * The dataset can be:
 *   - A GeoJSON FeatureCollection (features[].geometry.coordinates, features[].properties.*)
 *   - A plain JSON array of objects with lat/long + offence fields
 *
 * Environment:
 *   MONGODB_URI must be set (reads from .env.local automatically via dotenv).
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// GTA bounding box (roughly Hamilton to Oshawa, Lake Ontario to Barrie)
// ---------------------------------------------------------------------------
const GTA_BOUNDS = {
  minLat: 43.2,
  maxLat: 44.3,
  minLng: -80.3,
  maxLng: -78.6,
};

function inGTA(lat: number, lng: number): boolean {
  return (
    lat >= GTA_BOUNDS.minLat &&
    lat <= GTA_BOUNDS.maxLat &&
    lng >= GTA_BOUNDS.minLng &&
    lng <= GTA_BOUNDS.maxLng
  );
}

// ---------------------------------------------------------------------------
// Category mapping: police offence strings → Hera categories
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, string[]> = {
  assault: ['Groping', 'Verbal Harassment'],
  'sexual assault': ['Groping', 'Stalking'],
  harassment: ['Verbal Harassment'],
  'uttering threats': ['Verbal Harassment', 'Stalking'],
  'indecent exposure': ['Ogling'],
  voyeurism: ['Ogling', 'Stalking'],
  'criminal harassment': ['Stalking', 'Verbal Harassment'],
  stalking: ['Stalking'],
  robbery: ['Verbal Harassment'],
  'theft from person': ['Verbal Harassment'],
  'mischief under': ['Catcalling'],
  mischief: ['Catcalling'],
};

function mapCategories(offence: string): string[] {
  const lower = offence.toLowerCase().trim();

  for (const [key, cats] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return cats;
  }

  return ['Verbal Harassment'];
}

// ---------------------------------------------------------------------------
// Severity mapping by offence type
// ---------------------------------------------------------------------------
const SEVERITY_MAP: Record<string, number> = {
  'sexual assault': 9,
  assault: 7,
  'criminal harassment': 7,
  stalking: 7,
  'uttering threats': 6,
  robbery: 6,
  'indecent exposure': 5,
  voyeurism: 5,
  harassment: 4,
  'theft from person': 4,
  mischief: 3,
};

function mapSeverity(offence: string): number {
  const lower = offence.toLowerCase().trim();
  for (const [key, sev] of Object.entries(SEVERITY_MAP)) {
    if (lower.includes(key)) return sev;
  }
  return 4;
}

// ---------------------------------------------------------------------------
// Parse various dataset shapes
// ---------------------------------------------------------------------------
interface RawRecord {
  text: string;
  lat: number;
  lng: number;
  offence: string;
  date?: string;
}

function parseDataset(raw: unknown): RawRecord[] {
  const records: RawRecord[] = [];

  if (isFeatureCollection(raw)) {
    for (const feature of raw.features) {
      const coords = feature.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;

      const [lng, lat] = coords;
      const props = feature.properties ?? {};

      const offence =
        props.OFFENCE ??
        props.offence ??
        props.MCI_CATEGORY ??
        props.mci_category ??
        props.OFFENCE_DESC ??
        props.offence_desc ??
        props.ucr_ext ??
        props.PRIMARY_OFFENCE ??
        'Unknown';

      const text =
        props.EVENT_UNIQUE_ID ??
        props.event_unique_id ??
        props.DESCRIPTION ??
        props.description ??
        `${offence} incident reported`;

      const date =
        props.REPORT_DATE ??
        props.report_date ??
        props.OCC_DATE ??
        props.occ_date ??
        undefined;

      records.push({ text: String(text), lat, lng, offence: String(offence), date });
    }
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      const lat = Number(item.lat ?? item.latitude ?? item.LAT_WGS84 ?? item.Lat);
      const lng = Number(item.lng ?? item.longitude ?? item.LONG_WGS84 ?? item.Long);
      const offence = String(
        item.OFFENCE ?? item.offence ?? item.MCI_CATEGORY ?? item.mci_category ?? 'Unknown'
      );
      const text = String(item.DESCRIPTION ?? item.description ?? item.text ?? `${offence} incident`);
      const date = item.REPORT_DATE ?? item.report_date ?? item.OCC_DATE ?? undefined;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      records.push({ text, lat, lng, offence, date });
    }
  }

  return records;
}

function isFeatureCollection(
  data: unknown
): data is { type: string; features: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }> } {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'FeatureCollection' &&
    Array.isArray((data as Record<string, unknown>).features)
  );
}

// ---------------------------------------------------------------------------
// Mongoose Post schema (inline to avoid import resolution issues with tsx)
// ---------------------------------------------------------------------------
const PostSchema = new mongoose.Schema(
  {
    raw_text: { type: String, required: true },
    categories: { type: [String], default: [] },
    severity_index: { type: Number, default: null },
    severity: { type: String, default: null },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    location_text: { type: String, default: null },
    is_anonymous: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: false }
);
PostSchema.index({ location: '2dsphere' }, { sparse: true });
const PostModel = mongoose.models.Post || mongoose.model('Post', PostSchema);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/ingest-gta-incidents.ts <path-to-dataset.json>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set. Create a .env.local file.');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  console.log(`Reading dataset from ${absolutePath}...`);
  const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));

  const allRecords = parseDataset(raw);
  console.log(`Parsed ${allRecords.length} total records from dataset.`);

  const gtaRecords = allRecords.filter((r) => inGTA(r.lat, r.lng));
  console.log(`${gtaRecords.length} records within GTA bounding box.`);

  if (gtaRecords.length === 0) {
    console.log('No records to ingest. Exiting.');
    process.exit(0);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);

  const docs = gtaRecords.map((r) => ({
    raw_text: r.text,
    categories: mapCategories(r.offence),
    severity_index: mapSeverity(r.offence),
    location: {
      type: 'Point',
      coordinates: [r.lng, r.lat],
    },
    is_anonymous: true,
    created_at: r.date ? new Date(r.date) : new Date(),
    user_id: null,
  }));

  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await PostModel.insertMany(batch, { ordered: false });
    inserted += batch.length;
    console.log(`  Inserted ${inserted} / ${docs.length}`);
  }

  console.log(`Done. ${inserted} incidents ingested.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
