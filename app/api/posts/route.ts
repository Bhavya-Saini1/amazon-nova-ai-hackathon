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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL_ID = 'amazon.nova-lite-v1:0';
const CATEGORY_SERVICE_URL =
  process.env.CATEGORY_SERVICE_URL ?? 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// Bedrock client
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

// ---------------------------------------------------------------------------
// Step 1 — Local category model (FastAPI at :8000/predict)
// ---------------------------------------------------------------------------
interface CategoryPrediction {
  category: string;
  score: number;
}

async function fetchCategories(text: string): Promise<string[]> {
  const res = await fetch(`${CATEGORY_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Category service responded with ${res.status}`);
  }

  const data = (await res.json()) as { predictions: CategoryPrediction[] };
  return data.predictions.map((p) => p.category);
}

// ---------------------------------------------------------------------------
// Steps 2 + 3 — Bedrock Nova severity assessment (with categories as context)
// ---------------------------------------------------------------------------
async function assessSeverity(
  text: string,
  categories: string[]
): Promise<number> {
  const client = getBedrockClient();

  const prompt = [
    'You are a safety incident severity assessor.',
    'An incident report has already been classified into the following categories by our category model:',
    `  Categories: ${JSON.stringify(categories)}`,
    '',
    'Given the original report text AND these categories, call the assess_severity tool with the appropriate severity rating.',
    '',
    'Incident report:',
    '"""',
    text,
    '"""',
  ].join('\n');

  const input: ConverseCommandInput = {
    modelId: MODEL_ID,
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name: 'assess_severity',
            description:
              'Assign a severity rating to an incident report that has already been categorized.',
            inputSchema: {
              json: {
                type: 'object',
                properties: {
                  severity_index: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10,
                    description:
                      'Overall severity on a scale of 1 (minor annoyance) to 10 (extreme / life-threatening).',
                  },
                },
                required: ['severity_index'],
              },
            },
          },
        },
      ],
      toolChoice: { tool: { name: 'assess_severity' } },
    },
  };

  const response = await client.send(new ConverseCommand(input));

  const toolUseBlock = response.output?.message?.content?.find(
    (block) => block.toolUse !== undefined
  );

  if (!toolUseBlock?.toolUse?.input) {
    throw new Error('Nova did not return a tool-use response');
  }

  const toolInput = toolUseBlock.toolUse.input as Record<string, unknown>;
  const severity_index = Number(toolInput.severity_index);

  if (
    !Number.isInteger(severity_index) ||
    severity_index < 1 ||
    severity_index > 10
  ) {
    throw new Error(`Invalid severity_index from model: ${severity_index}`);
  }

  return severity_index;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseNumericCoordinate(
  value: unknown,
  maxAbs: number
): number | null {
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
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create a new incident report (dual-model pipeline)
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
      return NextResponse.json(
        { error: '`text` is required' },
        { status: 400 }
      );
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

    // --- Step 1: Categories from local FastAPI model -----------------------
    let categories: string[];
    try {
      categories = await fetchCategories(text);
    } catch (err) {
      console.error('Category service unreachable, falling back to empty:', err);
      categories = [];
    }

    // --- Steps 2+3: Severity from Bedrock Nova (with categories context) ---
    const severity_index = await assessSeverity(text, categories);

    // --- Step 4: Save to MongoDB -------------------------------------------
    await connectDB();

    const user = await findOrCreateUserFromSessionUser(session.user);
    if (!hasCompleteProfile(user)) {
      return NextResponse.json(
        { error: 'Complete your profile before posting.' },
        { status: 403 }
      );
    }

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
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
