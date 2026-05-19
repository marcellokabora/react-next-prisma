# Product Catalog — Full Technical Documentation

> **Stack:** Next.js 16 · tRPC 11 · Prisma 7 · SQLite (via libSQL) · TanStack Query 5 · Zod 4 · Tailwind CSS 4 · TypeScript

---

## Table of Contents

1. [What the app does](#1-what-the-app-does)
2. [Tech stack explained](#2-tech-stack-explained)
3. [Project structure](#3-project-structure)
4. [Database layer — Prisma](#4-database-layer--prisma)
5. [API layer — tRPC](#5-api-layer--trpc)
6. [SSR layer](#6-ssr-layer)
7. [Frontend — React / Next.js](#7-frontend--react--nextjs)
8. [End-to-end data flow](#8-end-to-end-data-flow)

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
│   ├── page.tsx                ← Home page "/" — server component, prefetches data
│   ├── providers.tsx           ← Sets up tRPC and React Query clients
│   ├── globals.css             ← Global styles (Tailwind)
│   ├── _components/
│   │   └── ProductsClient.tsx  ← Client component: catalog UI, tRPC hooks
│   ├── products/
│   │   └── [id]/
│   │       ├── page.tsx        ← Product detail page — server component, prefetches data
│   │       └── _components/
│   │           └── ProductClient.tsx ← Client component: detail UI, tRPC hooks
│   └── api/
│       └── trpc/
│           └── [trpc]/
│               └── route.ts    ← Next.js HTTP handler that routes to tRPC
│
├── server/                     ← Server-only code (never imported by the browser)
│   ├── db.ts                   ← Prisma client singleton
│   ├── trpc.ts                 ← tRPC initialisation + createCallerFactory
│   └── routers/
│       ├── _app.ts             ← Root router (combines all sub-routers)
│       └── product.ts          ← All product-related procedures
│
├── trpc/
│   ├── react.tsx               ← tRPC React client (browser-side hooks)
│   ├── server.ts               ← tRPC server-side caller + HydrateClient (SSR)
│   └── query-client.ts         ← Shared QueryClient factory
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
export const createCallerFactory = t.createCallerFactory;
```

- `initTRPC.create()` bootstraps tRPC. You can pass a `context` type here (e.g. for authentication); this app uses an empty context for simplicity.
- `router` is the factory for grouping procedures.
- `publicProcedure` is the base procedure builder. Every procedure in this app inherits from it.
- `createCallerFactory` produces a direct server-side caller used by the SSR layer to query the database without going through HTTP.

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

## 6. SSR layer

The SSR layer ensures that when a page is first loaded, the product data is already embedded in the HTML — no loading spinner, no client-side fetch on first render.

### 6.1 Shared QueryClient factory — `src/trpc/query-client.ts`

```ts
import { QueryClient } from "@tanstack/react-query";

export const createQueryClient = () => new QueryClient();
```

A single factory used by both the server (`src/trpc/server.ts`) and the client (`providers.tsx`) so both sides create QueryClient instances with the same configuration.

### 6.2 Server-side tRPC helpers — `src/trpc/server.ts`

```ts
import "server-only";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { cache } from "react";
import { createQueryClient } from "./query-client";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);
const getQueryClient = cache(createQueryClient);

export const { trpc, HydrateClient } = createHydrationHelpers<AppRouter>(
  createCaller({}),
  getQueryClient,
);
```

- `'server-only'` — prevents this module from ever being imported in the browser bundle.
- `createCaller({})` — a direct tRPC caller that invokes procedures **in-process** (no HTTP, no `/api/trpc` round-trip).
- `cache(createQueryClient)` — React's `cache()` ensures the same `QueryClient` instance is reused across the entire server render of one request.
- `createHydrationHelpers` (from `@trpc/react-query/rsc`) returns:
  - **`trpc`** — a server-side proxy with `.prefetch()` methods that call the DB and populate the server QueryClient.
  - **`HydrateClient`** — a React component that serialises the server QueryClient into the HTML via `dehydrate`, and on the client deserialises it back into the client QueryClient via `HydrationBoundary`.

### 6.3 How a server page uses the SSR layer

```tsx
// src/app/page.tsx — server component (no 'use client')
import { trpc, HydrateClient } from "@/trpc/server";
import ProductsClient from "./_components/ProductsClient";

export default async function Page() {
  await Promise.all([
    trpc.product.list.prefetch({}),
    trpc.product.categories.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ProductsClient />
    </HydrateClient>
  );
}
```

1. `await Promise.all([...prefetch()])` — fetches data directly from the DB and stores it in the server QueryClient. Must be awaited so data is ready before `HydrateClient` renders.
2. `<HydrateClient>` — dehydrates the server QueryClient and embeds the data in the HTML.
3. `<ProductsClient />` — the `'use client'` component that contains all the interactive UI and tRPC hooks. It runs on the server too (for HTML generation), finds the prefetched data in context, and renders the full product list. On the client, it rehydrates from the embedded data — no extra fetch.

---

## 7. Frontend — React / Next.js

### 7.1 tRPC React client — `src/trpc/react.tsx`

```ts
"use client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();
```

`createTRPCReact<AppRouter>()` generates a fully-typed React hook for every procedure defined in `AppRouter`. The generic type parameter `<AppRouter>` is the bridge — it is a **type import only**, so the actual server code never enters the browser bundle.

### 7.2 Provider setup — `src/app/providers.tsx`

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

### 7.3 Client components

All interactive UI lives in `'use client'` components under `_components/`:

- **`src/app/_components/ProductsClient.tsx`** — catalog page UI: product grid, category filter, add form, delete buttons. Uses `trpc.product.list.useQuery`, `trpc.product.categories.useQuery`, `trpc.product.create.useMutation`, and `trpc.product.delete.useMutation`.
- **`src/app/products/[id]/_components/ProductClient.tsx`** — product detail UI: displays product data and a delete button. Uses `trpc.product.getById.useQuery` and `trpc.product.delete.useMutation`.

Both receive their initial data instantly from the cache populated by `HydrateClient`. After mutations, `utils.product.list.invalidate()` marks the cache stale and triggers a background refetch to keep the UI in sync.

---

## 8. End-to-end data flow

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
