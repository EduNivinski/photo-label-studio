import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadArea } from './UploadArea';
import { UploadLabelSelector } from './UploadLabelSelector';
import type { Label } from '@/types/photo';

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<any>;
  labels: Label[];
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  onApplyLabelsToPhotos: (photoIds: string[], labelIds: string[]) => Promise<boolean>;
}

export function UploadDialog({ 
  isOpen, 
  onClose, 
  onUpload, 
  labels, 
  onCreateLabel, 
  onApplyLabelsToPhotos 
}: UploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [uploadedPhotoIds, setUploadedPhotoIds] = useState<string[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      const uploadedPhotos = await onUpload(files);
      // Check if uploadedPhotos is an array and extract photo IDs
      if (Array.isArray(uploadedPhotos)) {
        const photoIds = uploadedPhotos.map(photo => photo.id) || [];
        setUploadedPhotoIds(photoIds);
      }
      setUploadedCount(files.length);
      setShowLabelSelector(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyLabels = async (labelIds: string[]) => {
    if (uploadedPhotoIds.length > 0 && labelIds.length > 0) {
      await onApplyLabelsToPhotos(uploadedPhotoIds, labelIds);
    }
    handleCloseAll();
  };

  const handleCloseAll = () => {
    setShowLabelSelector(false);
    setUploadedPhotoIds([]);
    setUploadedCount(0);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showLabelSelector} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload de Fotos e Vídeos</DialogTitle>
          </DialogHeader>
          <UploadArea onUpload={handleUpload} isUploading={isUploading} />
        </DialogContent>
      </Dialog>

      <UploadLabelSelector
        isOpen={showLabelSelector}
        onClose={handleCloseAll}
        labels={labels}
        onCreateLabel={onCreateLabel}
        onApplyLabels={handleApplyLabels}
        uploadedFilesCount={uploadedCount}
      />
    </>
  );
}