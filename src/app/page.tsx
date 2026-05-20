import { getCaller } from '@/trpc/server'
import { getSession } from '@/lib/session'
import ProductsClient from './_components/ProductsClient'

export default async function Page() {
  const [caller, session] = await Promise.all([getCaller(), getSession()])
  const initialProducts = await caller.product.list({})

  return <ProductsClient initialProducts={initialProducts} currentUserEmail={session?.email ?? null} />
}

