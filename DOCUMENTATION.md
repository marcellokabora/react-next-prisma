# Product Catalog — Full Technical Documentation

> **Stack:** Next.js 16 · tRPC 11 · Prisma 7 · SQLite (via libSQL) · TanStack Query 5 · Zod 4 · Tailwind CSS 4 · TypeScript

---

## Table of Contents

1. [What the app does](#1-what-the-app-does)
2. [Tech stack explained](#2-tech-stack-explained)
3. [Project structure](#3-project-structure)
4. [Database layer — Prisma](#4-database-layer--prisma)
5. [API layer — tRPC](#5-api-layer--trpc)
6. [Frontend — React / Next.js](#6-frontend--react--nextjs)
7. [End-to-end data flow](#7-end-to-end-data-flow)
8. [Key concepts for the interview](#8-key-concepts-for-the-interview)

---

## 1. What the app does

A minimal **Product Catalog** CRUD application with two pages:

| Route            | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| `/`              | List all products, filter by category, add a new product, delete a product |
| `/products/[id]` | View the detail of a single product and delete it                          |

All data is persisted in an **SQLite database** through Prisma, and every client-server call goes through **tRPC** — there are no REST endpoints written by hand.

---

## 2. Tech stack explained

### Next.js 16

The React framework that provides:

- **App Router** — file-system based routing under `src/app/`.
- **API Routes** — server-side HTTP handlers under `src/app/api/`.
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

### TanStack Query (React Query) 5

A **data-fetching and caching library** for React.

- tRPC's React adapter is built on top of it.
- Manages loading states, caching, and cache invalidation.

### Zod 4

A **schema validation library** used to validate the input of every tRPC procedure before it reaches the database.

### libSQL / Turso adapter

SQLite accessed via the `@libsql/client` driver. The `@prisma/adapter-libsql` package is the Prisma driver adapter that bridges Prisma to libSQL.

---

## 3. Project structure

```
src/
├── app/                        ← Next.js App Router
│   ├── layout.tsx              ← Root layout, wraps every page with <Providers>
│   ├── page.tsx                ← Home page "/" (product list + form)
│   ├── providers.tsx           ← Sets up tRPC and React Query clients
│   ├── globals.css             ← Global styles (Tailwind)
│   ├── products/
│   │   └── [id]/
│   │       └── page.tsx        ← Product detail page "/products/:id"
│   └── api/
│       └── trpc/
│           └── [trpc]/
│               └── route.ts    ← Next.js HTTP handler that routes to tRPC
│
├── server/                     ← Server-only code (never imported by the browser)
│   ├── db.ts                   ← Prisma client singleton
│   ├── trpc.ts                 ← tRPC initialisation
│   └── routers/
│       ├── _app.ts             ← Root router (combines all sub-routers)
│       └── product.ts          ← All product-related procedures
│
├── trpc/
│   └── react.tsx               ← tRPC React client (browser-side)
│
└── generated/
    └── prisma/                 ← Auto-generated Prisma client (do not edit)

prisma/
├── schema.prisma               ← Database schema definition
└── migrations/                 ← SQL migration history
```

---

## 4. Database layer — Prisma

### 4.1 Schema — `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"   // where to write the generated client
}

datasource db {
  provider = "sqlite"                    // database engine
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  category    String
  description String?                    // optional field (nullable)
  createdAt   DateTime @default(now())
}
```

- The `generator` block tells Prisma to generate the TypeScript client into `src/generated/prisma/`.
- The `datasource` block declares the database engine (SQLite).
- Each `model` becomes a database table **and** a TypeScript type.

### 4.2 Migration — `prisma/migrations/20260519082738_init/migration.sql`

```sql
CREATE TABLE "Product" (
    "id"          INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name"        TEXT     NOT NULL,
    "price"       REAL     NOT NULL,
    "category"    TEXT     NOT NULL,
    "description" TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Prisma generated this SQL automatically from the schema. Running `prisma migrate dev` applies it to the database and records it in the `migrations/` folder so the history is version-controlled.

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

**`DATABASE_URL`** — the libSQL connection string stored in `.env` (e.g. `file:./dev.db` for a local file).

---

## 5. API layer — tRPC

### 5.1 tRPC initialisation — `src/server/trpc.ts`

```ts
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

- `initTRPC.create()` bootstraps tRPC. You can pass a `context` type here (e.g. for authentication); this app uses an empty context for simplicity.
- `router` is the factory for grouping procedures.
- `publicProcedure` is the base procedure builder. Every procedure in this app inherits from it.

### 5.2 Product router — `src/server/routers/product.ts`

```ts
export const productRouter = router({
  // QUERY — reads data, no side effects
  list: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ input }) =>
      db.product.findMany({
        where: input?.category ? { category: input.category } : undefined,
        orderBy: { createdAt: "desc" },
      }),
    ),

  categories: publicProcedure.query(async () => {
    const rows = await db.product.findMany({
      select: { category: true },
      distinct: ["category"],
    });
    return rows.map((r) => r.category);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.product.findUnique({ where: { id: input.id } })),

  // MUTATION — writes data, has side effects
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        price: z.number().positive(),
        category: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(({ input }) => db.product.create({ data: input })),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => db.product.delete({ where: { id: input.id } })),
});
```

| Procedure            | Type     | Input                                     | What it does                                          |
| -------------------- | -------- | ----------------------------------------- | ----------------------------------------------------- |
| `product.list`       | query    | `{ category? }`                           | Fetches all products, optionally filtered by category |
| `product.categories` | query    | none                                      | Returns all distinct category strings                 |
| `product.getById`    | query    | `{ id }`                                  | Fetches a single product by its numeric ID            |
| `product.create`     | mutation | `{ name, price, category, description? }` | Inserts a new product row                             |
| `product.delete`     | mutation | `{ id }`                                  | Deletes a product row                                 |

**Queries vs Mutations:**

- **Query** → HTTP `GET`, safe to cache, no side effects.
- **Mutation** → HTTP `POST`, changes data, not cached.

**Zod validation** runs on every input before the handler executes. If the input does not match the schema, tRPC returns a `400 Bad Request` with structured error details — no extra code needed.

### 5.3 Root router — `src/server/routers/_app.ts`

```ts
export const appRouter = router({ product: productRouter });
export type AppRouter = typeof appRouter;
```

- Combines all sub-routers into one `appRouter`.
- `AppRouter` is **exported as a type only** — the browser never imports the actual implementation. This is how tRPC keeps server code out of the client bundle.

### 5.4 HTTP handler — `src/app/api/trpc/[trpc]/route.ts`

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
```

- The file lives at `src/app/api/trpc/[trpc]/route.ts`. The `[trpc]` dynamic segment captures the procedure path (e.g. `product.list`).
- Next.js routes both `GET` and `POST` requests to the same handler.
- `fetchRequestHandler` is the tRPC adapter for the Web `fetch` API (used by Next.js App Router).
- `createContext` can return session data, database connections, etc. — here it returns an empty object.

---

## 6. Frontend — React / Next.js

### 6.1 tRPC React client — `src/trpc/react.tsx`

```ts
"use client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();
```

`createTRPCReact<AppRouter>()` generates a fully-typed React hook for every procedure defined in `AppRouter`. The generic type parameter `<AppRouter>` is the bridge — it is a **type import only**, so the actual server code never enters the browser bundle.

### 6.2 Provider setup — `src/app/providers.tsx`

```tsx
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: "/api/trpc" })],
    }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- **`QueryClient`** — the TanStack Query cache. One instance per browser session.
- **`trpcClient`** — the low-level HTTP client configured with `httpBatchLink`.
- **`httpBatchLink`** — automatically **batches** multiple tRPC calls that happen at the same time into a single HTTP request, reducing round-trips.
- Both providers wrap the entire app via `layout.tsx`.

### 6.3 Home page — `src/app/page.tsx`

```tsx
const products = trpc.product.list.useQuery({ category }); // reactive query
const categories = trpc.product.categories.useQuery();

const create = trpc.product.create.useMutation({
  onSuccess: () => {
    utils.product.list.invalidate(); // refetch product list
    utils.product.categories.invalidate(); // refetch category list
  },
});

const remove = trpc.product.delete.useMutation({
  onSuccess: () => {
    utils.product.list.invalidate();
    utils.product.categories.invalidate();
  },
});
```

- `useQuery` subscribes to data. React Query automatically refetches when needed.
- `useMutation` returns a `mutate` / `mutateAsync` function. `onSuccess` is called after the server confirms success.
- `utils.product.list.invalidate()` marks the cached query stale, causing an automatic background refetch — this is how the UI stays in sync after a create or delete without a full page reload.

### 6.4 Product detail page — `src/app/products/[id]/page.tsx`

```tsx
export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)          // React 19: unwrap async params
  const productId = parseInt(id, 10)
  ...
  const { data: product, isLoading, error } = trpc.product.getById.useQuery({ id: productId })
```

- Uses React 19's `use()` hook to unwrap the async `params` Promise provided by Next.js App Router.
- The same delete mutation invalidates the list cache and then navigates back to `/` with `router.push('/')`.

---

## 7. End-to-end data flow

Below is the full request lifecycle for **"user adds a product"**:

```
Browser
  │
  │  1. User fills the form and clicks "Add Product"
  │
  ▼
page.tsx
  │  create.mutate({ name, price, category, description })
  │
  ▼
@trpc/react-query (httpBatchLink)
  │  Serialises the call to:
  │  POST /api/trpc/product.create
  │  Body: { "0": { name, price, category, description } }
  │
  ▼
Next.js App Router
  │  Matches /api/trpc/[trpc] → route.ts
  │
  ▼
fetchRequestHandler (tRPC server)
  │  1. Parses the procedure path "product.create"
  │  2. Runs Zod validation on the input
  │  3. Calls the handler in product.ts
  │
  ▼
product.ts → publicProcedure.mutation
  │  db.product.create({ data: input })
  │
  ▼
Prisma Client
  │  Generates SQL: INSERT INTO "Product" (name, price, ...) VALUES (...)
  │
  ▼
libSQL / SQLite
  │  Executes the SQL, returns the new row
  │
  ▼  (response travels back up the chain)
  │
page.tsx — onSuccess callback
  utils.product.list.invalidate()       // triggers background refetch
  utils.product.categories.invalidate() // triggers background refetch
  setForm({ name:'', price:'', ... })   // resets the form
```

---

## 8. Key concepts for the interview

### Why tRPC instead of REST?

With REST you would write: a route handler, a `fetch` call, manual TypeScript types for the request/response, and error handling. With tRPC, the server function **is** the API. Types are inferred automatically — if you rename a field on the server, TypeScript immediately flags every broken call on the client.

### Why Prisma instead of raw SQL?

Prisma gives you:

- **Type safety** — queries return fully-typed objects matching your schema models.
- **Auto-complete** — your editor knows every field and relation.
- **Migrations** — schema changes are versioned and reproducible.
- **No SQL injection** — parameterised queries are used internally by default.

### What is `httpBatchLink`?

When a React component mounts and calls three queries at once, `httpBatchLink` merges them into a single HTTP request:

```
POST /api/trpc/product.list,product.categories
```

The server processes both and returns both responses together, cutting latency.

### How do types flow from server to client without sharing runtime code?

```
AppRouter (type only, exported from _app.ts)
    │
    │  imported as type in trpc/react.tsx
    │
createTRPCReact<AppRouter>()
    │
    generates typed hooks: trpc.product.list.useQuery(...)
```

The `AppRouter` type never reaches the browser bundle — TypeScript erases it at compile time. Only the tRPC client HTTP call code ships to the browser.

### What is cache invalidation and why does it matter?

TanStack Query caches every query by its key (e.g. `["product","list",{}]`). After a mutation succeeds, calling `utils.product.list.invalidate()` marks that cache entry as stale. React Query then automatically refetches in the background and updates the UI. This keeps the client in sync with the server without a full page reload or manual state management.

### Zod input validation

Every tRPC procedure that accepts input runs it through a Zod schema **on the server** before executing the handler. This means:

- Invalid data (e.g. a negative price) never reaches the database.
- The client gets structured error messages automatically.
- You get TypeScript types for `input` inside the handler for free, inferred from the Zod schema.
