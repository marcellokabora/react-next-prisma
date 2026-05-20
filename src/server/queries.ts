import 'server-only'
import { unstable_cache } from 'next/cache'
import { db } from './db'

/**
 * Fetches all products from the database, cached at the Next.js Data Cache layer.
 *
 * - `revalidate: 60` — the cached result is served for up to 60 s before the
 *   next request triggers a background revalidation (stale-while-revalidate).
 * - `tags: ['products']` — any Server Action that mutates product data calls
 *   `revalidateTag('products')` to immediately bust this entry so the next
 *   visitor always sees fresh data.
 *
 * This means 10,000 simultaneous visitors all hit the in-memory cache and
 * never touch the database — only one DB round-trip happens per 60-second window
 * (or immediately after a mutation).
 */
export const getCachedProducts = unstable_cache(
    async () =>
        db.product.findMany({
            orderBy: { createdAt: 'desc' },
        }),
    ['products-list'],
    { revalidate: 60, tags: ['products'] },
)
