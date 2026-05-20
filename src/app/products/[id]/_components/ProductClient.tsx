'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { deleteProduct } from '@/app/_actions/product'
import type { Product } from '@/generated/prisma/client'

export default function ProductClient({
  product,
  currentUserEmail,
}: {
  product: Product
  currentUserEmail: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isAuthor = !!currentUserEmail && product.authorEmail === currentUserEmail

  function handleDelete() {
    startTransition(async () => {
      await deleteProduct(product.id)
      router.push('/')
    })
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      {/* Back link */}
      <Link href="/" className="text-sm text-blue-600 hover:underline inline-block">
        ← Back to catalog
      </Link>

      {/* Product card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <span className="text-2xl font-bold text-blue-700 shrink-0">
            ${product.price.toFixed(2)}
          </span>
        </div>

        <span className="inline-block text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
          {product.category}
        </span>

        {product.description && (
          <p className="text-gray-600 leading-relaxed">{product.description}</p>
        )}

        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Added {new Date(product.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <div className="flex items-center gap-3">
            {product.authorEmail && (
              <span className="text-xs text-gray-400">by {product.authorEmail}</span>
            )}
            <span className="text-xs text-gray-400">ID #{product.id}</span>
          </div>
        </div>
      </div>

      {/* Author actions */}
      {isAuthor && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-xs text-red-600 font-medium">Author actions</p>
          <div className="flex gap-3">
            <Link
              href={`/products/${product.id}/edit`}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Edit product
            </Link>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {isPending ? 'Deleting…' : 'Delete product'}
            </button>
          </div>
        </div>
      )}

      {!currentUserEmail && (
        <p className="text-sm text-gray-400 text-center">
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link> to manage your products.
        </p>
      )}
    </main>
  )
}
