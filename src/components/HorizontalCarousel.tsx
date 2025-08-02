import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HorizontalCarouselProps {
  children: React.ReactNode;
  className?: string;
}

export function HorizontalCarousel({ children, className = '' }: HorizontalCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Left Arrow */}
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-md hover:bg-background/90"
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm shadow-md hover:bg-background/90"
          onClick={scrollRight}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        onScroll={handleScroll}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}