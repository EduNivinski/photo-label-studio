import { useState } from 'react';
import { Download, Tag, Trash2, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LabelChip } from './LabelChip';
import type { Photo, Label } from '@/types/photo';

interface PhotoModalProps {
  photo: Photo;
  labels: Label[];
  isOpen: boolean;
  onClose: () => void;
  onLabelManage: () => void;
  onDelete: () => void;
  onUpdateAlias?: (photoId: string, alias: string) => Promise<void>;
}

export function PhotoModal({ 
  photo, 
  labels, 
  isOpen, 
  onClose, 
  onLabelManage,
  onDelete,
  onUpdateAlias
}: PhotoModalProps) {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState(photo.alias || '');

  const photoLabels = labels.filter(label => photo.labels.includes(label.id));

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAlias = async () => {
    if (onUpdateAlias) {
      await onUpdateAlias(photo.id, aliasValue);
    }
    setIsEditingAlias(false);
  };

  const handleCancelEdit = () => {
    setAliasValue(photo.alias || '');
    setIsEditingAlias(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex flex-col">
              <span>{photo.name}</span>
              <div className="flex items-center gap-2 mt-1">
                {!isEditingAlias ? (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {photo.alias ? `"${photo.alias}"` : 'Sem alias'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingAlias(true)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={aliasValue}
                      onChange={(e) => setAliasValue(e.target.value)}
                      placeholder="Digite um alias para a foto..."
                      className="h-6 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveAlias}
                      className="h-6 w-6 p-0"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={onLabelManage}>
                <Tag className="h-4 w-4 mr-2" />
                Labels
              </Button>
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Photo Display */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={photo.url}
              alt={photo.name}
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
            />
          </div>

          {/* Photo Info */}
          <div className="space-y-3 border-t pt-4">
            <div className="text-sm text-muted-foreground">
              Enviada em {new Date(photo.uploadDate).toLocaleDateString('pt-BR')}
            </div>
            
            {/* Labels */}
            {photoLabels.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Labels:</h4>
                <div className="flex flex-wrap gap-2">
                  {photoLabels.map((label) => (
                    <LabelChip 
                      key={label.id} 
                      label={label} 
                      variant="tag"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}