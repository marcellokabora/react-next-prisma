import { getCaller } from '@/trpc/server'
import { notFound } from 'next/navigation'
import ProductClient from './_components/ProductClient'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const productId = parseInt(id, 10)

  const caller = getCaller()
  const product = await caller.product.getById({ id: productId })

  if (!product) notFound()

  return <ProductClient product={product} />
}
