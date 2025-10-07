import { useState, useEffect, useRef } from 'react';
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
  HardDrive,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LabelChip } from './LabelChip';
import { LabelManager } from './LabelManager';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { MediaItem } from '@/types/media';
import { extractSourceAndKey } from '@/lib/media-adapters';
import type { Label } from '@/types/photo';
import { supabase } from '@/integrations/supabase/client';

interface MediaModalProps {
  item: MediaItem | null;
  labels: Label[];
  isOpen: boolean;
  onClose: () => void;
  onLabelManage: () => void;
  onDelete: () => void;
  onUpdateAlias?: (itemId: string, alias: string) => Promise<void>;
  onCreateLabel: (name: string, color?: string) => Promise<void>;
  onDeleteLabel: (labelId: string) => Promise<boolean>;
  onUpdatePhotoLabels: (photoId: string, labelIds: string[]) => Promise<boolean>;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function MediaModal({ 
  item, 
  labels, 
  isOpen, 
  onClose, 
  onLabelManage,
  onDelete,
  onUpdateAlias,
  onCreateLabel,
  onDeleteLabel,
  onUpdatePhotoLabels,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false
}: MediaModalProps) {
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [hiresSrc, setHiresSrc] = useState<string | null>(null);

  const [posterHq, setPosterHq] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPoster, setLoadingPoster] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Utility function to fetch Drive previews
  const fetchDrivePreview = async ({ fileId, kind }: { fileId: string; kind: "image" | "video" }) => {
    console.log(`📡 Fetching ${kind} preview for fileId: ${fileId}`);
    
    const base = "https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1";
    const path = kind === "image" ? "drive-image-preview" : "drive-video-poster";
    const url = `${base}/${path}?fileId=${encodeURIComponent(fileId)}&max=${kind === "image" ? 1600 : 1280}`;
    
    console.log(`📡 Preview URL: ${url}`);
    
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('No auth token found');
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const r = await fetch(url, { 
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });
    
    console.log(`📡 Response status: ${r.status} ${r.statusText}`);
    
    if (!r.ok) throw new Error(`preview_${kind}_failed: ${r.status} ${r.statusText}`);
    
    const blob = await r.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    console.log(`✅ ${kind} preview blob created:`, {
      size: blob.size,
      type: blob.type,
      url: objectUrl
    });
    
    return objectUrl;
  };

