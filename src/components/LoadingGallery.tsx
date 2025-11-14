import { Skeleton } from '@/components/ui/skeleton';

interface LoadingGalleryProps {
  count: number;
}

export function LoadingGallery({ count }: LoadingGalleryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mt-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
