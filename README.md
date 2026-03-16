# Hera -- AI-Powered Safety Companion for Women

Hera is a full-stack safety platform that combines **real-time incident reporting**, **ML-powered classification**, an **AI conversational agent (HeraBot)**, and an **interactive heatmap** to help women navigate cities more safely. Built for the Amazon Nova AI Hackathon.

## What It Does

1. **Report** -- Users describe a safety incident in plain text. Two ML models instantly classify the **category** (Catcalling, Stalking, Ogling, Verbal Harassment) and **severity** (1-10 regression score).
2. **Visualize** -- Every report is stored as a GeoJSON point and rendered on a live Mapbox heatmap covering Southern Ontario.
3. **Ask HeraBot** -- A conversational AI agent (powered by Amazon Bedrock Nova) searches the incident database, moves the map, and synthesizes data-driven safety insights in real time.
4. **Connect** -- A social layer with user profiles, follow system, and community feeds.

## Architecture

```
Browser (Next.js 14 + Tailwind + Mapbox GL)
  |
  |--- /api/posts      POST  -->  Category ML API  -->  Severity ML API  -->  MongoDB
  |--- /api/map         GET  -->  MongoDB (GeoJSON)  -->  Mapbox Heatmap
  |--- /api/chat        POST -->  Bedrock Nova (Agentic Loop)
  |                                  |-- focus_map tool      --> SSE map_action
  |                                  |-- search_incidents    --> MongoDB $nearSphere
  |                                  |-- filter_incidents    --> SSE map_action
  |                                  '--> ConverseStream     --> SSE text_delta
  |--- Auth0 SDK               -->  User Authentication
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Mapbox GL JS |
| Backend | Next.js API Routes (Node.js runtime) |
| AI Agent | Amazon Bedrock Nova Lite (`amazon.nova-lite-v1:0`), Agentic tool-use loop |
| ML -- Categories | PyTorch + HuggingFace DistilRoBERTa (fine-tuned on SafeCity dataset) |
| ML -- Severity | Custom regression model (teammate's external API) |
| Database | MongoDB Atlas with `2dsphere` geospatial index |
| Auth | Auth0 (OAuth 2.0 + Google social login) |
| Maps | Mapbox GL JS with heatmap + fly-to animations |
| Deployment | Vercel (web app), Hugging Face Spaces (category model Docker) |

## Project Structure

```
app/
  api/
    chat/route.ts           # HeraBot -- Bedrock Nova agentic loop + SSE streaming
    posts/route.ts          # Incident creation -- dual ML pipeline
    map/route.ts            # GeoJSON endpoint for heatmap
    admin/nuke/route.ts     # DB wipe (dev only)
    posts/following/route.ts
    posts/user/route.ts
    profile/route.ts
    users/search/route.ts
    users/[username]/follow/route.ts
  create-post/page.tsx      # Incident report form (with browser geolocation)
  home/page.tsx             # Community feed
  map/page.tsx              # Heatmap + HeraBot
  following/page.tsx        # Following feed
  profile/page.tsx          # User profile
  user/[username]/page.tsx  # Public profile

components/
  HeraBot.tsx               # Floating AI chat UI (SSE streaming + map controls)
  MapContainer.tsx          # Mapbox heatmap (forwardRef with flyTo / filterByCategory)
  PostCard.tsx              # Incident card (supports severity_index + legacy severity)
  AppHeader.tsx
  Navigation.tsx
  UserSearch.tsx
  PublicProfileView.tsx

lib/
  db/mongodb.ts             # MongoDB connection (with 2dsphere index auto-creation)
  models/Post.ts            # Post schema (GeoJSON location, categories, severity_index)
  models/User.ts            # User schema
  models/Follow.ts          # Follow relationship schema
  auth0.ts
  posts.ts
  profile.ts
  follows.ts

scripts/
  seed-gta-incidents.ts     # Seed 2,500 realistic incidents across Southern Ontario
  seed-users.ts             # Seed 20 mock users + link 30% of posts
  ingest-gta-incidents.ts   # Ingest real-world GeoJSON datasets (e.g., Toronto Police MCI)

