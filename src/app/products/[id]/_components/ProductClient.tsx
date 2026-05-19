'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { trpc } from '@/trpc/client'
type Product = {
  id: number
  name: string
  price: number
  category: string
  description: string | null
  createdAt: Date
}

export default function ProductClient({ product }: { product: Product }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await trpc.product.delete.mutate({ id: product.id })
      router.push('/')
    } catch {
      setIsDeleting(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Back link */}
      <Link href="/" className="text-sm text-blue-600 hover:underline">
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
          <span className="text-xs text-gray-400">ID #{product.id}</span>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isDeleting ? 'Deleting…' : 'Delete product'}
        </button>
      </div>
    </main>
  )
}
