import { useState, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Tag, 
  Trash2, 
  Edit3, 
  Check, 
  Plus,
  Share,
  ZoomIn,
  ZoomOut,
  Info,
  Calendar,
  File,
  Monitor,
  HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LabelChip } from './LabelChip';
import { getFileType } from '@/lib/fileUtils';
import type { Photo, Label } from '@/types/photo';

interface PhotoModalProps {
  photo: Photo | null;
  labels: Label[];
  isOpen: boolean;
  onClose: () => void;
  onLabelManage: () => void;
  onDelete: () => void;
  onUpdateAlias?: (photoId: string, alias: string) => Promise<void>;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function PhotoModal({ 
  photo, 
  labels, 
  isOpen, 
  onClose, 
  onLabelManage,
  onDelete,
  onUpdateAlias,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false
}: PhotoModalProps) {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (photo) {
      setAliasValue(photo.alias || '');
      setZoom(1);
    }
  }, [photo]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !photo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious && onPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext && onNext) onNext();
          break;
        case 'Delete':
          if (e.shiftKey) onDelete();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasNext, hasPrevious, onNext, onPrevious, onClose, onDelete, photo]);

  // Early return if photo is null - AFTER all hooks
  if (!photo) {
    return null;
  }

  const photoLabels = labels.filter(label => photo.labels.includes(label.id));
  const isVideo = getFileType(photo.url) === 'video';


  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.name,
          url: photo.url
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(photo.url);
    }
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-medium text-lg font-sans">
              {photo.alias || photo.name}
            </h2>
            {!isEditingAlias ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingAlias(true)}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={aliasValue}
                  onChange={(e) => setAliasValue(e.target.value)}
                  placeholder="Digite um nome..."
                  className="h-8 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveAlias}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {hasPrevious && onPrevious && (
        <Button
          variant="ghost"
          size="lg"
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white hover:bg-white/10 h-16 w-16 rounded-full"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {hasNext && onNext && (
        <Button
          variant="ghost"
          size="lg"
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white hover:bg-white/10 h-16 w-16 rounded-full"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Main Content Area */}
      <div className="flex items-center justify-center min-h-screen p-16">
        <div className="relative max-w-[85vw] max-h-[85vh] flex items-center justify-center">
          {isVideo ? (
            <video
              src={photo.url}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              style={{ maxHeight: '75vh' }}
            >
              Seu navegador não suporta a reprodução de vídeos.
            </video>
          ) : (
            <img
              src={photo.url}
              alt={photo.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-zoom-in"
              style={{ 
                maxHeight: '75vh',
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s ease'
              }}
              onClick={() => setZoom(zoom === 1 ? 2 : 1)}
            />
          )}

          {/* Zoom Controls for Images */}
          {!isVideo && (
            <div className="absolute bottom-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="bg-black/50 hover:bg-black/70 text-white border-white/20"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                className="bg-black/50 hover:bg-black/70 text-white border-white/20"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Info Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
        <div className="max-w-4xl mx-auto">
          {/* Main Info Row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 space-y-3">
              {/* Labels */}
              <div className="flex flex-wrap items-center gap-2">
                {photoLabels.map((label) => (
                  <LabelChip 
                    key={label.id} 
                    label={label} 
                    variant="tag"
                    className="bg-white/20 text-white border-white/30"
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLabelManage}
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Label
                </Button>
              </div>

              {/* Quick Info */}
              <div className="flex items-center gap-6 text-sm text-white/80">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(photo.uploadDate).toLocaleDateString('pt-BR')}
                </div>
                <div className="flex items-center gap-1">
                  <File className="h-4 w-4" />
                  {isVideo ? 'Vídeo' : 'Foto'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-6">
              <Button
                variant="secondary"
                size="sm"
                onClick={onLabelManage}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Tag className="h-4 w-4 mr-2" />
                Editar Labels
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Share className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="bg-red-600/80 hover:bg-red-600 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </div>

          {/* Extended Info (toggleable) */}
          {showInfo && (
            <div className="border-t border-white/20 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-white/70">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <File className="h-3 w-3" />
                  <span className="font-medium">Arquivo</span>
                </div>
                <div>{photo.name}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <HardDrive className="h-3 w-3" />
                  <span className="font-medium">Tamanho</span>
                </div>
                <div>N/A</div>
              </div>
              {!isVideo && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Monitor className="h-3 w-3" />
                    <span className="font-medium">Resolução</span>
                  </div>
                  <div>N/A</div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium">Upload</span>
                </div>
                <div>{new Date(photo.uploadDate).toLocaleString('pt-BR')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close */}
      <div 
        className="absolute inset-0 -z-10" 
        onClick={onClose}
      />
    </div>
  );
}