categorymodel/              # PyTorch multi-label classification model
  api.py                    # FastAPI inference endpoint
  train.py                  # HuggingFace Trainer training loop
  modeling.py               # DistilRoBERTa + BCEWithLogitsLoss head
  Dockerfile                # Docker image for Hugging Face Spaces
  requirements.txt

python-service/             # Severity regression model (teammate's service)
  main.py                   # FastAPI severity endpoint
  train.py
  requirements.txt
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster
- Auth0 application
- Mapbox access token
- AWS account with Bedrock access (`amazon.nova-lite-v1:0`)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
# Fill in all values -- see .env.local.example for descriptions
```

### 3. Seed the database (optional but recommended)

```bash
# Seed 2,500 realistic GTA incidents
npx tsx scripts/seed-gta-incidents.ts

# Seed 20 mock users and link them to posts
npx tsx scripts/seed-users.ts
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Start the category ML service

```bash
cd categorymodel
pip install -r requirements.txt
uvicorn api:app --port 8000
```

## Key Features in Detail

### Dual ML Pipeline (Post Creation)

When a user submits an incident report:

1. **Category Model** -- Text is sent to the FastAPI category service (DistilRoBERTa fine-tuned on SafeCity). If the service is unreachable, a keyword-based regex classifier assigns categories as a fallback.
2. **Severity Model** -- Text is sent to the external ML severity API. The float response is rounded and clamped to 1-10. If the service times out (3s), severity defaults to 5.
3. **GeoJSON Storage** -- Browser geolocation coordinates are stored as `{ type: "Point", coordinates: [lng, lat] }` with a `2dsphere` index for spatial queries.

### HeraBot (AI Agent)

HeraBot uses an **agentic loop** powered by Amazon Bedrock Nova:

- **Non-streaming rounds**: Nova calls tools (`focus_map`, `search_incidents`, `filter_incidents`) which the server executes against MongoDB.
- **Streaming final response**: Once all tools are resolved, Nova streams a conversational synthesis via `ConverseStreamCommand`, delivered to the frontend as SSE.
- **Map integration**: `focus_map` calls are sent as `map_action` SSE events, causing the Mapbox map to `flyTo()` the discussed location before the text arrives.
- **Data-first**: The system prompt mandates that Nova always calls `search_incidents` and references real data. Vibe synthesis (seasonal context, local events) is only used when the database returns zero results.
- **`<thinking>` tag stripping**: A `ThinkingFilter` class removes internal reasoning from the stream before it reaches the user.

### Heatmap

- Mapbox GL JS with a `heatmap` layer sourced from `/api/map` (GeoJSON FeatureCollection).
- Severity weights drive heatmap intensity.
- Heatmap stays visible at all zoom levels (maxzoom 22, opacity tuned for street-level).
- Correct Z-index below labels via `beforeId: 'waterway-label'`.

### Seed Data

The `seed-gta-incidents.ts` script generates 2,500 geographically realistic incidents:

- **15 micro-hubs** across Toronto, Mississauga, Brampton, Hamilton, Kitchener-Waterloo, and London ON.
- **Highway corridor noise** (Hwy 401, 403, QEW) simulating commuter reports.
- **Piecewise coastline guard** tracing the Lake Ontario shoreline to prevent water points.
- **Gaussian jitter** (Box-Muller) for organic cluster density.
- **Nighttime severity boost** (+1-2 for incidents between 9 PM and 6 AM).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `AUTH0_SECRET` | Yes | Random 32+ char secret |
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Yes | Auth0 app client ID |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 app client secret |
| `AUTH0_BASE_URL` | Yes | App URL (http://localhost:3000) |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Yes | Mapbox public token |
| `AWS_REGION` | Yes | AWS region for Bedrock (us-east-1) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `CATEGORY_SERVICE_URL` | No | Category ML API URL (default: http://127.0.0.1:8000) |
| `ML_SEVERITY_API_URL` | No | Severity ML API URL (falls back to 5 if unset) |

## Scripts

```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run lint             # ESLint check

npx tsx scripts/seed-gta-incidents.ts    # Seed 2,500 incidents
npx tsx scripts/seed-users.ts            # Seed 20 users + link posts
npx tsx scripts/ingest-gta-incidents.ts <file.json>  # Ingest real dataset
```

## Team

Built for the **Amazon Nova AI Hackathon** -- March 2026.

## License

See [LICENSE](LICENSE) for details.
