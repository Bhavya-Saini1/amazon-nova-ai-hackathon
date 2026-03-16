import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type Message,
  type SystemContentBlock,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import { auth0 } from '@/lib/auth0';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL_ID = 'amazon.nova-lite-v1:0';

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
      'You are HeraBot, a safety and navigation assistant built into the Hera community safety app.',
      'You help users understand local safety incidents reported in their area.',
      'You can control the map interface by calling tools to pan to locations or filter incident markers.',
      'When a user mentions a city, neighborhood, or place, use focus_map to center the map there.',
      'When a user asks to see a specific type of incident (e.g. "show me groping reports"), use filter_incidents.',
      'Be concise, empathetic, and action-oriented. Always prioritize user safety.',
    ].join(' '),
  },
];

const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'focus_map',
      description:
        'Pan and zoom the map to a specific location. Use this when the user mentions a city, neighborhood, or address.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            latitude: {
              type: 'number',
              description: 'Latitude of the target location.',
            },
            longitude: {
              type: 'number',
              description: 'Longitude of the target location.',
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
        'Filter the incident markers shown on the map by category. Use "All" to remove filters and show every incident.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description:
                'Incident category to filter by, e.g. "Groping", "Ogling", "Commenting", or "All" to clear filters.',
            },
          },
          required: ['category'],
        },
      },
    },
  },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

  const command = new ConverseStreamCommand({
    modelId: MODEL_ID,
    system: SYSTEM_PROMPT,
    messages,
    toolConfig: { tools: TOOLS },
  });

  try {
    const response = await client.send(command);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        }

        try {
          if (!response.stream) {
            send('error', { error: 'No stream returned from Bedrock' });
            controller.close();
            return;
          }

          for await (const event of response.stream) {
            if (event.contentBlockStart?.start?.toolUse) {
              send('tool_use_start', {
                toolUseId: event.contentBlockStart.start.toolUse.toolUseId,
                name: event.contentBlockStart.start.toolUse.name,
              });
            }

            if (event.contentBlockDelta?.delta?.text) {
              send('text_delta', {
                text: event.contentBlockDelta.delta.text,
              });
            }

            if (event.contentBlockDelta?.delta?.toolUse) {
              send('tool_use_delta', {
                input: event.contentBlockDelta.delta.toolUse.input,
              });
            }

            if (event.contentBlockStop !== undefined) {
              send('content_block_stop', {});
            }

            if (event.messageStop) {
              send('message_stop', {
                stopReason: event.messageStop.stopReason,
              });
            }
          }
        } catch (err) {
          console.error('Bedrock stream error:', err);
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
    console.error('Bedrock ConverseStream failed:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to start chat stream' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
