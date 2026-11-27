import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type SystemContentBlock,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import {
  buildDemoHeraReply,
  createDemoHeraStream,
  shouldUseDemoHeraBot,
} from '@/lib/demo-herabot';
import {
  coverageAllowlistSummary,
  findCoveragePlace,
} from '@/lib/coverage-places';
import { connectDB } from '@/lib/db/mongodb';
import { findActivityHotspot, resolveMapFocus } from '@/lib/hotspot';
import { Post } from '@/lib/models/Post';
import { getAppSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow longer Bedrock tool loops on Vercel (capped by plan).
export const maxDuration = 60;

// Prefer the US inference profile — more reliable than on-demand model IDs.
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID?.trim() || 'us.amazon.nova-lite-v1:0';
const MAX_TOOL_ROUNDS = 4;

const PILOT_PHRASE_RE =
  /(?:sorry,?\s*)?Hera is currently in a pilot phase for Southern Ontario\.[^\n]*/gi;

function scrubUnauthorizedPilotPhrase(text: string, allowPilot: boolean): string {
  if (allowPilot) return text;
  return text.replace(PILOT_PHRASE_RE, '').replace(/\n{3,}/g, '\n\n').trimStart();
}

function getBedrockClient() {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const SYSTEM_PROMPT: SystemContentBlock[] = [
  {
    text: [
      'You are HeraBot, a warm and street-smart Safety Companion inside the Hera app.',
      'Today\'s date is March 2026.',
      'You help users feel safe and informed about their surroundings.',
      'You have access to a live database of real safety incident reports.',

      '\n\nCRITICAL RULE — DATA FIRST:',
      '- If the user asks about ANY location / town / city, you MUST use tools before answering.',
      '- Preferred flow for named places: call lookup_place, then in the next tool turn call BOTH',
      '  focus_map AND search_incidents using the coordinates and radius_km from lookup_place.',
      '- If you already know in-coverage coordinates, you may call focus_map + search_incidents immediately.',
      '- If search_incidents returns data, your reply MUST be grounded in the REGION STATS block.',
      '- You MUST include concrete numbers from REGION STATS: total reports, most frequent category,',
      '  category share/count, and average severity (and high-severity count when present).',
      '- Example: "In this Mississauga radius I see 18 reports. The most common category is Catcalling (8 reports),',
      '  with average severity around 6.2/10; 4 reports are high-severity (7+)."',
      '- Then add one short practical tip. Keep vibe/seasonal chatter secondary.',
      '- DO NOT use the generic "March Break / weather" vibe fallback unless search_incidents returns EXACTLY zero results.',
      '- Real data always takes priority over vibes.',
      '- ABSOLUTE BAN: Never say "pilot phase" / "Hera is currently in a pilot phase" unless the latest',
      '  search_incidents tool result explicitly contains COVERAGE=OUT_OF_SCOPE.',

      '\n\nMANDATORY MAP SYNC:',
      '- Whenever you discuss, mention, or respond about a specific city, neighborhood, or area,',
      '  you MUST call focus_map with the coordinates AND a place_type.',
      '- place_type rules:',
      '  city → whole city asks ("Mississauga", "Toronto", "Hamilton"). Server snaps the camera to the',
      '    densest incident hotspot in that city — do NOT try to pick a hotspot yourself.',
      '  neighborhood → districts ("Square One", "Queen West", "North York", "Port Credit").',
      '  specific → exact pins only: intersections ("Hurontario & Burnhamthorpe"), campus buildings,',
      '    GO stations named precisely, street addresses. These keep the exact coordinates.',
      '- This applies even if no incidents are found — the map must always reflect the location being discussed.',
      '- You MUST call focus_map and search_incidents together in the same tool-use turn.',
      '- Prefer lookup_place for coordinates. Hotspot snap for city/neighborhood happens server-side.',

      '\n\nGEOGRAPHIC SCOPE / ALLOWLIST:',
      '- Hera covers Southern & Southwestern Ontario wherever incidents exist nearby.',
      '- IN-COVERAGE allowlist (always search these — never invent a pilot disclaimer):',
      `  ${coverageAllowlistSummary()}.`,
      '- Small towns on/near corridors count too (Fergus, Elora, Listowel, Stratford, Woodstock, etc.).',
      '- CRITICAL: "London" = London Ontario. NEVER London UK unless the user says UK/England.',
      '- HARD RULE: call lookup_place and/or focus_map + search_incidents before any place answer.',
      '- If REGION STATS total_reports > 0 → answer from stats only.',
      '- If IN_SCOPE and total_reports = 0 → say it looks quiet in Hera data + one short tip.',
      '- The pilot-phase sentence is ONLY allowed when a tool result says COVERAGE=OUT_OF_SCOPE.',
      '- NEVER refuse to help entirely — always offer value.',

      '\n\nTONE & PERSONALITY:',
      '- You are a Safety Companion, NOT a corporate bot. Sound like a knowledgeable local friend.',
      '- Be warm, concise (2-4 sentences), and action-oriented.',
      '- Suggest real things to do: specific parks, transit tips, well-lit routes, local events.',

      '\n\nCRITICAL OUTPUT RULES:',
      '- NEVER expose internal reasoning, tool names, <thinking> tags, XML tags, or raw JSON.',
      '- NEVER say "I am unable to provide data", "failed to retrieve", "no data available", or any variation.',
      '- NEVER apologize for tools, searches, or missing data.',

      '\n\nVIBE SYNTHESIS (when NO incidents are found):',
      '- If a search returns zero incidents, that is GOOD NEWS. Treat it positively.',
      '- Respond with the general vibe of the location using your knowledge of the area and the current date (March 2026).',
      '- Mention seasonally relevant context: March Break activities, spring weather transitions, local events',
      '  (Sugar Shack season, St. Patrick\'s Day, Nuit Blanche, cherry blossom forecasts, patio openings).',
      '- Example: "Things look clear and quiet in the Annex right now — great time to explore.',
      '  March Break means the ROM and AGO will be bustling but well-staffed. Stick to well-lit streets after dark and you\'re golden."',

      '\n\nINCIDENT SYNTHESIS (when incidents ARE found):',
      '- Lead with REGION STATS numbers (count, top category, avg severity). Do not stay vague.',
      '- It is REQUIRED to say the most frequent category and the average severity score out of 10.',
      '- Mention a second category if REGION STATS provides one.',
      '- Mention high-severity count when REGION STATS includes it.',
      '- If activity_hotspot is present, name that hotspot place (map already zooms there for city/neighborhood asks).',
      '- Optionally reference 1 recent example from the SAMPLE REPORTS section, without dumping a full list.',
      '- Do NOT paste the entire numbered list back to the user.',
      '- Always end with one practical, empowering safety tip tied to the dominant pattern',
      '  (e.g. if Catcalling dominates near transit, recommend busier exits / well-lit corridors).',
    ].join(' '),
  },
];

const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'lookup_place',
      description:
        'Resolve a city/town name to in-coverage Southern Ontario coordinates. Call this for any named place (especially smaller towns like Fergus, Listowel, Elora, Stratford) BEFORE answering. Returns lat/lng and suggested search radius.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Place name from the user, e.g. "Fergus", "Listowel", "London".',
            },
          },
          required: ['name'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'focus_map',
      description:
        'Pan and zoom the map. For city/neighborhood queries the server snaps to the densest nearby incident hotspot. Use place_type=specific only for intersections, addresses, or exact POIs.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            latitude: {
              type: 'number',
              description: 'Latitude of the requested place (city center, neighborhood, or exact pin).',
            },
            longitude: {
              type: 'number',
              description: 'Longitude of the requested place (city center, neighborhood, or exact pin).',
            },
            place_type: {
              type: 'string',
              description:
                'city | neighborhood | specific. city/neighborhood snap to activity hotspots; specific keeps exact coords.',
            },
          },
          required: ['latitude', 'longitude'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'filter_incidents',
      description:
        'Filter incident markers on the map by category. Use "All" to clear filters.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category to filter by, e.g. "Groping", "Ogling", "Commenting", or "All".',
            },
          },
          required: ['category'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'search_incidents',
      description:
        'Search the live database for safety incident reports near a location. You MUST call this whenever the user mentions a location. Returns REGION STATS (top categories, average severity, counts) plus sample reports. Your spoken answer MUST use those stats.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Center latitude for the search area.' },
            longitude: { type: 'number', description: 'Center longitude for the search area.' },
            radius_km: {
              type: 'number',
              description:
                'Search radius in kilometers. Default 12 for large cities; use 20-30 for smaller towns like Listowel/Stratford so nearby corridor reports are included. Maximum 50.',
            },
            category: {
              type: 'string',
              description: 'Optional category filter, e.g. "Groping". Omit to search all.',
            },
            limit: { type: 'integer', description: 'Max results to return. Default 25.' },
          },
          required: ['latitude', 'longitude'],
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executors (server-side only — results never shown raw to user)
// ---------------------------------------------------------------------------
interface ToolExecResult {
  output: string;
  mapAction?: { type: string; payload: Record<string, unknown> };
}

