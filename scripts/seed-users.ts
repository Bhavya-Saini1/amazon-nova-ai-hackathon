/**
 * Seed script — creates 20 realistic mock users and links ~30% of
 * existing posts to them. Does NOT delete any posts.
 *
 * Usage:
 *   npx tsx scripts/seed-users.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Inline schemas (avoids tsx import resolution issues)
// ---------------------------------------------------------------------------
const UserSchema = new mongoose.Schema(
  {
    auth0_id: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, default: null },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    username: { type: String, default: null },
    age: { type: Number, default: null },
    phone_number: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
UserSchema.index({ auth0_id: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);
const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

const PostSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    raw_text: { type: String },
    categories: { type: [String] },
    severity_index: { type: Number },
    severity: { type: String },
    location_text: { type: String },
    is_anonymous: { type: Boolean },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    created_at: { type: Date },
  },
  { timestamps: false, strict: false }
);
const PostModel = mongoose.models.Post || mongoose.model('Post', PostSchema);

// ---------------------------------------------------------------------------
// 20 realistic mock users
// ---------------------------------------------------------------------------
interface MockUser {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  age: number;
  phone_number: string;
}

const MOCK_USERS: MockUser[] = [
  { first_name: 'Sarah', last_name: 'Chen', username: 'sarah_safewalks', email: 'sarah.chen@example.com', age: 22, phone_number: '+14165551001' },
  { first_name: 'Priya', last_name: 'Patel', username: 'priya.p', email: 'priya.patel@example.com', age: 21, phone_number: '+14165551002' },
  { first_name: 'Aisha', last_name: 'Khan', username: 'aisha_k', email: 'aisha.khan@example.com', age: 24, phone_number: '+14165551003' },
  { first_name: 'Emily', last_name: 'Rodriguez', username: 'em_rod', email: 'emily.rodriguez@example.com', age: 19, phone_number: '+14165551004' },
  { first_name: 'Jessica', last_name: 'Thompson', username: 'jess_t', email: 'jessica.thompson@example.com', age: 26, phone_number: '+14165551005' },
  { first_name: 'Fatima', last_name: 'Al-Rashid', username: 'fatima.ar', email: 'fatima.alrashid@example.com', age: 23, phone_number: '+14165551006' },
  { first_name: 'Maya', last_name: 'Singh', username: 'maya_singh', email: 'maya.singh@example.com', age: 20, phone_number: '+14165551007' },
  { first_name: 'Olivia', last_name: 'Kim', username: 'liv_kim', email: 'olivia.kim@example.com', age: 25, phone_number: '+14165551008' },
  { first_name: 'Zara', last_name: 'Williams', username: 'zara_w', email: 'zara.williams@example.com', age: 21, phone_number: '+14165551009' },
  { first_name: 'Noor', last_name: 'Hassan', username: 'noor.h', email: 'noor.hassan@example.com', age: 22, phone_number: '+14165551010' },
  { first_name: 'Chloe', last_name: 'Dubois', username: 'chloe_d', email: 'chloe.dubois@example.com', age: 28, phone_number: '+14165551011' },
  { first_name: 'Ananya', last_name: 'Sharma', username: 'ananya_s', email: 'ananya.sharma@example.com', age: 20, phone_number: '+14165551012' },
  { first_name: 'Rachel', last_name: 'Lee', username: 'rach_lee', email: 'rachel.lee@example.com', age: 23, phone_number: '+14165551013' },
  { first_name: 'Sophia', last_name: 'Martinez', username: 'sophia_m', email: 'sophia.martinez@example.com', age: 27, phone_number: '+14165551014' },
  { first_name: 'Amira', last_name: 'Okafor', username: 'amira.ok', email: 'amira.okafor@example.com', age: 19, phone_number: '+14165551015' },
  { first_name: 'Hannah', last_name: 'Nguyen', username: 'hannah_n', email: 'hannah.nguyen@example.com', age: 24, phone_number: '+14165551016' },
  { first_name: 'Layla', last_name: 'Ibrahim', username: 'layla_i', email: 'layla.ibrahim@example.com', age: 22, phone_number: '+14165551017' },
  { first_name: 'Megan', last_name: 'O\'Brien', username: 'meg_ob', email: 'megan.obrien@example.com', age: 26, phone_number: '+14165551018' },
  { first_name: 'Rina', last_name: 'Tanaka', username: 'rina_t', email: 'rina.tanaka@example.com', age: 21, phone_number: '+14165551019' },
  { first_name: 'Dani', last_name: 'Petrov', username: 'dani_p', email: 'dani.petrov@example.com', age: 23, phone_number: '+14165551020' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set.'); process.exit(1); }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);

  // --- Step 1: Clear old mock users (by their synthetic auth0_id prefix) ---
  const delUsers = await UserModel.deleteMany({ auth0_id: /^mock\|/ });
  console.log(`Cleared ${delUsers.deletedCount} previous mock users.`);

  // --- Step 2: Insert 20 new mock users ---
  const userDocs = MOCK_USERS.map((u) => ({
    auth0_id: `mock|${u.username}`,
    email: u.email,
    name: `${u.first_name} ${u.last_name}`,
    first_name: u.first_name,
    last_name: u.last_name,
    username: u.username,
    age: u.age,
    phone_number: u.phone_number,
    created_at: new Date(),
  }));

  const inserted = await UserModel.insertMany(userDocs);
  const userIds = inserted.map((u: { _id: mongoose.Types.ObjectId }) => u._id);
  console.log(`Inserted ${inserted.length} mock users.\n`);

  // --- Step 3: Link ~30% of posts to random users ---
  const allPosts = await PostModel.find({}, { _id: 1 }).lean();
  console.log(`Found ${allPosts.length} existing posts.`);

  const targetCount = Math.round(allPosts.length * 0.3);
  const shuffled = [...allPosts].sort(() => Math.random() - 0.5);
  const toLink = shuffled.slice(0, targetCount);
  const toAnonymize = shuffled.slice(targetCount);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bulkOps: mongoose.AnyBulkWriteOperation<any>[] = [];

  for (const post of toLink) {
    bulkOps.push({
      updateOne: {
        filter: { _id: post._id },
        update: { $set: { user_id: pick(userIds), is_anonymous: false } },
      },
    });
  }

  for (const post of toAnonymize) {
    bulkOps.push({
      updateOne: {
        filter: { _id: post._id },
        update: { $set: { user_id: null, is_anonymous: true } },
      },
    });
  }

  if (bulkOps.length > 0) {
    const result = await PostModel.bulkWrite(bulkOps);
    console.log(`Updated ${result.modifiedCount} posts (${toLink.length} linked, ${toAnonymize.length} anonymous).\n`);
  }

  // --- Step 4: Print formatted user list ---
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MOCK USERS — Copy these for testing Follow functionality');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const postCounts: Record<string, number> = {};
  const linkedPosts = await PostModel.find(
    { user_id: { $in: userIds } },
    { user_id: 1 }
  ).lean();
  for (const p of linkedPosts) {
    const uid = String(p.user_id);
    postCounts[uid] = (postCounts[uid] || 0) + 1;
  }

  console.log(
    '  #  │ Username             │ Name                 │ Posts │ _id'
  );
  console.log(
    '─────┼──────────────────────┼──────────────────────┼───────┼──────────────────────────'
  );

  for (let i = 0; i < inserted.length; i++) {
    const u = inserted[i];
    const uname = `@${(u as unknown as { username: string }).username}`;
    const fullName = (u as unknown as { name: string }).name;
    const posts = postCounts[String(u._id)] || 0;
    const num = String(i + 1).padStart(3);
    console.log(
      `  ${num} │ ${uname.padEnd(20)} │ ${fullName.padEnd(20)} │ ${String(posts).padStart(5)} │ ${u._id}`
    );
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');

  await mongoose.disconnect();
}

main().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
