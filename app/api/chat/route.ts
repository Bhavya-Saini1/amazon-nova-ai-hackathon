import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type SystemContentBlock,
  type Tool,
  type ToolResultContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL_ID = 'amazon.nova-lite-v1:0';
const MAX_TOOL_ROUNDS = 5;

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
      '- If the user asks about ANY location, you MUST call BOTH focus_map AND search_incidents in the SAME turn.',
      '- Call them together — do NOT wait for one to finish before calling the other.',
      '- If search_incidents returns data, you MUST synthesize that data in your response,',
      '  explicitly mentioning the types of incidents (e.g., Catcalling, Stalking) and their severities.',
      '- DO NOT use the generic "March Break / weather" vibe fallback unless search_incidents returns EXACTLY zero results.',
      '- Real data always takes priority over vibes.',

      '\n\nMANDATORY MAP SYNC:',
      '- Whenever you discuss, mention, or respond about a specific city, neighborhood, or area,',
      '  you MUST call focus_map with the coordinates.',
      '- This applies even if no incidents are found — the map must always reflect the location being discussed.',
      '- You MUST call focus_map and search_incidents together in the same tool-use turn.',
      '- Common coordinates for reference:',
      '  Toronto downtown: latitude 43.6532, longitude -79.3832',
      '  Mississauga / UTM: latitude 43.5480, longitude -79.6625',
      '  North York: latitude 43.7615, longitude -79.4111',
      '  Scarborough: latitude 43.7731, longitude -79.2578',
      '  Brampton: latitude 43.7315, longitude -79.7624',
      '  Hamilton: latitude 43.2557, longitude -79.8711',
      '  Kitchener-Waterloo: latitude 43.4643, longitude -80.5204',
      '  London ON: latitude 42.9849, longitude -81.2453',

      '\n\nGEOGRAPHIC SCOPE:',
      '- Hera covers all of Southern Ontario: Toronto, Mississauga, Brampton, Hamilton, Kitchener-Waterloo, and London.',
      '- If a user asks about a location outside Southern Ontario, inform them politely:',
      '  "Hera is currently in a pilot phase for Southern Ontario. I can still share general safety tips for your area!"',
      '- Then provide the best general safety advice you can for the location they asked about.',
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
      '- You MUST mention how many reports were found and the dominant categories (e.g., Catcalling, Stalking, Ogling, Verbal Harassment).',
      '- Weave severity, category, and recency into a conversational paragraph.',
      '- Mention whether incidents tend to be daytime or nighttime if relevant.',
      '- Do NOT list raw data, numbered items, or severity numbers.',
      '- Example: "I found several recent reports around downtown Toronto — mostly catcalling and verbal harassment,',
      '  with a few higher-severity stalking incidents reported after dark near Union Station.',
      '  Stay alert on side streets in the evening and stick to well-lit, busy routes."',
      '- Always end with practical, empowering safety advice.',
    ].join(' '),
  },
];

