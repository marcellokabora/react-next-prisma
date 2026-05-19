import { trpc, HydrateClient } from '@/trpc/server'
import ProductClient from './_components/ProductClient'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const productId = parseInt(id, 10)

  await trpc.product.getById.prefetch({ id: productId })

  return (
    <HydrateClient>
      <ProductClient id={productId} />
    </HydrateClient>
  )
}
