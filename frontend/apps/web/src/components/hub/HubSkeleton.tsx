function Bone({ className = '' }: { className?: string }) {
  return <div className={`bg-app-surface-sunken rounded-lg animate-pulse ${className}`} />;
}

export default function HubSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bone className="w-32 h-8" />
        <Bone className="w-40 h-10" />
        <Bone className="w-24 h-8" />
      </div>
      <div className="flex gap-2.5">
        <Bone className="w-32 h-9 rounded-full flex-shrink-0" />
        <Bone className="w-40 h-9 rounded-full flex-shrink-0" />
        <Bone className="w-36 h-9 rounded-full flex-shrink-0" />
        <Bone className="w-28 h-9 rounded-full flex-shrink-0" />
      </div>
      <Bone className="w-full h-20" />
      <Bone className="w-full h-44" />
      <div className="grid md:grid-cols-2 gap-4">
        <Bone className="h-40" />
        <Bone className="h-40" />
      </div>
      <Bone className="w-full h-28" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Bone className="h-12" />
        <Bone className="h-12" />
        <Bone className="h-12" />
      </div>
    </div>
  );
}
