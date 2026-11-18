# Security Model & Threat Assessment — Nexus 0

## 1. Threat Model & Design Principles

Nexus 0 was designed for high-stakes college hackathons and technical symposiums where participants may attempt to inspect network traffic, reverse engineer endpoints, discover track assignments prematurely, leak other teams' submissions, or brute-force administrative interfaces.

### Core Security Guarantees:
1. **Zero Anon Table Access**: Direct `SELECT`, `INSERT`, `UPDATE`, or `DELETE` using the Supabase publishable/anonymous key is restricted by PostgreSQL Row Level Security (RLS) on all sensitive tables (`teams`, `problem_statements`, `admin_credentials`, `sessions`, `auth_attempts`, `audit_logs`).
2. **Atomic Server-Side Logic**: Track generation and problem statement shuffling are executed purely within transactional `SECURITY DEFINER` stored procedures. No client-side shuffling or exposure of raw team pairings occurs.
3. **No Author Leakage**: When problem statements are distributed, the RPC strictly returns the problem statement's `body` and `id`. The author's team identifier and metadata are excluded at the database query level.
4. **Hashed Credentials**:
   - Team codes are stored and compared server-side with SHA-256 / crypt hashes.
   - Admin credentials are stored strictly as salted bcrypt hashes (`gen_salt('bf', 10)`). Plaintext passwords never touch logs, database columns, or client bundles.
5. **Rate Limiting & Lockout**: Failed authentication attempts are logged in `auth_attempts`. Consecutive failed attempts trigger a 15-minute lockout to mitigate brute-force attacks.
6. **Input Sanitization**: All team codes and problem statements are strictly validated on both client (Zod) and server (PostgreSQL regex and length bounds). Control characters and HTML injections are stripped.
7. **Session Token Architecture**: Authenticated sessions receive a high-entropy cryptographically random session token with bounded expiration times (2 to 4 hours).

## 2. Setup & Deployment Instructions

### Database Initialization:
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) for your project.
2. Navigate to **SQL Editor**.
3. Paste the contents of `supabase/migrations/20261118000000_nexus0_schema.sql` and run it.
4. (Optional) Run `supabase/seed.sql` to populate initial tracks, statements, and 30 sample teams.

### Initial Admin Credentials:
- Default admin password on initial seed: `adminnexus2026`
- **Important**: Change this password immediately after deployment via the **Settings** tab in `/admin/dashboard`.
