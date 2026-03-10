# Hera - Women's Safety Platform

A community-driven web application for reporting and tracking safety incidents to keep women safe.

## Features

- **Report Incidents**: Users can submit detailed reports about safety concerns
- **Community Feed**: View trending reports and nearby incidents
- **User Profiles**: Track your submitted reports
- **Secure Authentication**: Auth0 integration for user management
- **Database**: MongoDB for persistent storage

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: MongoDB with Mongoose
- **Authentication**: Auth0

## Prerequisites

- Node.js 18+ and npm
- MongoDB database (Atlas or local)
- Auth0 application

## Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd amazon-nova-ai-hackathon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.local.example` to `.env.local`
   - Fill in all required values (see configuration section below)

4. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the application.

## Environment Configuration

You need to set up the following environment variables in `.env.local`:

### MongoDB

**Where to find it:**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Log in to your account
3. Navigate to your cluster
4. Click "Connect" → "Drivers"
5. Copy the connection string

**In `.env.local`:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hera?retryWrites=true&w=majority
```

Replace `username`, `password`, and `cluster` with your actual MongoDB Atlas values.

### Auth0

**Where to find it:**
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to Applications → Applications
3. Find or create the application named "hera"
4. Click on it to view settings

**In `.env.local`:**

```
AUTH0_SECRET=<generated-secret>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-domain.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
```

- **AUTH0_SECRET**: Generate a random secret (32+ characters). You can generate one with: `openssl rand -hex 32`
- **AUTH0_ISSUER_BASE_URL**: Found in your Auth0 application settings as "Domain" with `https://` prefix
- **AUTH0_CLIENT_ID**: Found in Auth0 application settings
- **AUTH0_CLIENT_SECRET**: Found in Auth0 application settings

## Project Structure

```
app/
├── api/
│   ├── auth/[auth0]/route.ts      # Auth0 endpoints
│   └── posts/
│       ├── route.ts               # GET (all posts), POST (create post)
│       └── user/route.ts           # GET (user's posts)
├── create-post/
│   └── page.tsx                   # Create incident report page
├── profile/
│   └── page.tsx                   # User profile page
├── layout.tsx                     # Root layout with Auth0 provider
└── page.tsx                       # Home page / Feed

components/
├── Navigation.tsx                 # Top navigation bar
└── PostCard.tsx                   # Reusable post card component

lib/
├── db/
│   └── mongodb.ts                 # MongoDB connection utility
└── models/
    ├── User.ts                    # User schema
    └── Post.ts                    # Post schema

.env.local.example                 # Example environment file
```

## API Routes

### Posts API

**GET `/api/posts`**
- Fetch all posts (home feed)
- Returns: Array of posts sorted by most recent

**POST `/api/posts`**
- Create a new post (requires authentication)
- Body: `{ raw_text: string, location_text?: string }`
- Returns: Created post object

**GET `/api/posts/user`**
- Fetch authenticated user's posts
- Requires: User to be logged in
- Returns: Array of user's posts

### Auth API

**GET `/api/auth/login`**
- Redirect to Auth0 login page

**GET `/api/auth/logout`**
- Log out and redirect to home

**GET `/api/auth/callback`**
- Auth0 callback endpoint (automatic)

**GET `/api/auth/me`**
- Get current user session info

## Data Models

### User

```typescript
{
  auth0_id: string,        // Auth0 user ID
  email: string,           // User email
  name: string,            // User display name
  created_at: Date         // Account creation time
}
```

### Post

```typescript
{
  user_id: ObjectId,       // Reference to User
  raw_text: string,        // Incident description
  category: string | null, // Will be filled by ML model
  severity: string | null, // Will be filled by ML model
  location_text: string,   // User-provided location text
  latitude: number | null, // Will be geocoded later
  longitude: number | null,// Will be geocoded later
  created_at: Date         // Post creation time
}
```

## Future Features

The following are planned but not yet implemented:

- **ML Classification**: Automatic categorization and severity detection
- **Amazon Nova Agent**: Location extraction and normalization
- **Geocoding**: Convert location text to coordinates
- **Risk Engine**: Calculate geographic risk from incident density
- **Heatmap**: Visualize risk areas on a map
- **Route Planning**: Find safer routes between locations
- **Alerts**: Notify users about incident hotspots
- **Location-based filtering**: "Near Me" feed with actual geospatial filtering

## Development Notes

- The `category`, `severity`, `latitude`, and `longitude` fields on posts are nullable and will be populated by future ML/Nova agent services
- The "Near Me" tab currently shows the same data as "Trending Now" until geospatial filtering is implemented
- Posts are ordered by creation time (most recent first)

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Run production server
npm run lint     # Run ESLint
```

## License

See LICENSE file for details.
