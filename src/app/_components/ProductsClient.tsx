'use client'
import { useOptimistic, useActionState, useTransition, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createProduct, deleteProduct, type CreateProductState } from '@/app/_actions/product'
import type { Product } from '@/generated/prisma/client'

interface Props {
  initialProducts: Product[]
}

export default function ProductsClient({ initialProducts }: Props) {
  const [form, setForm] = useState({ name: '', price: '', category: '', description: '' })
  const [fieldErrors, setFieldErrors] = useState({ name: '', price: '', category: '', description: '' })

  // React 19: useActionState for the create form
  const [createState, dispatch, isCreating] = useActionState<CreateProductState, { name: string; price: string; category: string; description: string }>(createProduct, {})

  // React 19: useOptimistic for instant create + delete
  type OptimisticAction =
    | { type: 'delete'; id: number }
    | { type: 'create'; product: Product }

  const [optimisticProducts, addOptimistic] = useOptimistic(
    initialProducts,
    (state, action: OptimisticAction) => {
      if (action.type === 'delete') return state.filter((p) => p.id !== action.id)
      return [action.product, ...state]
    },
  )

  // useTransition wraps the create dispatch
  const [, startCreateTransition] = useTransition()
  // useTransition wraps the delete server action
  const [isPendingDelete, startDeleteTransition] = useTransition()

  // Category filter — purely client-side, derived from the optimistic list
  const [category, setCategory] = useState<string | undefined>()

  const allCategories = useMemo(
    () => [...new Set(optimisticProducts.map((p) => p.category))].sort(),
    [optimisticProducts],
  )

  const displayProducts = category
    ? optimisticProducts.filter((p) => p.category === category)
    : optimisticProducts

  // Reset category selection if all its products were deleted
  useEffect(() => {
    if (category && !allCategories.includes(category)) setCategory(undefined)
  }, [allCategories, category])

  // Clear the form after a successful create
  useEffect(() => {
    if (createState.success) {
      setForm({ name: '', price: '', category: '', description: '' })
      setFieldErrors({ name: '', price: '', category: '', description: '' })
    }
  }, [createState.success])

  function validate() {
    const errs = { name: '', price: '', category: '', description: '' }
    if (!form.name.trim()) errs.name = 'Name is required.'
    if (!form.price) errs.price = 'Price is required.'
    else if (isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0)
      errs.price = 'Price must be a positive number.'
    if (!form.category.trim()) errs.category = 'Category is required.'
    if (form.description.length > 50)
      errs.description = `Description must be 50 characters or fewer (${form.description.length}/50).`
    setFieldErrors(errs)
    return Object.values(errs).every((e) => e === '')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return
    const tempProduct: Product = {
      id: -Date.now(),
      name: form.name,
      price: parseFloat(form.price),
      category: form.category,
      description: form.description || null,
      createdAt: new Date(),
    }
    startCreateTransition(() => {
      addOptimistic({ type: 'create', product: tempProduct })
      dispatch({ name: form.name, price: form.price, category: form.category, description: form.description })
    })
  }

  function handleDelete(id: number) {
    startDeleteTransition(async () => {
      addOptimistic({ type: 'delete', id })
      await deleteProduct(id)
    })
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Product Catalog</h1>
        <div className="flex flex-wrap gap-2">
          {['Next.js', 'tRPC', 'Prisma', 'SQLite', 'TypeScript'].map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Add product form */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Add Product</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <input
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name || createState.errors?.name ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Name *"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                if (fieldErrors.name) setFieldErrors((err) => ({ ...err, name: '' }))
              }}
            />
            {(fieldErrors.name || createState.errors?.name) && (
              <p className="text-red-500 text-xs">{fieldErrors.name || createState.errors?.name}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <input
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.price || createState.errors?.price ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Price *"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => {
                setForm((f) => ({ ...f, price: e.target.value }))
                if (fieldErrors.price) setFieldErrors((err) => ({ ...err, price: '' }))
              }}
            />
            {(fieldErrors.price || createState.errors?.price) && (
              <p className="text-red-500 text-xs">{fieldErrors.price || createState.errors?.price}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <input
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.category || createState.errors?.category ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Category *"
              value={form.category}
              onChange={(e) => {
                setForm((f) => ({ ...f, category: e.target.value }))
                if (fieldErrors.category) setFieldErrors((err) => ({ ...err, category: '' }))
              }}
            />
            {(fieldErrors.category || createState.errors?.category) && (
              <p className="text-red-500 text-xs">{fieldErrors.category || createState.errors?.category}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <input
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.description || createState.errors?.description ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="Description (optional, max 50 chars)"
              value={form.description}
              onChange={(e) => {
                setForm((f) => ({ ...f, description: e.target.value }))
                if (fieldErrors.description) setFieldErrors((err) => ({ ...err, description: '' }))
              }}
            />
            {(fieldErrors.description || createState.errors?.description) && (
              <p className="text-red-500 text-xs">{fieldErrors.description || createState.errors?.description}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="col-span-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            {isCreating ? 'Adding…' : 'Add Product'}
          </button>
          {createState.error && (
            <p className="col-span-2 text-red-600 text-xs">{createState.error}</p>
          )}
        </form>
      </section>

      {/* Category filter — instant, client-side */}
      {allCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(undefined)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              !category
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? undefined : cat)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                category === cat
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {displayProducts.length === 0 ? (
        <p className="text-gray-400 text-sm">No products yet. Add one above.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayProducts.map((p) => {
            const isPending = p.id < 0
            return (
              <Link
                key={p.id}
                href={isPending ? '#' : `/products/${p.id}`}
                onClick={isPending ? (e) => e.preventDefault() : undefined}
                className={`bg-white rounded-xl border border-gray-200 p-4 space-y-2 flex flex-col transition-all ${
                  isPending
                    ? 'opacity-50 cursor-default'
                    : 'hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <span className="shrink-0 text-sm font-bold text-blue-700">
                    ${p.price.toFixed(2)}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 self-start">
                  {p.category}
                </span>
                {p.description && (
                  <p className="text-sm text-gray-500">{p.description}</p>
                )}
                <div className="flex items-center justify-between pt-1 mt-auto">
                  {isPending ? (
                    <span className="text-xs text-gray-400 italic">Saving…</span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.preventDefault(); handleDelete(p.id) }}
                    disabled={isPendingDelete || isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
