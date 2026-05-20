# Product Catalog — Full Technical Documentation

> **Stack:** Next.js 16 · tRPC 11 · Prisma 7 · SQLite (via libSQL) · Zod 4 · Tailwind CSS 4 · TypeScript · bcryptjs · jose

---

## Table of Contents

1. [What the app does](#1-what-the-app-does)
2. [Tech stack explained](#2-tech-stack-explained)
3. [Project structure](#3-project-structure)
4. [Database layer — Prisma](#4-database-layer--prisma)
5. [Authentication](#5-authentication)
6. [API layer — tRPC](#6-api-layer--trpc)
7. [Server-side data fetching and caching](#7-server-side-data-fetching-and-caching)
8. [Frontend — React / Next.js](#8-frontend--react--nextjs)
9. [End-to-end data flows](#9-end-to-end-data-flows)

---

## 1. What the app does

A **Product Catalog** CRUD application with authentication. Users must register or log in before they can create, edit, or delete products. Products are owned by the user who created them.

| Route            | Auth required           | Description                                                     |
| ---------------- | ----------------------- | --------------------------------------------------------------- |
| `/`              | No (read) / Yes (write) | List all products, filter by category; add/delete require login |
| `/login`         | No                      | Combined sign-in / register form                                |
| `/products/[id]` | No (read) / Yes (write) | View product detail; edit/delete require ownership              |

All data is persisted in an **SQLite database** through Prisma. Mutations go through **tRPC** Server Actions — there are no REST endpoints written by hand. The home page uses **Next.js Data Cache** (`unstable_cache`) to protect the database from read spikes.

---

## 2. Tech stack explained

### Next.js 16

The React framework that provides:

- **App Router** — file-system based routing under `src/app/`.
- **API Routes** — server-side HTTP handlers under `src/app/api/`.
- **Server Actions** — async server functions called directly from client components via `'use server'` — used for all mutations (create, update, delete, login, register, logout).
- **Data Cache / `unstable_cache`** — a server-side in-memory cache that deduplicates and memoises database reads across requests.
- Server and client components coexist in the same project.

### Prisma 7

An **ORM (Object Relational Mapper)** for Node.js and TypeScript.

- You describe your database schema in a single `prisma/schema.prisma` file.
- Prisma generates a fully-typed client so you query the database with TypeScript objects instead of raw SQL.
- Migrations keep the database schema in sync with the Prisma schema.

### tRPC 11

A library for building **end-to-end type-safe APIs** without a schema language like GraphQL or OpenAPI.

- You define procedures (functions) on the server.
- The client calls those functions directly — TypeScript types flow from server to client automatically.
- Under the hood it communicates over HTTP, but you never write `fetch` calls manually.
- Procedures are split into `publicProcedure` (anyone) and `protectedProcedure` (logged-in users only).

### Zod 4

A **schema validation library** used to validate the input of every tRPC procedure and every Server Action before it reaches the database.

### bcryptjs

Used to **hash passwords** before storing them in the database and to verify passwords on login. Never stores plain-text passwords.

### jose

A pure-JavaScript library for working with **JSON Web Tokens (JWT)**. Used to sign and verify the session cookie that keeps users logged in.

### libSQL / Turso adapter

SQLite accessed via the `@libsql/client` driver. The `@prisma/adapter-libsql` package is the Prisma driver adapter that bridges Prisma to libSQL.

---

## 3. Project structure

```
src/
├── app/                        ← Next.js App Router
│   ├── layout.tsx              ← Root layout
│   ├── page.tsx                ← Home page "/" — server component, reads from cache
│   ├── globals.css             ← Global styles (Tailwind)
│   ├── _actions/
│   │   ├── auth.ts             ← Server Actions: login, register, logout
│   │   └── product.ts          ← Server Actions: createProduct, updateProduct, deleteProduct
│   ├── _components/
│   │   └── ProductsClient.tsx  ← Client component: catalog UI, optimistic updates
│   ├── login/
│   │   ├── page.tsx            ← Login / register page — server component
│   │   └── _components/
│   │       └── AuthForm.tsx    ← Client component: tabbed sign-in/register form
│   ├── products/
│   │   └── [id]/
│   │       ├── page.tsx        ← Product detail page — server component
│   │       ├── loading.tsx     ← Skeleton shown while the page streams
│   │       └── _components/
│   │           ├── ProductClient.tsx      ← Client component: detail UI
│   │           └── edit/
│   │               └── EditProductForm.tsx ← Client component: edit form
│   └── api/
│       └── trpc/
│           └── [trpc]/
│               └── route.ts    ← Next.js HTTP handler that routes to tRPC
│
├── server/                     ← Server-only code (never imported by the browser)
│   ├── db.ts                   ← Prisma client singleton
│   ├── queries.ts              ← unstable_cache wrapped Prisma queries
│   ├── trpc.ts                 ← tRPC initialisation, context type, publicProcedure, protectedProcedure
│   └── routers/
│       ├── _app.ts             ← Root router (combines all sub-routers)
│       └── product.ts          ← All product-related procedures
│
├── lib/
│   └── session.ts              ← JWT session: encrypt, decrypt, createSession, deleteSession, getSession
│
├── trpc/
│   ├── client.ts               ← Vanilla tRPC client (browser-side HTTP calls)
│   └── server.ts               ← Session-aware tRPC server-side caller
│
└── generated/
    └── prisma/                 ← Auto-generated Prisma client (do not edit)

prisma/
├── schema.prisma               ← Database schema definition
└── migrations/                 ← SQL migration history
    ├── 20260519082738_init/
    └── 20260520143304_add_user_auth/
```

---

## 4. Database layer — Prisma

### 4.1 Schema — `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model User {
  id             Int       @id @default(autoincrement())
  email          String    @unique
  hashedPassword String
  createdAt      DateTime  @default(now())
  products       Product[]
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  category    String
  description String?
  createdAt   DateTime @default(now())
  authorEmail String?
  author      User?    @relation(fields: [authorEmail], references: [email])
}
```

- `User` stores credentials. `hashedPassword` is a bcrypt hash — the plain-text password is never persisted.
- `Product.authorEmail` is a nullable foreign key back to `User.email`. Nullable so that products created before auth was added are still valid.
- The `author` / `products` fields are Prisma relation helpers — they don't create extra columns.

### 4.2 Migrations

**`20260519082738_init`** — initial schema, `Product` table only.

**`20260520143304_add_user_auth`** — adds the `User` table and the `authorEmail` foreign key column on `Product`:

```sql
CREATE TABLE "User" (
    "id"             INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email"          TEXT     NOT NULL,
    "hashedPassword" TEXT     NOT NULL,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Product table rebuilt to add the foreign key column
ALTER TABLE "new_Product" ADD COLUMN "authorEmail" TEXT
    REFERENCES "User"("email") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
```

`ON DELETE SET NULL` means deleting a user orphans their products rather than cascading the delete.

### 4.3 Prisma client singleton — `src/server/db.ts`

```ts
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Why the singleton pattern?**
During development, Next.js hot-reloads modules frequently. Without the singleton, every reload would open a new database connection, quickly exhausting the connection limit. Storing `db` on `globalThis` ensures only one instance is ever created per Node.js process.

---

## 5. Authentication

Authentication is implemented with **stateless JWT sessions** stored in an `httpOnly` cookie. There is no session table in the database.

### 5.1 Session management — `src/lib/session.ts`

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.SESSION_SECRET ?? "dev-secret-change-in-production-32ch";
const encodedKey = new TextEncoder().encode(secretKey);

// Signs a JWT containing userId + email, expires in 7 days
export async function encrypt(payload: SessionPayload) { ... }

// Verifies the JWT and returns the payload, or null if invalid/expired
export async function decrypt(session: string | undefined) { ... }

// Sets the signed JWT as an httpOnly cookie
export async function createSession(userId: number, email: string) {
  const token = await encrypt({ userId, email, expiresAt });
  cookieStore.set("session", token, { httpOnly: true, secure: true, sameSite: "lax" });
}

// Deletes the session cookie (logout)
export async function deleteSession() { ... }

// Reads and verifies the cookie — returns { userId, email } or null
export async function getSession() { ... }
```

**Key security properties:**

- `httpOnly: true` — the cookie is invisible to JavaScript; XSS attacks cannot steal it.
- `secure: true` in production — the cookie is only sent over HTTPS.
- `sameSite: 'lax'` — blocks cross-site POST requests (CSRF protection).
- The JWT is **signed** with `HS256` using `SESSION_SECRET`. Tampering with the payload invalidates the signature.

### 5.2 Auth Server Actions — `src/app/_actions/auth.ts`

All three actions are `'use server'` functions called directly from the `<AuthForm />` client component.

```ts
export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // 1. Validate email + password shape with Zod
  // 2. Look up the user by email
  // 3. bcrypt.compare(plainPassword, user.hashedPassword)
  // 4. If valid → createSession(user.id, user.email) → redirect('/')
  // 5. Otherwise → return { error: 'Invalid email or password.' }
}

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  // 1. Validate with stricter Zod schema (min 8 chars, 1 letter, 1 number)
  // 2. Check email is not already taken
  // 3. bcrypt.hash(password, 10)
  // 4. db.user.create({ data: { email, hashedPassword } })
  // 5. createSession(newUser.id, newUser.email) → redirect('/')
}

export async function logout(): Promise<void> {
  // deleteSession() → redirect('/login')
}
```

**Password validation rules (register only):**

- Minimum 8 characters
- At least one letter (`/[a-zA-Z]/`)
- At least one number (`/[0-9]/`)

### 5.3 Login page — `src/app/login/page.tsx`

A **server component** that checks for an existing session before rendering:

```ts
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/"); // already logged in → bounce to home
  return <AuthForm />;
}
```

### 5.4 Auth form — `src/app/login/_components/AuthForm.tsx`

A `'use client'` component with a tab switcher that toggles between **Sign in** and **Register** modes. Uses React 19's `useActionState` to wire up the Server Actions:

```ts
const [loginState, loginAction, isLoginPending] = useActionState<
  AuthState,
  FormData
>(login, {});
const [registerState, registerAction, isRegisterPending] = useActionState<
  AuthState,
  FormData
>(register, {});
```

- Field-level error messages (from `state.errors`) appear inline beneath each input.
- A general error banner (from `state.error`) covers cases like wrong password or duplicate email.
- The submit button is disabled while the action is pending.

---

## 6. API layer — tRPC

### 6.1 tRPC initialisation — `src/server/trpc.ts`

```ts
import { initTRPC, TRPCError } from "@trpc/server";

export type Context = {
  user: { id: number; email: string } | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

// Anyone can call a publicProcedure
export const publicProcedure = t.procedure;

// protectedProcedure rejects unauthenticated callers before the handler runs
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { user: ctx.user } });
});
```

`Context` carries the current user (or `null`). It is populated in `src/trpc/server.ts` from the session cookie and passed to every procedure call.

`protectedProcedure` is a **middleware** — it intercepts the call before the handler runs. If `ctx.user` is `null`, it throws `UNAUTHORIZED` immediately. If the user is present, TypeScript narrows `ctx.user` to non-null for the rest of the handler.

### 6.2 Product router — `src/server/routers/product.ts`

| Procedure            | Type     | Procedure type       | Input                                         | What it does                                       |
| -------------------- | -------- | -------------------- | --------------------------------------------- | -------------------------------------------------- |
| `product.list`       | query    | `publicProcedure`    | `{ category? }`                               | Fetches all products ordered by newest first       |
| `product.categories` | query    | `publicProcedure`    | none                                          | Returns all distinct category strings              |
| `product.getById`    | query    | `publicProcedure`    | `{ id }`                                      | Fetches a single product by numeric ID             |
| `product.create`     | mutation | `protectedProcedure` | `{ name, price, category, description? }`     | Inserts a product, sets `authorEmail` from session |
| `product.update`     | mutation | `protectedProcedure` | `{ id, name, price, category, description? }` | Updates a product; throws `FORBIDDEN` if not owner |
| `product.delete`     | mutation | `protectedProcedure` | `{ id }`                                      | Deletes a product; throws `FORBIDDEN` if not owner |

Ownership check (used by `update` and `delete`):

```ts
if (product.authorEmail && product.authorEmail !== ctx.user.email) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You can only edit your own products.",
  });
}
```

### 6.3 Root router — `src/server/routers/_app.ts`

```ts
export const appRouter = router({ product: productRouter });
export type AppRouter = typeof appRouter;
```

`AppRouter` is **exported as a type only** — the browser never imports the router implementation.

### 6.4 HTTP handler — `src/app/api/trpc/[trpc]/route.ts`

```ts
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
```

### 6.5 Session-aware server-side caller — `src/trpc/server.ts`

```ts
import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/session";

