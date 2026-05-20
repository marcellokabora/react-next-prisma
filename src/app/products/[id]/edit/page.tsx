import { getCaller } from '@/trpc/server'
import { getSession } from '@/lib/session'
import { notFound, redirect } from 'next/navigation'
import EditProductForm from './_components/EditProductForm'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const productId = parseInt(id, 10)

  const [caller, session] = await Promise.all([getCaller(), getSession()])

  if (!session) redirect('/login')

  const product = await caller.product.getById({ id: productId })
  if (!product) notFound()

  // Only the author can access the edit page
  if (product.authorEmail && product.authorEmail !== session.email) {
    redirect(`/products/${productId}`)
  }

  return <EditProductForm product={product} />
}
