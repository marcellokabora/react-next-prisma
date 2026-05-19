# Full-Stack Interview Prep — Product Catalog App

> Use this file to rehearse. Each question has a **short answer** (what to say first)
> and a **deep dive** (extra detail if the interviewer follows up).

---

## Table of Contents

1. [Architecture & Backend](#1-architecture--backend)
2. [Prisma & Database](#2-prisma--database)
3. [tRPC & API Design](#3-trpc--api-design)
4. [Next.js & Full-Stack Pattern](#4-nextjs--full-stack-pattern)
5. [Frontend & Data Fetching](#5-frontend--data-fetching)
6. [TypeScript & Type Safety](#6-typescript--type-safety)
7. [Security](#7-security)
8. [Performance](#8-performance)
9. [Testing (how you would approach it)](#9-testing-how-you-would-approach-it)
10. [Common "What would you improve?" questions](#10-common-what-would-you-improve-questions)

---

## 1. Architecture & Backend

---

### Q: Where is the backend in this app?

**Short answer:**
There is no separate backend server. The backend lives inside the same Next.js project under `src/server/`. Next.js executes that code on the server when a request arrives at `/api/trpc/...`.

**Deep dive:**

- `src/server/db.ts` — Prisma client (database layer)
- `src/server/trpc.ts` — tRPC initialisation
- `src/server/routers/product.ts` — all business logic (list, create, delete, getById)
- `src/app/api/trpc/[trpc]/route.ts` — the HTTP entry point that bridges Next.js to tRPC

Code in `src/server/` is **never imported** by client components, so it never ships to the browser.

---

### Q: What is a full-stack monorepo / monolith pattern?

**Short answer:**
One codebase handles both the UI and the API. They share types but the runtime code is separated — server code runs on Node.js, client code runs in the browser.

**Deep dive:**
In this app the boundary is enforced by:

1. `src/server/` is only imported server-side.
2. `AppRouter` is imported as a **TypeScript type only** on the client — TypeScript erases it at compile time so no server code reaches the browser bundle.
3. Next.js statically analyses imports and tree-shakes server-only modules out of client bundles.

---

### Q: How does a request travel from the browser to the database?

**Short answer:**
Browser → vanilla tRPC client → HTTP POST to `/api/trpc/product.X` → Next.js route handler → tRPC router → Prisma → SQLite.

**Step by step:**

```
1. User clicks "Add Product"
2. await trpc.product.create.mutate({ name, price, ... })   [ProductsClient.tsx]
3. httpBatchLink serialises it to:
   POST /api/trpc/product.create
   Body: { "0": { name, price, ... } }
4. Next.js routes to src/app/api/trpc/[trpc]/route.ts
5. fetchRequestHandler parses the procedure path "product.create"
6. Zod validates the input
7. Handler in product.ts executes: db.product.create({ data: input })
8. Prisma WASM compiler generates SQL: INSERT INTO "Product" ...
9. libSQL driver sends SQL to SQLite
10. Row is inserted, response travels back
11. Component awaits the result, then re-fetches list and categories
12. setProducts() / setCategories() update local React state — UI updates
```

---

### Q: What is the role of `route.ts` at `/api/trpc/[trpc]`?

**Short answer:**
It is the HTTP entry point. It receives every tRPC request and hands it to the tRPC server handler.

**Deep dive:**

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

- The `[trpc]` dynamic segment captures the procedure path (e.g. `product.list`).
- Both `GET` (queries) and `POST` (mutations) are handled by the same function.
- `createContext` is where you would inject authentication, session, or request data that procedures can access.

---

## 2. Prisma & Database

---

### Q: What is Prisma and why use it instead of raw SQL?

**Short answer:**
Prisma is a TypeScript ORM. You define a schema, it generates a type-safe client. You get auto-complete, compile-time error checking, and protection against SQL injection — without writing SQL by hand.

**Deep dive:**
Benefits over raw SQL:

- **Type safety** — `db.product.findMany()` returns `Product[]`, not `any[]`.
- **Migrations** — schema changes are versioned, reproducible, and tracked in Git.
- **No SQL injection** — all queries are parameterised internally.
- **DX** — rename a field in the schema, TypeScript immediately shows every broken call site.

Trade-offs:

- Adds an abstraction layer; complex queries (e.g. recursive CTEs) can be awkward.
- Generated client adds to cold start time on serverless functions.

---

### Q: What is a Prisma migration and when do you run it?

**Short answer:**
A migration is a versioned SQL file that describes a schema change. You run `prisma migrate dev` during development and `prisma migrate deploy` in production.

**Deep dive:**

| Command                     | When                                 | What it does                                                |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `npx prisma migrate dev`    | Development                          | Generates new SQL file, applies it, regenerates client      |
| `npx prisma migrate deploy` | Production / CI                      | Applies pending migrations only, never creates new ones     |
| `npx prisma generate`       | After pulling someone else's changes | Regenerates `src/generated/prisma/` without touching the DB |

The `migrations/` folder is committed to Git so every developer and every environment applies the exact same SQL in the exact same order.

**This app does NOT auto-run migrations on start.** A production best practice would be:

```json
"start": "prisma migrate deploy && next start"
```

---

### Q: What is the Prisma singleton pattern and why is it needed?

**Short answer:**
It stores the Prisma client on `globalThis` so only one instance is created per Node.js process, preventing connection exhaustion during hot reloads.

**Deep dive:**

```ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

During development, Next.js hot-reloads changed modules but keeps the Node.js process alive. Without the singleton, each reload imports the module fresh and opens a new database connection. SQLite and serverless databases like Turso have connection limits — this pattern prevents hitting them.

In production, modules are only loaded once, so the guard (`!== 'production'`) is technically unnecessary but adds clarity.

---

### Q: What is the difference between `prisma/schema.prisma` and the `generated/` folder?

**Short answer:**
The schema is what **you write**. The generated folder is what **Prisma writes** from your schema. You never edit the generated folder.

**Deep dive:**

- `schema.prisma` is the single source of truth — models, relations, database provider.
- Running `prisma generate` reads the schema and produces:
  - TypeScript types for every model
  - The `PrismaClient` class
  - A WASM query compiler bundled with SQLite support
  - Aggregate, input, and filter types for advanced queries

---

### Q: What is libSQL / Turso and why is it used here?

**Short answer:**
libSQL is an open-source fork of SQLite with a network protocol. It lets you use SQLite locally in development and on a remote Turso cloud database in production without changing any application code.

**Deep dive:**
`DATABASE_URL` controls which mode is used:

- `file:./dev.db` → local file (development)
- `libsql://your-db.turso.io?authToken=...` → remote Turso instance (production)

The `@prisma/adapter-libsql` driver adapter translates Prisma's internal query format to the libSQL wire protocol.

---

## 3. tRPC & API Design

---

### Q: What is tRPC and how is it different from REST?

**Short answer:**
tRPC lets you call server functions from the client with full TypeScript type safety. You don't define URL routes, HTTP methods, or request/response shapes manually — they are inferred from the function signatures.

**Deep dive:**

|                | REST                                                    | tRPC                                          |
| -------------- | ------------------------------------------------------- | --------------------------------------------- |
| API contract   | OpenAPI spec / manual types                             | TypeScript types, inferred automatically      |
| Client code    | `fetch('/api/products', { method: 'POST', body: ... })` | `trpc.product.create.mutate({ name, price })` |
| Type safety    | Manual / code-gen                                       | Automatic, compile-time                       |
| Learning curve | Low                                                     | Medium                                        |
| Best for       | Public APIs, multi-language clients                     | Internal full-stack TypeScript apps           |

---

### Q: What is the difference between a query and a mutation in tRPC?

**Short answer:**
A query reads data (maps to HTTP GET, is cached). A mutation writes data (maps to HTTP POST, is not cached).

**Deep dive:**

In this app:

- **Queries:** `product.list`, `product.categories`, `product.getById`
- **Mutations:** `product.create`, `product.delete`

On the client, `useQuery` subscribes and auto-refetches. `useMutation` returns a `mutate` function you call explicitly, plus `onSuccess` / `onError` callbacks.

---

### Q: What is Zod and how does it work with tRPC?

**Short answer:**
Zod is a schema validation library. In tRPC you chain `.input(zodSchema)` onto a procedure, and tRPC automatically validates every incoming request against that schema before your handler runs.

**Deep dive:**

```ts
create: publicProcedure
  .input(
    z.object({
      name: z.string().min(1), // non-empty string
      price: z.number().positive(), // must be > 0
      category: z.string().min(1),
      description: z.string().optional(),
    }),
  )
  .mutation(({ input }) => db.product.create({ data: input }));
```

If the input is invalid, tRPC returns a structured `400` error before the handler is called. The `input` object inside the handler is fully typed — TypeScript infers its shape directly from the Zod schema.

---

### Q: What is `httpBatchLink` and why does it matter?

**Short answer:**
It batches multiple tRPC calls that fire at the same time into a single HTTP request, reducing round-trips.

**Deep dive:**
When the home page mounts it calls both `product.list` and `product.categories` simultaneously. Without batching that is 2 HTTP requests. With `httpBatchLink` they are merged:

```
POST /api/trpc/product.list,product.categories
```

The server processes both and returns both responses together. This is particularly important on slow connections or serverless environments where each request has cold-start overhead.

---

### Q: What is tRPC context and what would you put in it?

**Short answer:**
Context is an object created per-request that is passed to every procedure. Typical contents are the authenticated user, the database client, or the request headers.

**Deep dive:**
Currently this app uses an empty context:

```ts
createContext: () => ({});
```

In a real app you would do:

```ts
createContext: async ({ req }) => {
  const session = await getSession(req);
  return { session, db };
};
```

Then inside a procedure:

```ts
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx });
});
```

---

## 4. Next.js & Full-Stack Pattern

---

### Q: What is the App Router in Next.js?

**Short answer:**
The App Router is the file-system based routing system introduced in Next.js 13+. Files named `page.tsx` become routes, and `route.ts` files become API endpoints.

**Deep dive:**

- `src/app/page.tsx` → route `/`
- `src/app/products/[id]/page.tsx` → route `/products/:id`
- `src/app/api/trpc/[trpc]/route.ts` → API route `/api/trpc/*`

Folders with `[brackets]` are dynamic segments — the value is passed as a param to the component or handler.

---

### Q: What is the difference between a Server Component and a Client Component?

**Short answer:**
Server Components render on the server and have no JavaScript in the browser. Client Components run in the browser and can use React state and hooks. You mark a file as a Client Component with `'use client'` at the top.

**Deep dive:**
In this app, `page.tsx` and `products/[id]/page.tsx` are **Server Components** — they have no `'use client'` directive, run only on the server, and can be `async` functions that `await` database calls directly. They fetch data via the tRPC server caller and pass results as props to client components.

`ProductsClient.tsx` and `ProductClient.tsx` are **Client Components** — they use `useState` and handle user interactions. They receive initial data as props (so first render has no loading state) and call the vanilla tRPC HTTP client for mutations.

The `src/server/` folder is **server-only** — if a Client Component tried to import from it, Next.js would throw a build error.

---

### Q: How does Next.js prevent server code from leaking to the browser?

**Short answer:**
Through static analysis at build time and the `server-only` package. If a client component imports a server module, the build fails.

**Deep dive:**
In this app the protection is architectural:

1. Client components only import from `src/trpc/react.tsx` (the tRPC React client).
2. `src/trpc/react.tsx` only imports `AppRouter` **as a type** — TypeScript erases it at compile time.
3. The actual server routers (`src/server/routers/`) are never in the client import chain.

---

## 5. Frontend & Data Fetching

---

### Q: How do client components get their initial data without a loading state?

**Short answer:**
The server page fetches data in-process via the tRPC caller and passes it as props. The client component starts with data already in local state — no `useEffect`, no loading spinner.

**Deep dive:**

```tsx
// Server component — runs on the server, no JS in the browser
export default async function Page() {
  const caller = getCaller();
  const [initialProducts, initialCategories] = await Promise.all([
    caller.product.list({}),
    caller.product.categories(),
  ]);
  return (
    <ProductsClient
      initialProducts={initialProducts}
      initialCategories={initialCategories}
    />
  );
}

// Client component — starts with data already available
export default function ProductsClient({
  initialProducts,
  initialCategories,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  // ...
}
```

The caller invokes tRPC procedures **in-process** (no HTTP round-trip), so the data is ready before the page HTML is sent to the browser.

---

### Q: How does the UI stay in sync after a mutation?

**Short answer:**
After a mutation resolves, the component explicitly re-fetches the affected data via the vanilla tRPC client and updates local state with `setProducts` / `setCategories`.

**Deep dive:**

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  await trpc.product.create.mutate({ name, price, category, description });
  // Explicit re-fetch after the mutation
  const [newProducts, newCategories] = await Promise.all([
    trpc.product.list.query({ category }),
    trpc.product.categories.query(),
  ]);
  setProducts(newProducts);
  setCategories(newCategories);
}
```

This is intentionally explicit: there is no background cache layer. The trade-off vs React Query is slightly more code per mutation, but the mental model is simpler — state changes are visible in the component, not hidden in a cache.

---

### Q: What is `use(params)` in the product detail page?

**Short answer:**
In React 19 and Next.js App Router, `params` is a Promise. `use()` is a React hook that unwraps a Promise inside a render function.

**Deep dive:**

```ts
export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)   // React 19 — unwrap the async params Promise
```

This is a Next.js App Router breaking change from earlier versions where `params` was a plain object. `use()` integrates with React's Suspense system and is the recommended way to handle async values in components.

---

## 6. TypeScript & Type Safety

---

### Q: How do types flow from the server to the client without sharing runtime code?

**Short answer:**
`AppRouter` is exported as a TypeScript type from the server. The client imports it as a type only — TypeScript uses it to generate a typed proxy, then erases it at compile time. No server code ever reaches the browser.

**Deep dive:**

```
server/routers/_app.ts
  export type AppRouter = typeof appRouter     ← type only

trpc/client.ts
  import type { AppRouter } from '@/server/routers/_app'
  export const trpc = createTRPCClient<AppRouter>()
           ↑
           TypeScript generates: trpc.product.list.query(...)
                                 trpc.product.create.mutate(...)
           All typed, all erased at runtime
```

---

### Q: What is the benefit of end-to-end type safety?

**Short answer:**
If you rename a field, add a required param, or change a return type on the server, TypeScript immediately highlights every broken call site on the client — before you run the app.

**Deep dive:**
Example: if you rename `price` to `amount` in the Prisma schema and update the tRPC procedure, TypeScript will show an error on every line in the frontend that reads `product.price`. You catch the bug at compile time, not in production.

---

## 7. Security

---

### Q: How is SQL injection prevented?

**Short answer:**
Prisma uses parameterised queries internally. User input is never interpolated directly into SQL strings.

**Deep dive:**
When you write `db.product.findMany({ where: { category: input.category } })`, Prisma generates:

```sql
SELECT * FROM "Product" WHERE "category" = ?
```

The `?` is a bound parameter filled in by the database driver, never by string concatenation. Even if `input.category` contained `'; DROP TABLE Product; --`, it would be treated as a literal string value, not SQL.

---

### Q: How is input validated and what happens with invalid data?

**Short answer:**
Zod validates every procedure input on the server before the handler runs. Invalid input returns a structured `400` error — it never reaches the database.

**Deep dive:**

```ts
.input(z.object({
  price: z.number().positive(),  // rejects -1, 0, "free", undefined
  name: z.string().min(1),       // rejects empty strings
}))
```

tRPC formats the Zod error into a response the client can read and display. No custom error-handling code is needed.

---

### Q: What environment variables are used and how are they protected?

**Short answer:**
`DATABASE_URL` is stored in a `.env` file, which is excluded from Git via `.gitignore`. It is only accessed server-side in `src/server/db.ts`.

**Deep dive:**
The `!` (non-null assertion) in `process.env.DATABASE_URL!` means the app will crash at startup if the variable is missing, which is the correct fail-fast behaviour. A production hardening step would be to use a validation library like `zod` or `@t3-oss/env-nextjs` to validate all env vars at build time with a meaningful error message.

---

## 8. Performance

---

### Q: How does the app avoid redundant database connections?

**Short answer:**
The Prisma singleton pattern stores the client on `globalThis`, ensuring only one connection pool exists per Node.js process regardless of how many times the module is imported.

---

### Q: What is request batching and how does it help?

**Short answer:**
`httpBatchLink` merges concurrent tRPC calls into one HTTP request, reducing network overhead and the number of server cold starts on serverless deployments.

**Deep dive:**
When the home page first loads, the server component calls both `caller.product.list({})` and `caller.product.categories()` in parallel via `Promise.all` — these are in-process calls, no HTTP at all. On the client, if multiple calls fire simultaneously (e.g. after a mutation re-fetch), `httpBatchLink` merges them:

```
POST /api/trpc/product.list,product.categories
```

The server processes both and returns both responses in a single round-trip.

---

### Q: How would you add pagination to the product list?

**Short answer:**
Add `skip` and `take` (or cursor-based) parameters to the `product.list` procedure input and pass them to `db.product.findMany`.

**Deep dive:**

```ts
list: publicProcedure
  .input(z.object({
    category: z.string().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  }))
  .query(({ input }) =>
    db.product.findMany({
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      where: input.category ? { category: input.category } : undefined,
      orderBy: { createdAt: 'desc' },
    })
  ),
```

---

## 9. Testing (how you would approach it)

---

### Q: How would you test the tRPC procedures?

**Short answer:**
Use the tRPC `createCaller` utility to call procedures directly in unit tests without spinning up an HTTP server.

**Deep dive:**

```ts
import { appRouter } from "@/server/routers/_app";

const caller = appRouter.createCaller({
  /* context */
});

test("creates a product", async () => {
  const product = await caller.product.create({
    name: "Test",
    price: 9.99,
    category: "Test",
  });
  expect(product.name).toBe("Test");
});
```

For the database, use a separate test SQLite file or an in-memory database and run `prisma migrate deploy` against it before the test suite.

---

### Q: How would you test the frontend components?

**Short answer:**
Use React Testing Library with a mocked tRPC client so tests don't need a real database.

**Deep dive:**
The vanilla `trpc` client in `src/trpc/client.ts` is a plain module export. In tests, mock it with jest:

```ts
jest.mock("@/trpc/client", () => ({
  trpc: {
    product: {
      list: { query: jest.fn().mockResolvedValue([]) },
      create: { mutate: jest.fn().mockResolvedValue({}) },
    },
  },
}));
```

No context providers or query client setup is needed — there is no React context in the client layer.

---

## 10. Common "What would you improve?" questions

---

### Q: What would you add to make this production-ready?

1. **Authentication** — add a `session` to tRPC context, protect mutations with a `protectedProcedure` middleware.
2. **Auto-run migrations** — add `prisma migrate deploy` to the `start` script.
3. **Environment validation** — use `@t3-oss/env-nextjs` to validate all env vars at build time.
4. **Error handling** — global tRPC error formatter to return consistent error shapes.
5. **Logging** — structured server logs (e.g. `pino`) for observability.
6. **Pagination** — `skip`/`take` on `product.list` to handle large datasets.
7. **Rate limiting** — middleware on the API route to prevent abuse.
8. **Optimistic updates** — update local state immediately on mutation for a snappier UI, roll back on error (instead of waiting for the re-fetch to complete).

---

### Q: Why SQLite instead of PostgreSQL?

**Short answer:**
SQLite is zero-config for local development. With libSQL/Turso it also works in production. For a larger app with concurrent writes, PostgreSQL would be a better choice.

**Deep dive:**
SQLite writes are serialised — only one write at a time. For a read-heavy product catalog this is fine. For an app with high write concurrency (e.g. an e-commerce checkout), PostgreSQL with connection pooling (PgBouncer) would be more appropriate. Switching in Prisma only requires changing the `provider` in `schema.prisma` and updating `DATABASE_URL`.

---

### Q: Why tRPC instead of GraphQL?

**Short answer:**
tRPC is simpler to set up and has zero boilerplate for a TypeScript-only stack. GraphQL is better when you need a public API consumed by multiple clients or different languages.

**Deep dive:**

|                        | tRPC                        | GraphQL                           |
| ---------------------- | --------------------------- | --------------------------------- |
| Schema definition      | Inferred from TypeScript    | Explicit SDL required             |
| Client codegen         | Not needed                  | `graphql-codegen` or similar      |
| Multi-language support | TypeScript only             | Any language                      |
| Flexibility            | Fixed procedures            | Clients choose their own fields   |
| Best for               | Internal full-stack TS apps | Public APIs, mobile + web clients |
