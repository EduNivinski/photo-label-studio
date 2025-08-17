import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingUploadButtonProps {
  onClick: () => void;
  className?: string;
}

export function FloatingUploadButton({ onClick, className }: FloatingUploadButtonProps) {
  return (
    <Button
      variant="fab"
      onClick={onClick}
      className={className}
      size="icon"
      aria-label="Upload de fotos"
    >
      <Upload className="h-5 w-5" />
    </Button>
  );
}