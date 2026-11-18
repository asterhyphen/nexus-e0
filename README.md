# Nexus 0 — Event Flow Platform

A minimal, beautiful, realtime web platform designed to coordinate college tech symposiums and hackathons.
Teams log in with a code, receive a track assignment, submit a problem statement, and receive another team's statement via a cryptographic derangement shuffle triggered by the admin.

---

## ⚡ Tech Stack
- **Frontend**: React 18 (Vite), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, Zod
- **Backend & Database**: Supabase (PostgreSQL, Realtime, Row Level Security, `SECURITY DEFINER` RPCs, `pgcrypto`)
- **Hosting**: Vercel

---

## 🚀 Live Demo & Accounts

- **Landing / Team Portal**: `/` or `/team`
  - Sample team codes: `NEX-1001`, `NEX-1002`, `NEX-1003` ... `NEX-1030`
- **Admin Portal**: `/admin`
  - Initial default password: `adminnexus2026`

---

## 🔄 Event Flow (State Machine)

1. **`setup`**: Admin configures tracks, registers teams (individually or bulk CSV), and seeds prompt statements.
2. **`tracks_assigned`**: Admin clicks "Generate Tracks". Teams are evenly distributed across tracks (enforcing `max_teams_per_track`). Teams see their track live without page reload.
3. **`submissions_open`**: Admin opens the submission gate. Each team can draft and submit their single problem statement (10–500 chars).
4. **`submissions_closed`**: Submissions are locked for review and pool verification.
5. **`statements_assigned`**: Admin triggers "Shuffle & Assign". A cryptographic derangement algorithm guarantees **no team receives its own problem statement**. Teams receive their assigned challenge live with zero author leakage.

---

## 🔒 Security Architecture (Highest Priority)

- **Row Level Security (RLS)**: Enforced on all tables (`teams`, `tracks`, `problem_statements`, `event_state`, `admin_credentials`, `sessions`, `auth_attempts`, `audit_logs`).
- **No Direct Table Mutation**: Anon/client keys have no direct write or sensitive read access. All mutations and access run through audited `SECURITY DEFINER` stored procedures.
- **Bcrypt & SHA-256**:
  - Admin passwords stored exclusively as salted bcrypt hashes (`crypt(..., gen_salt('bf', 10))`).
  - Team codes stored and matched server-side.
- **Rate Limiting & Lockout**: Throttles brute-force attempts on both team codes and admin login (5 failed attempts trigger a 15-minute lockout logged in `auth_attempts`).
- **Anonymity Guarantee**: Team problem statement assignments return only `id` and `body`; author team metadata is stripped at the database query layer.

---

## 🛠️ Database Setup (Supabase)

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Run the migration script:
   - `supabase/migrations/20261118000000_nexus0_schema.sql`
4. (Optional) Run the seed script for 6 sample tracks, 4 admin pool challenges, and 30 registered teams:
   - `supabase/seed.sql`

---

## 📦 Local Development

```bash
# Clone and enter directory
cd nexus

# Install dependencies
npm install

# Start local dev server
npm run dev

# Build for production
npm run build
```

---

## 🌐 Environment Variables

Stored in `.env`:
```env
VITE_SUPABASE_URL=https://dpkqovqavcauovdhlrhq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_5PU4VyyrXp7vge_zQ8zmEA_WV_kAj86
VITE_SUPABASE_ANON_KEY=sb_publishable_5PU4VyyrXp7vge_zQ8zmEA_WV_kAj86
```
