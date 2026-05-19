'use client'
import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/trpc/react'

export default function ProductsClient() {
  const [category, setCategory] = useState<string | undefined>()
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
  })

  const utils = trpc.useUtils()

  const products = trpc.product.list.useQuery({ category })
  const categories = trpc.product.categories.useQuery()

  const create = trpc.product.create.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate()
      utils.product.categories.invalidate()
      setForm({ name: '', price: '', category: '', description: '' })
    },
  })

  const remove = trpc.product.delete.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate()
      utils.product.categories.invalidate()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price || !form.category) return
    create.mutate({
      name: form.name,
      price: parseFloat(form.price),
      category: form.category,
      description: form.description || undefined,
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
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Price *"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Category *"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="col-span-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            {create.isPending ? 'Adding…' : 'Add Product'}
          </button>
          {create.error && (
            <p className="col-span-2 text-red-600 text-xs">{create.error.message}</p>
          )}
        </form>
      </section>

      {/* Category filter */}
      {(categories.data?.length ?? 0) > 0 && (
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
          {categories.data?.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat === category ? undefined : cat)}
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
      {products.isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : products.data?.length === 0 ? (
        <p className="text-gray-400 text-sm">No products yet. Add one above.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.data?.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 flex flex-col hover:border-blue-300 hover:shadow-sm transition-all"
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
                <span className="text-xs text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); remove.mutate({ id: p.id }) }}
                  disabled={remove.isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                >
                  Delete
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
