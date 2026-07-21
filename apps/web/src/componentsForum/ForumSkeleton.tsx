export const ForumSkeleton = () => (
  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm animate-pulse space-y-3">
    
    {/* Header Section */}
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-200 rounded-full" /> {/* Avatar */}
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-slate-200 rounded" /> {/* Name */}
          <div className="h-2 w-16 bg-slate-100 rounded" /> {/* Time */}
        </div>
      </div>
      <div className="h-5 w-16 bg-indigo-50/50 rounded-full" /> {/* Tag */}
    </div>

    {/* Content Section - Title Only */}
    <div className="py-1">
      <div className="h-4 w-3/4 bg-slate-200 rounded" />
    </div>

    {/* Actions Section */}
    <div className="pt-3 border-t border-slate-50 flex gap-3">
      <div className="h-7 w-12 bg-slate-50 rounded-lg" /> 
      <div className="h-7 w-12 bg-slate-50 rounded-lg" />
    </div>
  </div>
);