export const getCaller = cache(async () => {
  const session = await getSession();
  return createCaller({
    user: session ? { id: session.userId, email: session.email } : null,
  });
});
```

The caller reads the session cookie and forwards the user into the tRPC `Context`. This means `protectedProcedure` works correctly when procedures are called server-side from Server Actions.

---

## 7. Server-side data fetching and caching

### 7.1 The problem — read spikes

Every page load that hits the database directly adds latency and database load. On a high-traffic page (e.g. the home page showing all products), thousands of simultaneous visitors would each fire a separate `SELECT` query. The solution is to cache the query result on the server so the database is only queried once per time window, regardless of how many users arrive.

### 7.2 `unstable_cache` — `src/server/queries.ts`

```ts
import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";

export const getCachedProducts = unstable_cache(
  async () => db.product.findMany({ orderBy: { createdAt: "desc" } }),
  ["products-list"], // cache key
  { revalidate: 60, tags: ["products"] },
);
```

`unstable_cache` wraps any async function and stores its return value in the **Next.js Data Cache** (a server-side in-memory + disk store).

| Option       | Value               | Effect                                                                                                                               |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| cache key    | `['products-list']` | Uniquely identifies this cached entry                                                                                                |
| `revalidate` | `60`                | Cached result is served for up to 60 s; next request after expiry triggers background re-fetch (stale-while-revalidate)              |
| `tags`       | `['products']`      | Allows on-demand invalidation — any Server Action that mutates products calls `updateTag('products')` to bust this entry immediately |

**Result:** 10,000 simultaneous visitors all get the cached result. The database is only queried once per 60-second window — or immediately after a mutation.

### 7.3 Home page — `src/app/page.tsx`

```tsx
import { getCachedProducts } from "@/server/queries";
import { getSession } from "@/lib/session";