/** Rough Southern / Southwestern Ontario coverage box matching seeded data. */
function isInHeraCoverage(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 41.9 &&
    lat <= 45.1 &&
    lng >= -83.6 &&
    lng <= -78.4
  );
}

function coverageBanner(lat: number, lng: number, totalReports: number): string {
  if (isInHeraCoverage(lat, lng)) {
    return [
      'COVERAGE=IN_SCOPE_SOUTHERN_ONTARIO',
      totalReports > 0
        ? 'FORBIDDEN: Do NOT say "pilot phase" / out-of-coverage. Answer from REGION STATS only.'
        : 'IN SCOPE but quiet. Say reports look clear nearby; give one short tip. Do NOT say "pilot phase".',
    ].join(' ');
  }
  return [
    'COVERAGE=OUT_OF_SCOPE',
    'You may use the Southern Ontario pilot-phase disclaimer, then one short general tip.',
  ].join(' ');
}

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<ToolExecResult> {
  switch (name) {
    case 'lookup_place': {
      const placeName = String(input.name ?? '').trim();
      const place = findCoveragePlace(placeName);
      if (place) {
        return {
          output: [
            `PLACE_RESOLVED name=${place.name}`,
            'IN_COVERAGE=true',
            `latitude=${place.latitude}`,
            `longitude=${place.longitude}`,
            `radius_km=${place.radiusKm}`,
            'NEXT: call focus_map (place_type=city) AND search_incidents with these coordinates and radius_km.',
            'FORBIDDEN: do not say pilot phase for this place.',
          ].join('\n'),
        };
      }

      return {
        output: [
          `PLACE_UNRESOLVED name=${placeName || 'unknown'}`,
          'If this is still in Southern/Southwestern Ontario, estimate coordinates and call',
          'focus_map + search_incidents anyway. Only treat as out-of-scope if clearly outside Ontario.',
        ].join(' '),
      };
    }

    case 'focus_map': {
      const lat = Number(input.latitude);
      const lng = Number(input.longitude);
      try {
        const focus = await resolveMapFocus(lat, lng, input.place_type);
        const snapNote = focus.snapped
          ? ` Snapped to activity hotspot` +
            (focus.label ? ` near "${focus.label}"` : '') +
            ` (${focus.reportCount} clustered reports).`
          : ' Exact coordinates used (specific place or no nearby cluster).';
        return {
          output: `Map focused at ${focus.latitude.toFixed(4)}, ${focus.longitude.toFixed(4)} (zoom ${focus.zoom}).${snapNote}`,
          mapAction: {
            type: 'focus_map',
            payload: {
              latitude: focus.latitude,
              longitude: focus.longitude,
              zoom: focus.zoom,
              snapped: focus.snapped,
              label: focus.label,
            },
          },
        };
      } catch (err) {
        console.error('focus_map hotspot resolve failed:', err);
        return {
          output: `Map panned to ${lat.toFixed(4)}, ${lng.toFixed(4)}.`,
          mapAction: {
            type: 'focus_map',
            payload: { latitude: lat, longitude: lng, zoom: 13 },
          },
        };
      }
    }

    case 'filter_incidents': {
      const category = String(input.category ?? 'All');
      return {
        output: `Map filtered to category: ${category}.`,
        mapAction: { type: 'filter_incidents', payload: { category } },
      };
    }

    case 'search_incidents': {
      const lat = Number(input.latitude);
      const lng = Number(input.longitude);
      const radiusKm = Math.min(Number(input.radius_km ?? 12), 50);
      const category = input.category ? String(input.category) : null;
      const limit = Math.min(Number(input.limit ?? 25), 25);

      try {
        await connectDB();
        await Post.collection.createIndex(
          { location: '2dsphere' },
          { sparse: true, background: true }
        ).catch(() => { /* already exists */ });

        const maxDistMeters = radiusKm * 1000;
        const query: Record<string, unknown> = {
          location: {
            $nearSphere: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: maxDistMeters,
            },
          },
        };
        if (category && category !== 'All') {
          query.categories = category;
        }

        const posts = await Post.find(query)
          .sort({ created_at: -1 })
          .limit(Math.max(limit, 50))
          .select('raw_text categories severity_index created_at location location_text')
          .lean();

        console.log(`[TOOL] search_incidents found ${posts.length} results for coordinates ${lat}, ${lng} (radius ${radiusKm}km / ${maxDistMeters}m)`);

        if (posts.length === 0) {
          return {
            output: [
              coverageBanner(lat, lng, 0),
              `REGION STATS: total_reports=0 within ${radiusKm}km.`,
              'Respond positively: tell the user the area looks clear based on Hera reports,',
              'then share one short practical tip. Avoid long seasonal/vibe digressions.',
            ].join(' '),
          };
        }

        const categoryCounts = new Map<string, number>();
        const locationCounts = new Map<string, number>();
        const severities: number[] = [];

        for (const post of posts) {
          const cats = post.categories?.length ? post.categories : ['uncategorized'];
          for (const cat of cats) {
            categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
          }
          const loc = post.location_text?.trim();
          if (loc) {
            locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
          }
          if (typeof post.severity_index === 'number' && Number.isFinite(post.severity_index)) {
            severities.push(post.severity_index);
          }
        }

        const rankedCategories = Array.from(categoryCounts.entries()).sort(
          (a, b) => b[1] - a[1]
        );
        const topCategory = rankedCategories[0];
        const secondCategory = rankedCategories[1];
        const avgSeverity =
          severities.length > 0
            ? severities.reduce((sum, value) => sum + value, 0) / severities.length
            : null;
        const highSeverityCount = severities.filter((value) => value >= 7).length;
        const topLocation = Array.from(locationCounts.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0];

        const hotspot = await findActivityHotspot(
          lat,
          lng,
          radiusKm,
          Math.min(2.2, Math.max(1.0, radiusKm * 0.15))
        );

        const categorySummary = rankedCategories
          .slice(0, 4)
          .map(([name, count]) => {
            const pct = Math.round((count / posts.length) * 100);
            return `${name}=${count} (${pct}%)`;
          })
          .join(', ');

        const sampleLimit = Math.min(limit, 8);
        const summaries = posts.slice(0, sampleLimit).map((p, i) => {
          const cats = (p.categories ?? []).join(', ') || 'uncategorized';
          const sev = p.severity_index ?? 'unknown';
          const date = new Date(p.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          const place = p.location_text?.trim() || 'unspecified place';
          const snippet =
            p.raw_text.length > 100
              ? p.raw_text.slice(0, 100) + '...'
              : p.raw_text;
          return `${i + 1}. [${date}] severity ${sev}/10, categories: ${cats}, place: ${place} — "${snippet}"`;
        });

        return {
          output: [
            coverageBanner(lat, lng, posts.length),
            'REGION STATS (REQUIRED in your answer):',
            `- total_reports=${posts.length} within ${radiusKm}km of (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            `- most_frequent_category=${topCategory ? `${topCategory[0]} (${topCategory[1]} reports)` : 'n/a'}`,
            secondCategory
              ? `- second_category=${secondCategory[0]} (${secondCategory[1]} reports)`
              : '- second_category=n/a',
            `- category_breakdown=${categorySummary || 'n/a'}`,
            `- average_severity=${avgSeverity === null ? 'n/a' : avgSeverity.toFixed(1)}/10`,
            `- high_severity_count_7plus=${highSeverityCount}`,
            topLocation
              ? `- most_mentioned_place=${topLocation[0]} (${topLocation[1]} reports)`
              : '- most_mentioned_place=n/a',
            hotspot
              ? `- activity_hotspot=${hotspot.label ?? 'cluster'} at (${hotspot.latitude.toFixed(4)}, ${hotspot.longitude.toFixed(4)}) with ${hotspot.count} nearby reports — mention this place when helpful`
              : '- activity_hotspot=n/a',
            '',
            'SAMPLE REPORTS (optional color only — do not dump this whole list):',
            ...summaries,
            '',
            'Answer requirements: state total_reports, most_frequent_category, and average_severity explicitly. Mention the activity hotspot place when present. Then one practical tip. Never claim pilot/out-of-coverage when COVERAGE=IN_SCOPE.',
          ].join('\n'),
        };
      } catch (err) {
        console.error('search_incidents DB error:', err);
        return {
          output: [
            'Search could not be completed. Respond with general safety advice for the area',
            'and the current season (March 2026). Do NOT mention any technical issue to the user.',
          ].join(' '),
        };
      }
    }

    default:
      return { output: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Post-processing: strip <thinking> tags and other internal leakage
// ---------------------------------------------------------------------------
const THINKING_BLOCK_RE = /<thinking>[\s\S]*?<\/thinking>/gi;
const OPEN_THINKING_RE = /<thinking>[^<]*$/i;
const STRAY_TAG_RE = /<\/?thinking>/gi;

function stripThinkingTags(text: string): string {
  return text
    .replace(THINKING_BLOCK_RE, '')
    .replace(STRAY_TAG_RE, '')
    .replace(/^\s*\n/, '');
}

class ThinkingFilter {
  private insideThinking = false;
  private buffer = '';

  push(chunk: string): string {
    this.buffer += chunk;

    if (this.insideThinking) {
      const closeIdx = this.buffer.indexOf('</thinking>');
      if (closeIdx === -1) {
        this.buffer = '';
        return '';
      }
      this.buffer = this.buffer.slice(closeIdx + '</thinking>'.length);
      this.insideThinking = false;
    }

    const openIdx = this.buffer.indexOf('<thinking>');
    if (openIdx !== -1) {
      const safe = this.buffer.slice(0, openIdx);
      const rest = this.buffer.slice(openIdx);
      const closeIdx = rest.indexOf('</thinking>');
      if (closeIdx !== -1) {
        this.buffer = rest.slice(closeIdx + '</thinking>'.length);
        this.insideThinking = false;
        return stripThinkingTags(safe + this.flush());
      }
      this.buffer = rest;
      this.insideThinking = true;
      return safe;
    }

    if (OPEN_THINKING_RE.test(this.buffer)) {
      const match = this.buffer.match(/<thin/i);
      if (match && match.index !== undefined) {
        const safe = this.buffer.slice(0, match.index);
        this.buffer = this.buffer.slice(match.index);
        return safe;
      }
    }

    const out = this.buffer;
    this.buffer = '';
    return stripThinkingTags(out);
  }

  flush(): string {
    const out = this.buffer;
    this.buffer = '';
    this.insideThinking = false;
    return stripThinkingTags(out);
  }
}

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// POST handler — agentic loop with silent tool execution
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({ error: '`messages` array is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Quick demo path when AWS/Bedrock is unavailable.
  if (shouldUseDemoHeraBot()) {
    const reply = buildDemoHeraReply(body.messages);
    return new Response(createDemoHeraStream(reply), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const messages: Message[] = body.messages.map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  const lastUserText =
    [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const matchedPlace = findCoveragePlace(lastUserText);

  const requestSystem: SystemContentBlock[] = matchedPlace
    ? [
        ...SYSTEM_PROMPT,
        {
          text: [
            `TURN OVERRIDE: the user is asking about ${matchedPlace.name}, which is on the Hera in-coverage allowlist.`,
            `Coordinates: latitude ${matchedPlace.latitude}, longitude ${matchedPlace.longitude}.`,
            `You MUST call focus_map (place_type=city) AND search_incidents with radius_km=${matchedPlace.radiusKm} before answering.`,
            'FORBIDDEN: do not say anything about a pilot phase or being out of coverage for this place.',
          ].join(' '),
        },
      ]
    : SYSTEM_PROMPT;

  const client = getBedrockClient();

  // Start SSE immediately so the client isn't stuck waiting on the whole
  // Bedrock tool loop before the first byte.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let allowPilotPhrase = !matchedPlace;
      let sawInScopeCoverage = Boolean(matchedPlace);

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      function emitText(text: string) {
        const clean = scrubUnauthorizedPilotPhrase(text, allowPilotPhrase);
        if (clean) send('text_delta', { text: clean });
      }

      try {
        let round = 0;
        while (round < MAX_TOOL_ROUNDS) {
          round++;

          const response = await client.send(
            new ConverseCommand({
              modelId: MODEL_ID,
              system: requestSystem,
              messages,
              toolConfig: { tools: TOOLS },
            })
          );

          const assistantContent = response.output?.message?.content ?? [];
          messages.push({ role: 'assistant', content: assistantContent });

          const toolCalls = assistantContent.filter((b) => b.toolUse);
          console.log(
            `[AGENT] round ${round} — stopReason: ${response.stopReason}, tool calls: ${toolCalls.length}` +
              (toolCalls.length > 0
                ? ` (${toolCalls.map((b) => b.toolUse?.name).join(', ')})`
                : '')
          );

          if (response.stopReason !== 'tool_use') {
            break;
          }

          const toolResultBlocks: ContentBlock[] = [];

          for (const block of assistantContent) {
            if (!block.toolUse) continue;

            const toolName = block.toolUse.name ?? 'unknown';
            const toolInput = (block.toolUse.input as Record<string, unknown>) ?? {};
            const toolUseId = block.toolUse.toolUseId ?? '';
            const result = await executeTool(toolName, toolInput);

            if (result.output.includes('COVERAGE=IN_SCOPE_SOUTHERN_ONTARIO') ||
                result.output.includes('IN_COVERAGE=true')) {
              sawInScopeCoverage = true;
              allowPilotPhrase = false;
            }
            if (result.output.includes('COVERAGE=OUT_OF_SCOPE')) {
              allowPilotPhrase = !sawInScopeCoverage;
            }

            if (result.mapAction) {
              // Fly the map as soon as a tool requests it.
              send('map_action', result.mapAction);
            }

            toolResultBlocks.push({
              toolResult: {
                toolUseId,
                content: [{ text: result.output }],
              },
            });
          }

          messages.push({ role: 'user', content: toolResultBlocks });
        }

        const lastMsg = messages[messages.length - 1];
        const lastIsAssistantText =
          lastMsg.role === 'assistant' &&
          Array.isArray(lastMsg.content) &&
          (lastMsg.content as ContentBlock[]).some((b) => b.text !== undefined);

        const filter = new ThinkingFilter();

        if (lastIsAssistantText) {
          for (const block of lastMsg.content as ContentBlock[]) {
            if (block.text) {
              const clean = filter.push(block.text);
              if (clean) emitText(clean);
            }
          }
          const remaining = filter.flush();
          if (remaining) emitText(remaining);
          send('message_stop', { stopReason: 'end_turn' });
        } else {
          const streamResp = await client.send(
            new ConverseStreamCommand({
              modelId: MODEL_ID,
              system: requestSystem,
              messages,
              toolConfig: { tools: TOOLS },
            })
          );

          if (streamResp.stream) {
            for await (const event of streamResp.stream) {
              if (event.contentBlockDelta?.delta?.text) {
                const clean = filter.push(event.contentBlockDelta.delta.text);
                if (clean) emitText(clean);
              }
              if (event.messageStop) {
                const remaining = filter.flush();
                if (remaining) emitText(remaining);
                send('message_stop', {
                  stopReason: event.messageStop.stopReason,
                });
              }
            }
          } else {
            send('message_stop', { stopReason: 'end_turn' });
          }
        }
      } catch (err) {
        console.error('Chat handler failed, falling back to demo HeraBot:', err);
        const reply = buildDemoHeraReply(body.messages ?? []);
        for (const action of reply.mapActions) {
          send('map_action', action);
        }
        const chunkSize = 24;
        for (let i = 0; i < reply.text.length; i += chunkSize) {
          send('text_delta', { text: reply.text.slice(i, i + chunkSize) });
        }
        send('message_stop', { stopReason: 'end_turn' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
