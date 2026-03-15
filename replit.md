# الرسائل الملكية — Royal Letters Platform

## Overview

A complete royal Arabic letter platform where Ahmed can write personalized letters to loved ones. Letters are locked behind custom security questions, opened via unique links, and displayed on beautiful parchment-style pages with royal Arabic fonts.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit built-in)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Tailwind CSS v4
- **Auth**: Cookie-based sessions (bcryptjs for password hashing)
- **Animations**: Framer Motion

## Fonts

- **Reem Kufi** — Headings, titles, page headers, seals (geometric royal)
- **Scheherazade New** — Letter body text (classical manuscript feel)
- **Cairo** — All UI elements (buttons, labels, navigation)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── royal-letters/      # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema + DB connection
└── scripts/
```

## Database Schema

Tables: `letters`, `questions`, `replies`, `admin_sessions`
- **letters**: id, title, body, recipientName, uniqueToken, isRead, readAt, language, status, createdAt, updatedAt
- **questions**: id, letterId, questionText, answerText, orderIndex
- **replies**: id, letterId, replyBody, replyFrom (admin replies use "__admin__"), createdAt
- **admin_sessions**: id, sessionToken, expiresAt, createdAt

## Environment Variables

Set these in Replit Secrets:
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `ADMIN_USERNAME` — Ahmed's username (default: "ahmed")
- `ADMIN_PASSWORD` — Plain text password for dev (use ADMIN_PASSWORD_HASH in production)
- `ADMIN_PASSWORD_HASH` — bcrypt hash of password (cost 12) for production
- `SECURITY_Q1` — First security question for admin login
- `SECURITY_A1` — Answer to Q1 (lowercase)
- `SECURITY_Q2` — Second security question for admin login
- `SECURITY_A2` — Answer to Q2 (lowercase)
- `SESSION_SECRET` — Random 64-char string for sessions

## API Routes

### Auth
- `GET /api/auth/security-questions` — Get admin security questions (public)
- `POST /api/auth/login` — Login with {username, password, securityAnswer1?, securityAnswer2?}
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Check session

### Letters (admin only)
- `GET /api/letters` — List all letters (filter by status, search)
- `POST /api/letters` — Create letter with questions
- `GET /api/letters/:id` — Get letter with answers (for admin editing)
- `PUT /api/letters/:id` — Update letter
- `DELETE /api/letters/:id` — Delete letter
- `POST /api/letters/:id/send` — Mark as sent
- `POST /api/letters/:id/admin-reply` — Admin reply to a letter

### Verify (public)
- `GET /api/verify/:token` — Get letter metadata + questions (no body)
- `POST /api/verify/:token/unlock` — Verify answers → unlock full letter

### Replies (public)
- `POST /api/replies` — Submit reply by recipient
- `GET /api/replies/:letterId` — Get replies (admin only)

## Pages

- `/` — Landing page with wax seal, token entry
- `/login` — Admin login (2-step: credentials → security questions)
- `/dashboard` — Admin dashboard: list letters, stats, read tracking
- `/compose` — Create new letter
- `/compose/:id` — Edit existing letter
- `/letters/:id` — Admin letter detail: view, see replies, reply back
- `/letter/:token` — Public letter view: security questions → parchment display → reply

## Security Features

1. Cookie-based HTTP-only session tokens (7-day expiry)
2. bcrypt password hashing (cost 12)
3. Admin 2-factor: password + 2 security questions (optional, via env vars)
4. Security question answers normalized (lowercase, trimmed) before comparison
5. Every letter access requires answering security questions again
6. Questions can be updated anytime by admin
7. Letter tokens are cryptographically random (20 bytes hex)
8. Session cleanup on expired tokens

## Design System

- **Theme**: Light mode only — aged parchment, warm ivory, royal gold, deep ink
- **Primary color**: Gold (#C9A84C and family)
- **Background**: Warm ivory (#FAF7F0)
- **Letter paper**: Parchment (#FAF7F0 with gradient overlay)
- **Wax seal**: Deep red with gold border