export default async function Page() {
  const [initialProducts, session] = await Promise.all([
    getCachedProducts(), // ← reads from cache, not the DB directly
    getSession(),
  ]);

  return (
    <ProductsClient
      initialProducts={initialProducts}
      currentUserEmail={session?.email ?? null}
    />
  );
}
```

The tRPC caller is **not used** for the initial page load. `getCachedProducts` queries Prisma directly through the cache wrapper. tRPC is reserved for client-side mutations.

### 7.4 Cache invalidation after mutations — `src/app/_actions/product.ts`

Every Server Action that writes to the database calls `updateTag('products')` immediately after the write succeeds:

```ts
import { revalidatePath, updateTag } from "next/cache";

// After create:
await caller.product.create(result.data);
updateTag("products"); // bust the products list cache

// After delete:
await caller.product.delete({ id });
updateTag("products");
revalidatePath(`/products/${id}`);

// After update:
await caller.product.update(result.data);
updateTag("products");
revalidatePath(`/products/${result.data.id}`);
```

`updateTag` is the Server Action variant of `revalidateTag`. It invalidates the `'products'` Data Cache entry so the very next page request re-runs the Prisma query and stores a fresh result.

### 7.5 Cache lifecycle diagram

```
GET / — first visitor
  getCachedProducts()
    └─ MISS → db.product.findMany() → result stored in Data Cache

