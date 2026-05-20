export default function ProductLoading() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-4">
      {/* Back link skeleton */}
      <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />

      {/* Product card skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* Title + price row */}
        <div className="flex items-start justify-between gap-4">
          <div className="h-7 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-7 w-20 rounded bg-gray-200 animate-pulse shrink-0" />
        </div>

        {/* Category badge */}
        <div className="h-5 w-24 rounded-full bg-gray-200 animate-pulse" />

        {/* Description lines */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse" />
        </div>

        {/* Footer row */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <div className="h-3 w-36 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>

      {/* Danger zone skeleton */}
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <div className="h-8 w-28 rounded-lg bg-red-200 animate-pulse" />
      </div>
    </main>
  )
}
