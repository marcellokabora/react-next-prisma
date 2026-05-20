import { getSession } from '@/lib/session'
import { getCachedProducts } from '@/server/queries'
import ProductsClient from './_components/ProductsClient'

export default async function Page() {
  const [initialProducts, session] = await Promise.all([getCachedProducts(), getSession()])

  return <ProductsClient initialProducts={initialProducts} currentUserEmail={session?.email ?? null} />
}