GET / — next 10,000 visitors (within 60 s)
  getCachedProducts()
    └─ HIT → result returned from cache, DB not touched

POST mutation (Server Action)
  caller.product.create/update/delete()
    └─ updateTag('products') → cache entry invalidated

GET / — first visitor after mutation
  getCachedProducts()
    └─ MISS → db.product.findMany() → fresh result stored
```

You can verify this in the browser: run `next build && next start`, open DevTools → Network, and inspect the `X-Next-Cache` response header on the page request (`HIT`, `MISS`, or `STALE`).

---

## 8. Frontend — React / Next.js

### 8.1 Vanilla tRPC client — `src/trpc/client.ts`

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
```

`<AppRouter>` is a **type import only** — no server code enters the browser bundle. The client exposes a typed proxy: `trpc.product.create.mutate(...)`, etc.

### 8.2 Client components

- **`ProductsClient.tsx`** — catalog page UI. Receives `initialProducts` and `currentUserEmail` from the server page. Uses React 19 `useOptimistic` for instant create/delete feedback and `useActionState` to drive the Server Action form. The logged-in user's email is used to conditionally show edit/delete controls on their own products.

- **`AuthForm.tsx`** — combined sign-in / register form at `/login`. A tab switcher controls which `useActionState` pair (`login`/`register`) is active. Field errors and general errors flow back from the Server Actions.

