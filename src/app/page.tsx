import { getCaller } from '@/trpc/server'
import ProductsClient from './_components/ProductsClient'

export default async function Page() {
  const caller = getCaller()
  const [initialProducts, initialCategories] = await Promise.all([
    caller.product.list({}),
    caller.product.categories(),
  ])

  return (
    <ProductsClient
      initialProducts={initialProducts}
      initialCategories={initialCategories}
    />
  )
}