  useEffect(() => {
    // Cleanup function to revoke URLs and abort requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (hiresSrc && hiresSrc.startsWith('blob:')) {
        URL.revokeObjectURL(hiresSrc);
      }
      if (posterHq && posterHq.startsWith('blob:')) {
        URL.revokeObjectURL(posterHq);
      }
    };
  }, [hiresSrc, posterHq]);

  useEffect(() => {
    if (item) {
      setAliasValue(item.name || '');
      setZoom(1);
      
      // Reset preview states
      if (hiresSrc && hiresSrc.startsWith('blob:')) {
        URL.revokeObjectURL(hiresSrc);
      }
      if (posterHq && posterHq.startsWith('blob:')) {
        URL.revokeObjectURL(posterHq);
      }
      setHiresSrc(null);
      setPosterHq(null);
      setLoading(false);
      setLoadingPoster(false);
      
      // Abort any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Load high-res preview for Google Drive items
      if (item.source === 'gdrive') {
        const { key: fileId } = extractSourceAndKey(item.id);
        
        console.log(`🚀 Loading preview for ${item.isVideo ? 'video' : 'image'}: ${item.name} (${fileId})`);
        
        if (item.isVideo) {
          // Load high-quality poster for video
          setLoadingPoster(true);
          fetchDrivePreview({ fileId, kind: "video" })
            .then(url => {
              if (!abortControllerRef.current?.signal.aborted) {
                console.log('✅ Video poster loaded successfully:', url);
                setPosterHq(url);
              } else {
                URL.revokeObjectURL(url);
              }
            })
            .catch(error => {
              console.error('❌ Failed to load video poster:', error);
            })
            .finally(() => {
              if (!abortControllerRef.current?.signal.aborted) {
                setLoadingPoster(false);
              }
            });
        } else {
          // Load high-res image
          setLoading(true);
          fetchDrivePreview({ fileId, kind: "image" })
            .then(url => {
              if (!abortControllerRef.current?.signal.aborted) {
                console.log('✅ High-res image loaded successfully:', url);
                setHiresSrc(url);
              } else {
                URL.revokeObjectURL(url);
              }
            })
            .catch(error => {
              console.error('❌ Failed to load image preview:', error);
            })
            .finally(() => {
              if (!abortControllerRef.current?.signal.aborted) {
                setLoading(false);
              }
            });
        }
      }
    }
  }, [item]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !item) return;

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
  }, [isOpen, hasNext, hasPrevious, onNext, onPrevious, onClose, onDelete, item]);

  if (!item) {
    return null;
  }

  const itemLabels = labels.filter(label => 
    item.labels.some(itemLabel => itemLabel.id === label.id)
  );

  const handleDownload = async () => {
    try {
      if (item.source === 'gdrive' && item.openInDriveUrl) {
        // For Google Drive items, open in Drive for download
        window.open(item.openInDriveUrl, '_blank');
        return;
      }
      
      const downloadUrl = hiresSrc || posterHq || item.posterUrl;
      if (!downloadUrl) throw new Error('No download URL available');

      // Fetch the blob data from the URL
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      
      // Create download link with blob URL
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = item.name;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback to opening in new tab
      const fallbackUrl = hiresSrc || posterHq || item.posterUrl;
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank');
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = hiresSrc || posterHq || item.posterUrl || item.openInDriveUrl;
    
    if (navigator.share && shareUrl) {
      try {
        await navigator.share({
          title: item.name,
          url: shareUrl
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else if (shareUrl) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const handleSaveAlias = async () => {
    if (onUpdateAlias) {
      await onUpdateAlias(item.id, aliasValue);
    }
    setIsEditingAlias(false);
  };

  const handleCancelEdit = () => {
    setAliasValue(item.name || '');
    setIsEditingAlias(false);
  };

  const handleOpenInDrive = () => {
    if (item.openInDriveUrl) {
      window.open(item.openInDriveUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm" onClick={() => onClose()}>
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-white font-medium text-lg font-sans">
              {item.name}
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
              <div className="flex items-center gap-4 w-full">
                <Input
                  value={aliasValue}
                  onChange={(e) => setAliasValue(e.target.value)}
                  placeholder="Digite um nome..."
                  className="h-8 bg-white/10 border-white/20 text-white placeholder:text-white/60 flex-1"
                  autoFocus
                />
                <div className="flex items-center gap-4 text-sm text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-md border border-white/20 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <File className="h-4 w-4" />
                    <span>{item.isVideo ? 'Vídeo' : 'Imagem'}</span>
                  </div>
                  {item.source === 'gdrive' && (
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-4 w-4" />
                      <span>Google Drive</span>
                    </div>
                  )}
                </div>
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
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white hover:bg-white/10 h-16 w-16 rounded-full"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {hasNext && onNext && (
        <Button
          variant="ghost"
          size="lg"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white hover:bg-white/10 h-16 w-16 rounded-full"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Main Content Area */}
      <div className="flex items-center justify-center min-h-screen p-16">
        <div className="relative max-w-[85vw] max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {(loading || loadingPoster) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-10">
              <div className="text-white">Carregando preview em alta resolução...</div>
            </div>
          )}
          
          {item.isVideo ? (
            <div className="relative">
              <video
                poster={posterHq || item.posterUrl || '/img/placeholder.png'}
                controls={false}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{ maxHeight: '75vh', minHeight: '400px', minWidth: '600px' }}
              />
              
              {/* Video overlay with play button and Drive link */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <div className="text-center">
                  <div className="text-white text-6xl mb-4">▶️</div>
                  {item.openInDriveUrl && (
                    <Button
                      onClick={handleOpenInDrive}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Assistir no Google Drive
                    </Button>
                  )}
                  {posterHq && (
                    <div className="text-white text-sm mt-2">Preview em alta qualidade carregado ✓</div>
                  )}
                </div>
              </div>
              
              {item.durationMs && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                  {Math.floor(item.durationMs / 60000)}:{String(Math.floor((item.durationMs % 60000) / 1000)).padStart(2, '0')}
                </div>
              )}
            </div>
          ) : (
            <img
              src={hiresSrc || item.posterUrl || '/img/placeholder.png'}
              alt={item.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-zoom-in"
              style={{ 
                maxHeight: '75vh',
                minHeight: '400px',
                minWidth: '600px',
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s ease'
              }}
              onClick={(e) => { e.stopPropagation(); setZoom(zoom === 1 ? 2 : 1); }}
              onLoad={() => console.log('🖼️ High-res image loaded:', hiresSrc ? 'High quality' : 'Fallback')}
            />
          )}

          {/* Zoom Controls for Images */}
          {!item.isVideo && (
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
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6" onClick={(e) => e.stopPropagation()}>
        <div className="max-w-4xl mx-auto">
          {/* Main Info Row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 space-y-3">
              {/* Labels */}
              <div className="flex flex-wrap items-center gap-2">
                {itemLabels.map((label) => (
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
                  onClick={(e) => { e.stopPropagation(); setIsLabelManagerOpen(true); }}
                  className="text-white/80 hover:text-white hover:bg-white/10 w-8 h-8 rounded-full border border-white/40 hover:border-white/60 p-0 flex items-center justify-center"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-6">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsLabelManagerOpen(true);
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Tag className="h-4 w-4 mr-2" />
                Editar Labels
              </Button>
              {item.downloadEnabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Share className="h-4 w-4 mr-2" />
                Compartilhar
              </Button>
              {item.openInDriveUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenInDrive}
                  className="bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500/20"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir no Drive
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteConfirmOpen(true)}
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
                <div>{item.name}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <HardDrive className="h-3 w-3" />
                  <span className="font-medium">Origem</span>
                </div>
                <div>{item.source === 'gdrive' ? 'Google Drive' : 'Upload Local'}</div>
              </div>
              {!item.isVideo && item.width && item.height && (
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Monitor className="h-3 w-3" />
                    <span className="font-medium">Resolução</span>
                  </div>
                  <div>{item.width} × {item.height}</div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium">Data</span>
                </div>
                <div>{item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Label Manager */}
      <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <LabelManager
          isOpen={isLabelManagerOpen}
          onClose={() => {
            setIsLabelManagerOpen(false);
          }}
          labels={labels}
          selectedPhoto={item ? {
            id: item.id,
            name: item.name,
            labels: itemLabels.map(label => label.id),
            url: item.posterUrl || '',
            uploadDate: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
            mediaType: item.isVideo ? 'video' : 'photo'
          } : undefined}
          onCreateLabel={onCreateLabel}
          onDeleteLabel={onDeleteLabel}
          onUpdatePhotoLabels={onUpdatePhotoLabels}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDelete();
        }}
        itemCount={1}
      />

    </div>
  );
}