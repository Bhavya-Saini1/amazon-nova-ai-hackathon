# Quick Start Guide

## 1️⃣ Environment Setup (5 minutes)

### Copy the example environment file
```bash
cp .env.local.example .env.local
```

### Fill in MongoDB URI
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click your cluster → Connect → Drivers
3. Copy the connection string
4. Paste into `MONGODB_URI` in `.env.local`
5. Replace `<password>` with your database password

**Example:**
```
MONGODB_URI=mongodb+srv://user:mypassword@cluster0.abc123.mongodb.net/hera?retryWrites=true&w=majority
```

### Fill in Auth0 credentials
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Click Applications → Applications
3. Click "hera" application
4. Copy the following from Settings:
   - **Domain** → `AUTH0_ISSUER_BASE_URL` (add `https://` prefix)
   - **Client ID** → `AUTH0_CLIENT_ID`
   - **Client Secret** → `AUTH0_CLIENT_SECRET`

5. Generate a secret for `AUTH0_SECRET`:
```bash
openssl rand -hex 32
```

**Example `.env.local`:**
```
MONGODB_URI=mongodb+srv://user:password@cluster0.abc123.mongodb.net/hera?retryWrites=true&w=majority
AUTH0_SECRET=a7b3c9d2e1f4g6h8i0j2k4l6m8n0o2p4
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=abc123xyz789
AUTH0_CLIENT_SECRET=secret_abc123xyz
```

---

## 2️⃣ Run the Application (1 minute)

### Install dependencies
```bash
npm install
```

### Start development server
```bash
npm run dev
```

### Open in browser
```
http://localhost:3000
```

---

## 3️⃣ Test the Features

### Test Login
1. Click "Login" button
2. Enter your Auth0 credentials
3. You should be redirected back to home page

### Create a Post
1. Click "Create Post"
2. Enter an incident description (required)
3. Optionally add a location
4. Click "Post Report"
5. You should see your post appear at the top of the feed

### View Your Profile
1. Click "Profile" in navigation
2. You should see all posts you created
3. Log out and log back in
4. Your posts should still be there

### View Community Feed
1. Home page shows all posts from all users
2. Posts are ordered by most recent first
3. "Trending Now" and "Near Me" tabs show the same data for now

---

## 📂 Key Files to Know

- **`.env.local`** - Your secrets (DO NOT COMMIT)
- **`app/page.tsx`** - Home page feed
- **`app/create-post/page.tsx`** - Post creation
- **`app/profile/page.tsx`** - User profile
- **`app/api/posts/route.ts`** - Post API
- **`lib/models/`** - Database schemas
- **`components/Navigation.tsx`** - Top nav with auth

---

## ✅ Checklist

- [ ] MongoDB URI added to `.env.local`
- [ ] Auth0 credentials added to `.env.local`
- [ ] `npm install` completed
- [ ] `npm run dev` running
- [ ] Can log in with Auth0
- [ ] Can create posts
- [ ] Posts appear on home feed
- [ ] Can view profile
- [ ] Can log out

---

## 🚨 Troubleshooting

**"Cannot find module mongoose"**
→ Run `npm install`

**"MONGODB_URI is not defined"**
→ Check `.env.local` has `MONGODB_URI=` with value

**"Unauthorized" on post creation**
→ Make sure you're logged in (click Login first)

**"Auth0 error"**
→ Verify Auth0 credentials in `.env.local`
→ Check callback URL is set to `http://localhost:3000/api/auth/callback` in Auth0

**Posts not appearing**
→ Check MongoDB connection
→ Check browser console for errors

---

## 📚 Full Documentation

For detailed API documentation and architecture, see:
- `README.md` - Full setup and API reference
- `IMPLEMENTATION_SUMMARY.md` - Complete implementation details

---

**You're ready to go! 🎉**
