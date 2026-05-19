import { getCaller } from '@/trpc/server'
import ProductsClient from './_components/ProductsClient'

export default async function Page() {
  const caller = getCaller()
  const initialProducts = await caller.product.list({})

  return <ProductsClient initialProducts={initialProducts} />
}

