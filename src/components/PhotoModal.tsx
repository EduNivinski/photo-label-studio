import { X, Download, Tag, Trash2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LabelChip } from './LabelChip';
import type { Photo, Label } from '@/types/photo';

interface PhotoModalProps {
  photo: Photo | null;
  labels: Label[];
  isOpen: boolean;
  onClose: () => void;
  onLabelManage: () => void;
  onDelete: () => void;
}

export function PhotoModal({ 
  photo, 
  labels, 
  isOpen, 
  onClose, 
  onLabelManage, 
  onDelete 
}: PhotoModalProps) {
  if (!photo) return null;

  const photoLabels = labels.filter(label => photo.labels.includes(label.id));

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex-1">
              <h2 className="text-lg font-semibold truncate">{photo.name}</h2>
              <p className="text-sm text-muted-foreground">
                Enviado em {new Date(photo.uploadDate).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onLabelManage}>
                <Tag className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center bg-black/5 overflow-hidden">
            <img
              src={photo.url}
              alt={photo.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Footer com labels */}
          {photoLabels.length > 0 && (
            <div className="p-4 border-t border-border">
              <div className="flex flex-wrap gap-2">
                {photoLabels.map((label) => (
                  <LabelChip key={label.id} label={label} variant="tag" />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}