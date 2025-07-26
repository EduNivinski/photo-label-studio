import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadArea } from './UploadArea';

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
}

export function UploadDialog({ isOpen, onClose, onUpload }: UploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      await onUpload(files);
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload de Fotos e Vídeos</DialogTitle>
        </DialogHeader>
        <UploadArea onUpload={handleUpload} isUploading={isUploading} />
      </DialogContent>
    </Dialog>
  );
}