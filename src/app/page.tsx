import { trpc, HydrateClient } from '@/trpc/server'
import ProductsClient from './_components/ProductsClient'

export default async function Page() {
  await Promise.all([
    trpc.product.list.prefetch({}),
    trpc.product.categories.prefetch(),
  ])

  return (
    <HydrateClient>
      <ProductsClient />
    </HydrateClient>
  )
}

