import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';
import { serializePost } from '@/lib/posts';

export const dynamic = 'force-dynamic';

const MODEL_ID = 'amazon.nova-lite-v1:0';

// ---------------------------------------------------------------------------
// Bedrock client — credentials are picked up from env vars automatically:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
// ---------------------------------------------------------------------------
function getBedrockClient() {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

interface IncidentAnalysis {
  severity_index: number;
  categories: string[];
}

async function analyzeIncident(text: string): Promise<IncidentAnalysis> {
  const client = getBedrockClient();

  const input: ConverseCommandInput = {
    modelId: MODEL_ID,
    messages: [
      {
        role: 'user',
        content: [
          {
            text: `You are a safety incident classifier. Analyze the following incident report and call the categorize_incident tool with your assessment.\n\nIncident report:\n"""\n${text}\n"""`,
          },
        ],
      },
    ],
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name: 'categorize_incident',
            description:
              'Classify a harassment or safety incident report by severity and category.',
            inputSchema: {
              json: {
                type: 'object',
                properties: {
                  severity_index: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    description:
                      'Overall severity on a scale of 1 (minor) to 10 (extreme/life-threatening).',
                  },
                  categories: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                      'List of harassment types that apply, e.g. ["verbal_harassment", "stalking", "sexual_harassment"].',
                  },
                },
                required: ['severity_index', 'categories'],
              },
            },
          },
        },
      ],
      toolChoice: { tool: { name: 'categorize_incident' } },
    },
  };

  const response = await client.send(new ConverseCommand(input));

  // Extract the tool-use block from the response
  const toolUseBlock = response.output?.message?.content?.find(
    (block) => block.toolUse !== undefined
  );

  if (!toolUseBlock?.toolUse?.input) {
    throw new Error('Nova did not return a tool-use response');
  }

  const toolInput = toolUseBlock.toolUse.input as Record<string, unknown>;
  const severity_index = Number(toolInput.severity_index);
  const categories = Array.isArray(toolInput.categories)
    ? (toolInput.categories as string[])
    : [];

  if (!Number.isInteger(severity_index) || severity_index < 1 || severity_index > 10) {
    throw new Error(`Invalid severity_index from model: ${severity_index}`);
  }

  return { severity_index, categories };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseNumericCoordinate(value: unknown, maxAbs: number): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > maxAbs) return null;
  return n;
}

// ---------------------------------------------------------------------------
// GET — list all posts
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    await connectDB();
    const posts = await Post.find({})
      .populate('user_id', 'username email auth0_id')
      .sort({ created_at: -1 })
      .lean()
      .exec();

    return NextResponse.json(posts.map(serializePost), { status: 200 });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new incident report
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ error: '`text` is required' }, { status: 400 });
    }

    const latitude = parseNumericCoordinate(body.latitude, 90);
    const longitude = parseNumericCoordinate(body.longitude, 180);

    if (latitude === null || longitude === null) {
      return NextResponse.json(
        { error: '`latitude` and `longitude` are required numeric values' },
        { status: 400 }
      );
    }

    const is_anonymous = Boolean(body.is_anonymous);

    // Call Amazon Nova via Bedrock to classify the incident
    const { severity_index, categories } = await analyzeIncident(text);

    await connectDB();

    const user = await findOrCreateUserFromSessionUser(session.user);
    if (!hasCompleteProfile(user)) {
      return NextResponse.json(
        { error: 'Complete your profile before posting.' },
        { status: 403 }
      );
    }

    // GeoJSON Point — longitude first, then latitude (GeoJSON spec + MongoDB 2dsphere)
    const location = {
      type: 'Point' as const,
      coordinates: [longitude, latitude] as [number, number],
    };

    const post = await Post.create({
      user_id: user._id,
      raw_text: text,
      categories,
      severity_index,
      is_anonymous,
      location,
    });

    await post.populate('user_id', 'username email auth0_id');

    return NextResponse.json(serializePost(post.toObject()), { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
