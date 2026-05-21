export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      {/* Title bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-72 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-28 bg-gray-200 rounded-lg" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-4 gap-4 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
            <div className="h-3 w-20 bg-gray-100 rounded" />
            <div className="h-9 w-16 bg-gray-200 rounded-lg" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="ml-auto h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
