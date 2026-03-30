# Peer Tutoring

A peer-to-peer tutoring platform that connects students with mentors for academic support. Built as a full-stack web application with real-time matching, session management, and a community feed.

## Features

- **Authentication** — Email/password sign-up and sign-in via Supabase Auth
- **Role-based dashboards** — Separate views for students, mentors, and admins
- **Smart matching** — Algorithm matches students with mentors based on subject overlap
- **Session management** — Students request sessions, mentors accept/decline/complete
- **Ratings** — Students rate completed sessions; ratings feed into mentor profiles
- **Community feed** — School-wide activity feed with top mentor leaderboard
- **Profile management** — Editable profiles with subjects, bio, and availability

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, Tailwind CSS
- **Backend:** Supabase (Auth, Database, Row-Level Security)
- **Language:** TypeScript
- **Deployment:** Vercel

## Getting Started

```bash
# Clone the repo
git clone https://github.com/RidhimaG123/peer-tutoring.git
cd peer-tutoring

# Install dependencies
cd web && npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase credentials

# Run the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file in the `web/` directory:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
web/src/
├── app/
│   ├── auth/          # Sign in / sign up
│   ├── student/       # Student dashboard + mentor profiles
│   ├── mentor/        # Mentor dashboard + session management
│   ├── admin/         # Admin dashboard
│   ├── feed/          # Community feed + leaderboard
│   ├── layout.tsx     # Root layout with shared Nav
│   └── page.tsx       # Landing page
├── components/
│   └── Nav.tsx        # Shared navigation bar
└── lib/
    └── supabaseClient.ts
```

## Live Demo

[peer-tutoring-three.vercel.app](https://peer-tutoring-three.vercel.app)