const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'focus_map',
      description:
        'Pan and zoom the map to a specific location. Use when the user mentions a city, neighborhood, or address.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Latitude of the target location.' },
            longitude: { type: 'number', description: 'Longitude of the target location.' },
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
        'Search the live database for recent safety incident reports near a location. You MUST call this tool whenever the user mentions a location. Returns summaries you should synthesize into a conversational answer.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Center latitude for the search area.' },
            longitude: { type: 'number', description: 'Center longitude for the search area.' },
            radius_km: {
              type: 'number',
              description: 'Search radius in kilometers. Default 5, maximum 50.',
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

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<ToolExecResult> {
  switch (name) {
    case 'focus_map': {
      const lat = Number(input.latitude);
      const lng = Number(input.longitude);
      return {
        output: `Map panned to ${lat.toFixed(4)}, ${lng.toFixed(4)}.`,
        mapAction: { type: 'focus_map', payload: { latitude: lat, longitude: lng } },
      };
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
      const radiusKm = Math.min(Number(input.radius_km ?? 5), 50);
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
          .limit(limit)
          .select('raw_text categories severity_index created_at location')
          .lean();

        console.log(`[TOOL] search_incidents found ${posts.length} results for coordinates ${lat}, ${lng} (radius ${radiusKm}km / ${maxDistMeters}m)`);

        if (posts.length === 0) {
          return {
            output: [
              `Zero incidents reported within ${radiusKm}km — the area appears safe and quiet.`,
              'Respond positively: tell the user the area looks clear,',
              'then share the local vibe for March 2026 (March Break events, seasonal happenings, practical tips).',
            ].join(' '),
          };
        }

        const summaries = posts.map((p, i) => {
          const cats = (p.categories ?? []).join(', ') || 'uncategorized';
          const sev = p.severity_index ?? 'unknown';
          const date = new Date(p.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          const snippet =
            p.raw_text.length > 120
              ? p.raw_text.slice(0, 120) + '...'
              : p.raw_text;
          return `${i + 1}. [${date}] severity ${sev}/10, categories: ${cats} — "${snippet}"`;
        });

        return {
          output: [
            `Found ${posts.length} incident(s) within ${radiusKm}km:`,
            ...summaries,
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
  const session = await auth0.getSession();
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

  const messages: Message[] = body.messages.map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  const client = getBedrockClient();
  const mapActions: { type: string; payload: Record<string, unknown> }[] = [];

  // ---- Agentic loop: non-streaming rounds while Nova calls tools ----------
  try {
    let round = 0;
    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const response = await client.send(
        new ConverseCommand({
          modelId: MODEL_ID,
          system: SYSTEM_PROMPT,
          messages,
          toolConfig: { tools: TOOLS },
        })
      );

      const assistantContent = response.output?.message?.content ?? [];

      messages.push({ role: 'assistant', content: assistantContent });

      const toolCalls = assistantContent.filter((b) => b.toolUse);
      console.log(`[AGENT] round ${round} — stopReason: ${response.stopReason}, tool calls: ${toolCalls.length}${toolCalls.length > 0 ? ` (${toolCalls.map((b) => b.toolUse?.name).join(', ')})` : ''}`);

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

        if (result.mapAction) {
          mapActions.push(result.mapAction);
        }

        const resultContent: ToolResultContentBlock[] = [{ text: result.output }];

        toolResultBlocks.push({
          toolResult: {
            toolUseId,
            content: resultContent,
          },
        });
      }

      messages.push({ role: 'user', content: toolResultBlocks });
    }

    // ---- Final streaming turn: only the conversational summary ------------
    // If the last message is already a text response from the non-streaming
    // loop, extract and stream it. Otherwise do one more streaming call.

    const lastMsg = messages[messages.length - 1];
    const lastIsAssistantText =
      lastMsg.role === 'assistant' &&
      Array.isArray(lastMsg.content) &&
      (lastMsg.content as ContentBlock[]).some((b) => b.text !== undefined);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        }

        try {
          // Send map actions first so the UI reacts immediately
          for (const action of mapActions) {
            send('map_action', action);
          }

          const filter = new ThinkingFilter();

          if (lastIsAssistantText) {
            for (const block of lastMsg.content as ContentBlock[]) {
              if (block.text) {
                const clean = filter.push(block.text);
                if (clean) send('text_delta', { text: clean });
              }
            }
            const remaining = filter.flush();
            if (remaining) send('text_delta', { text: remaining });
            send('message_stop', { stopReason: 'end_turn' });
          } else {
            const streamResp = await client.send(
              new ConverseStreamCommand({
                modelId: MODEL_ID,
                system: SYSTEM_PROMPT,
                messages,
                toolConfig: { tools: TOOLS },
              })
            );

            if (streamResp.stream) {
              for await (const event of streamResp.stream) {
                if (event.contentBlockDelta?.delta?.text) {
                  const clean = filter.push(event.contentBlockDelta.delta.text);
                  if (clean) send('text_delta', { text: clean });
                }
                if (event.messageStop) {
                  const remaining = filter.flush();
                  if (remaining) send('text_delta', { text: remaining });
                  send('message_stop', { stopReason: event.messageStop.stopReason });
                }
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
          send('error', { error: 'Stream interrupted' });
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
  } catch (err) {
    console.error('Chat handler failed:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