- **`ProductClient.tsx`** — product detail UI. Edit/delete buttons are shown only if `currentUserEmail` matches the product's `authorEmail`.

- **`EditProductForm.tsx`** — pre-filled edit form wired to the `updateProduct` Server Action via `useActionState`.

### 8.3 Optimistic updates

`ProductsClient` uses `useOptimistic` to apply create and delete operations to the UI list **before** the Server Action resolves:

```ts
const [optimisticProducts, addOptimistic] = useOptimistic(
  initialProducts,
  (state, action: OptimisticAction) => {
    if (action.type === "delete")
      return state.filter((p) => p.id !== action.id);
    return [action.product, ...state];
  },
);
```

If the Server Action fails, React automatically rolls back the optimistic state to `initialProducts`.

---

## 9. End-to-end data flows

### 9.1 Page load (read path — cached)

```
Browser → GET /
  └─ Page server component
       ├─ getCachedProducts()        → Data Cache HIT/MISS → Prisma → SQLite
       └─ getSession()               → reads + verifies JWT cookie
  └─ <ProductsClient initialProducts={...} currentUserEmail={...} />
       └─ renders immediately with full data (no client-side fetch)
```

### 9.2 Register / Login

```
Browser → /login (GET)
  └─ LoginPage (server component)
       └─ getSession() → no session → renders <AuthForm />

User submits the register form
  └─ register() Server Action
       ├─ Zod validation
       ├─ db.user.findUnique({ where: { email } })   → check for duplicate
       ├─ bcrypt.hash(password, 10)
       ├─ db.user.create({ data: { email, hashedPassword } })
       ├─ createSession(userId, email)               → signs JWT, sets httpOnly cookie
       └─ redirect('/')
```

### 9.3 Create product (write path — cache bust)

```
User fills the form and clicks "Add Product"
  └─ createProduct() Server Action
       ├─ Zod validation
       ├─ getCaller()                    → tRPC caller with session context
       ├─ caller.product.create(data)
       │    └─ protectedProcedure        → ctx.user verified
       │    └─ db.product.create(...)    → INSERT INTO Product
       ├─ updateTag('products')          → busts Data Cache entry
       └─ (Next.js re-renders / revalidates the home page on next GET)

Client side (useOptimistic)
  └─ addOptimistic({ type: 'create', product: optimisticProduct })
       └─ list updates instantly, before the server round-trip completes
```
