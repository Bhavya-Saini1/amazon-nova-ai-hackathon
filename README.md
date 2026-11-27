# Hera

Community-safety platform for Southern Ontario: report an incident in plain language, see it on a Mapbox heatmap, follow other reporters, and ask **HeraBot** for answers grounded in nearby MongoDB reports.

Built for the Amazon Nova AI Hackathon.

## Demo

Live app: [https://amazon-nova-ai-hackathon-zeta.vercel.app](https://amazon-nova-ai-hackathon-zeta.vercel.app)

Main flow: sign in → open **Map** → ask HeraBot about a city or neighborhood → map pans and the reply cites live region stats.

## Run

```bash
npm install
cp .env.local.example .env.local   # fill MongoDB, Auth0, Mapbox, AWS Bedrock

npx tsx scripts/seed-gta-incidents.ts   # ~4,000 Southern Ontario demo reports
npx tsx scripts/seed-users.ts           # followable mock profiles

npm run dev
```

Optional category microservice (local):

```bash
cd categorymodel && pip install -r requirements.txt && uvicorn api:app --port 8000
```

Requires Node 20+, MongoDB Atlas, Auth0, Mapbox, and Bedrock access to Nova Lite (`us.amazon.nova-lite-v1:0`).

## Decision

The product only helps if chat and the map stay honest about *local* data. HeraBot is an Amazon Nova tool-calling agent over MongoDB geospatial queries (`2dsphere` / `$nearSphere` / `$geoWithin`). New place mentions pan to exact lookup coordinates; follow-ups stay on the same pin and reuse that search context (including day vs night breakdowns).

Incident text is labeled by a multi-label DistilRoBERTa classifier (`categorymodel/`, FastAPI, Hugging Face Spaces). If that service times out, `/api/posts` falls back to a keyword regex classifier so create-post still works. Severity scoring is a separate teammate API (`ML_SEVERITY_API_URL`); if it is unset or fails, severity defaults to `5`.

Demo coverage comes from a generated Southern Ontario incident set aligned to city hubs and highway corridors, with coastline guards so points stay on land.

## Next

- Wire a hosted severity endpoint in production (currently falls back to `5` when `ML_SEVERITY_API_URL` is missing).
- Add auth-aware rate limits and stronger evals for HeraBot place-follow-up behavior.
- Replace more of the synthetic seed with curated real open-data overlays where licensing allows.

## Stack

| Area | Choice |
|------|--------|
| App | Next.js 14, TypeScript, Tailwind, Vercel |
| Agent | Amazon Bedrock Nova Lite + SSE tool loop |
| Category ML | DistilRoBERTa / SafeCity → FastAPI → HF Spaces |
| Severity ML | Teammate regression API via env URL |
| Data | MongoDB Atlas + `2dsphere` |
| Map | Mapbox GL heatmap + `flyTo` |
| Auth | Auth0 |

## Layout

```
app/api/chat          HeraBot agent + SSE
app/api/posts         Create/list + ML pipeline + Near Me
app/api/map           Heatmap GeoJSON
app/map               Map + HeraBot UI
lib/coverage-places.ts  In-coverage place allowlist
categorymodel/        Category training + inference API
python-service/       Severity service reference
scripts/              Seed + ingest
```

## Env

See `.env.local.example`. Important keys: `MONGODB_URI`, Auth0 trio + base URL, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, AWS Bedrock creds, optional `CATEGORY_SERVICE_URL`, optional `ML_SEVERITY_API_URL`.

## License

See [LICENSE](LICENSE).
