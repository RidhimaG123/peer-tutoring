# Project Status

## Current Release
- v1.0.0 — Demo Ready

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Foundation — repo setup, Next.js scaffold, dev script | ✅ Complete |
| 1 | Auth — Supabase email/password, session persistence, logout | ✅ Complete |
| 2 | Role system — student/mentor/admin roles, route protection | ✅ Complete |
| 3 | Profiles — editable profiles with subjects, bio, availability | ✅ Complete |
| 4 | Matching — daily mentor matching algorithm based on subject overlap | ✅ Complete |
| 5 | Sessions — request/accept/decline/complete workflow, time slots | ✅ Complete |
| 6 | Ratings & Feed — post-session ratings, community feed, leaderboard | ✅ Complete |
| 7 | Demo polish — shared Nav, loading states, copy cleanup, form labels | ✅ Complete |

## What Works

- Sign up / sign in / sign out with email and password
- Role-based routing (student → student dashboard, mentor → mentor dashboard)
- Student profiles with name, grade, subjects, bio, availability
- Mentor profiles with name, headline, subjects, bio, availability
- Daily matching algorithm that pairs students with mentors by subject overlap
- Rematch functionality
- Session request flow with time slot selection
- Mentor accept / decline / mark complete workflow
- Post-session star ratings (1–5)
- Mentor directory with subject and grade filtering
- Community feed showing completed session count, top mentors, recent activity
- Shared navigation bar across all pages
- Loading spinners on all protected pages
- Admin dashboard with role-based access control

## How to Run

```bash
./scripts/dev.sh
```

Or manually:

```bash
cd web && npm run dev
```
