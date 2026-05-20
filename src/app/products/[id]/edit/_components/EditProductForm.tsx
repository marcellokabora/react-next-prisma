'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { updateProduct, type UpdateProductState } from '@/app/_actions/product'
import type { Product } from '@/generated/prisma/client'

export default function EditProductForm({ product }: { product: Product }) {
  const router = useRouter()

  const [state, dispatch, isPending] = useActionState<
    UpdateProductState,
    { id: number; name: string; price: string; category: string; description: string }
  >(updateProduct, {})

  useEffect(() => {
    if (state?.success) router.push(`/products/${product.id}`)
  }, [state?.success, router, product.id])

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      <Link href={`/products/${product.id}`} className="text-sm text-blue-600 hover:underline inline-block">
        ← Back to product
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Edit Product</h1>

        <form
          action={(formData) =>
            dispatch({
              id: product.id,
              name: formData.get('name') as string,
              price: formData.get('price') as string,
              category: formData.get('category') as string,
              description: formData.get('description') as string,
            })
          }
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <input
                name="name"
                defaultValue={product.name}
                required
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${state?.errors?.name ? 'border-red-400' : 'border-gray-300'}`}
              />
              {state?.errors?.name && <p className="text-red-500 text-xs">{state.errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Price *</label>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product.price}
                required
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${state?.errors?.price ? 'border-red-400' : 'border-gray-300'}`}
              />
              {state?.errors?.price && <p className="text-red-500 text-xs">{state.errors.price}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Category *</label>
              <input
                name="category"
                defaultValue={product.category}
                required
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${state?.errors?.category ? 'border-red-400' : 'border-gray-300'}`}
              />
              {state?.errors?.category && <p className="text-red-500 text-xs">{state.errors.category}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <input
                name="description"
                defaultValue={product.description ?? ''}
                placeholder="Optional, max 50 chars"
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${state?.errors?.description ? 'border-red-400' : 'border-gray-300'}`}
              />
              {state?.errors?.description && <p className="text-red-500 text-xs">{state.errors.description}</p>}
            </div>
          </div>

          {state?.error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            <Link
              href={`/products/${product.id}`}
              className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
