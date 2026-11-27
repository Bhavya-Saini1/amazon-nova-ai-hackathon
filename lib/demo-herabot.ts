type MapAction = {
  type: string;
  payload: Record<string, unknown>;
};

type DemoReply = {
  text: string;
  mapActions: MapAction[];
};

const PLACES: Array<{
  names: string[];
  latitude: number;
  longitude: number;
  label: string;
  vibe: string;
}> = [
  {
    names: ['toronto', 'downtown', 'dt'],
    latitude: 43.6532,
    longitude: -79.3832,
    label: 'downtown Toronto',
    vibe: 'King/Queen corridors and transit hubs usually show more evening reports. Stick to well-lit main streets and busier TTC exits when you can.',
  },
  {
    names: ['mississauga', 'utm', 'square one'],
    latitude: 43.548,
    longitude: -79.6625,
    label: 'Mississauga / UTM',
    vibe: 'Campus edges and Square One get more foot traffic at night. Prefer lit paths near Residence Road and avoid isolated parking pockets after dark.',
  },
  {
    names: ['north york'],
    latitude: 43.7615,
    longitude: -79.4111,
    label: 'North York',
    vibe: 'Yonge and Sheppard stay comparatively busy. If you are transferring late, wait in staffed station areas rather than empty side streets.',
  },
  {
    names: ['scarborough'],
    latitude: 43.7731,
    longitude: -79.2578,
    label: 'Scarborough',
    vibe: 'Larger blocks mean longer walks between lit corridors. Plan routes along major arterials and share your ETA with someone you trust.',
  },
  {
    names: ['brampton'],
    latitude: 43.7315,
    longitude: -79.7624,
    label: 'Brampton',
    vibe: 'Downtown and transit plazas are usually the safer bet after dark. Keep to active storefront stretches when possible.',
  },
  {
    names: ['hamilton'],
    latitude: 43.2557,
    longitude: -79.8711,
    label: 'Hamilton',
    vibe: 'Gore Park and core transit links are higher-visibility. If you are heading up the mountain, stick to well-trafficked connectors.',
  },
  {
    names: ['kitchener', 'waterloo', 'kw'],
    latitude: 43.4643,
    longitude: -80.5204,
    label: 'Kitchener-Waterloo',
    vibe: 'Campus and uptown corridors stay active later. Between them, prefer main roads over cut-through paths.',
  },
  {
    names: ['london'],
    latitude: 42.9849,
    longitude: -81.2453,
    label: 'London ON',
    vibe: 'Richmond Row and downtown cores are generally busier. For quieter stretches, travel with a buddy when you can.',
  },
];

function findPlace(text: string) {
  const lower = text.toLowerCase();
  return PLACES.find((place) => place.names.some((name) => lower.includes(name)));
}

export function buildDemoHeraReply(messages: Array<{ role: string; content: string }>): DemoReply {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() || '';
  const place = findPlace(lastUser);

  if (place) {
    return {
      mapActions: [
        {
          type: 'focus_map',
          payload: {
            latitude: place.latitude,
            longitude: place.longitude,
            zoom: 13,
          },
        },
      ],
      text:
        `I moved the map to ${place.label}. ${place.vibe} ` +
        `If you want, ask about a nearby neighborhood and I can zoom there too.`,
    };
  }

  if (/safe|safety|night|walk|route|incident|report|danger|harass/i.test(lastUser)) {
    return {
      mapActions: [
        {
          type: 'focus_map',
          payload: { latitude: 43.589, longitude: -79.6441 },
        },
      ],
      text:
        'I centered the heatmap on the Mississauga corridor so you can scan recent activity. ' +
        'In general: prefer lit main streets, share your live location with a trusted contact, and ask me about a specific city for a tighter read.',
    };
  }

  return {
    mapActions: [],
    text:
      "I'm HeraBot in demo mode right now (live Nova is offline). " +
      'Ask about Toronto, Mississauga, Brampton, Hamilton, KW, or London and I will fly the map there with a quick safety read.',
  };
}

export function createDemoHeraStream(reply: DemoReply) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        for (const action of reply.mapActions) {
          send('map_action', action);
          await new Promise((r) => setTimeout(r, 120));
        }

        // Stream in small chunks so the UI feels live.
        const chunkSize = 24;
        for (let i = 0; i < reply.text.length; i += chunkSize) {
          send('text_delta', { text: reply.text.slice(i, i + chunkSize) });
          await new Promise((r) => setTimeout(r, 18));
        }

        send('message_stop', { stopReason: 'end_turn' });
      } finally {
        controller.close();
      }
    },
  });
}

export function shouldUseDemoHeraBot() {
  // Explicit override only — do not couple to auth DEMO_MODE.
  if (process.env.HERABOT_DEMO === 'true') {
    return true;
  }

  // No usable AWS credentials => force demo path.
  return !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY;
}
