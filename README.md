# Nexus 0 — Event Flow Platform

A minimal, realtime web platform designed to coordinate college tech symposiums and hackathons.
Teams log in with a code, receive a track assignment, submit a problem statement, and receive another team's statement via a cryptographic derangement shuffle triggered by the admin.

---

## ⚡ Tech Stack
- **Frontend**: React 18 (Vite), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, Zod
- **Backend & Database**: Supabase (PostgreSQL, Realtime, Row Level Security, `SECURITY DEFINER` RPCs, `pgcrypto`)
- **Hosting**: Netlify

---

## 🔄 Event Flow (State Machine)

1. **`setup`**: Admin configures tracks, registers teams, and curates problem statements.
2. **`tracks_assigned`**: Admin triggers "Generate Tracks". Teams are evenly distributed across tracks. Teams see their track live without page reload.
3. **`submissions_open`**: Admin opens the submission gate. Each team drafts and submits their problem statement (10–500 chars).
4. **`submissions_closed`**: Submissions are locked for review and pool verification.
5. **`statements_assigned`**: Admin triggers "Shuffle & Assign". A cryptographic derangement algorithm guarantees **no team receives its own problem statement**. Teams receive their assigned challenge live with zero author leakage.

---

## 🔒 Security Architecture

- **Row Level Security (RLS)**: Enforced on all tables (`teams`, `tracks`, `problem_statements`, `event_state`, `admin_credentials`, `sessions`, `auth_attempts`, `audit_logs`).
- **No Direct Table Mutation**: Anon/client keys have no direct write or sensitive read access. All mutations and access run through audited `SECURITY DEFINER` stored procedures.
- **Bcrypt & SHA-256**:
  - Admin passwords stored exclusively as salted bcrypt hashes (`crypt(..., gen_salt('bf', 10))`).
  - Team codes compared server-side.
- **Rate Limiting & Lockout**: Throttles brute-force attempts on both team codes and admin login (5 failed attempts trigger a 15-minute lockout logged in `auth_attempts`).
- **Anonymity Guarantee**: Team problem statement assignments return only `id` and `body`; author team metadata is stripped at the database query layer.

---

## 🛠️ Database Setup (Supabase)

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Run `supabase/migrations/20261118000000_nexus0_schema.sql`.

---

## 📦 Local Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Build for production
npm run build
```
