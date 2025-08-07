import { useState } from 'react';
import { Tag, Plus, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { getFileType } from '@/lib/fileUtils';
import { StandardLabelCreator } from '@/components/StandardLabelCreator';
import { LabelManager } from '@/components/LabelManager';
import { EditLabelDialog } from '@/components/EditLabelDialog';
import { DeleteLabelDialog } from '@/components/DeleteLabelDialog';

export default function Labels() {
  const { labels, photos, createLabel, deleteLabel, updateLabel } = useSupabaseData();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [showEditLabel, setShowEditLabel] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [labelToDelete, setLabelToDelete] = useState<string | null>(null);

  // Filter labels based on search term
  const filteredLabels = labels.filter(label =>
    label.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get photo and video count for each label
  const getLabelMediaCount = (labelId: string) => {
    const labelPhotos = photos.filter(photo => photo.labels.includes(labelId));
    const photoCount = labelPhotos.filter(photo => getFileType(photo.url) !== 'video').length;
    const videoCount = labelPhotos.filter(photo => getFileType(photo.url) === 'video').length;
    
    return { photoCount, videoCount, totalCount: photoCount + videoCount };
  };

  const handleCreateLabel = async (name: string, color?: string) => {
    await createLabel(name, color);
    toast({
      title: "Label criada",
      description: `A label "${name}" foi criada com sucesso.`,
    });
  };

  const handleDeleteLabel = async (labelId: string): Promise<boolean> => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return false;

    // Check if user has disabled confirmation dialogs
    const skipConfirmation = localStorage.getItem('photolabel-skip-delete-confirmation') === 'true';
    
    if (skipConfirmation) {
      // Delete directly without confirmation
      return await performDelete(labelId);
    } else {
      // Show confirmation dialog
      setLabelToDelete(labelId);
      setShowDeleteDialog(true);
      return false; // Will be handled by the dialog
    }
  };

  const performDelete = async (labelId: string): Promise<boolean> => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return false;

    const success = await deleteLabel(labelId);
    if (success) {
      toast({
        title: "Label deletada",
        description: `A label "${label.name}" foi deletada com sucesso.`,
      });
      return true;
    } else {
      toast({
        title: "Erro ao deletar label",
        description: "Ocorreu um erro ao deletar a label. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleConfirmDelete = async () => {
    if (labelToDelete) {
      await performDelete(labelToDelete);
      setLabelToDelete(null);
    }
  };

  const handleEditLabel = (labelId: string) => {
    setSelectedLabel(labelId);
    setShowEditLabel(true);
  };

  const handleUpdateLabel = async (labelId: string, name: string, color: string): Promise<boolean> => {
    const success = await updateLabel(labelId, name, color);
    if (success) {
      toast({
        title: "Label atualizada",
        description: `A label foi atualizada com sucesso.`,
      });
      setShowEditLabel(false);
      setSelectedLabel(null);
      return true;
    } else {
      toast({
        title: "Erro ao atualizar label",
        description: "Ocorreu um erro ao atualizar a label. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const getContrastColor = (hexColor: string) => {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  return (
    <div className="flex-1 min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Gestão de Labels</h1>
                <p className="text-sm text-muted-foreground">
                  {labels.length} label{labels.length !== 1 ? 's' : ''} criada{labels.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Button onClick={() => setShowCreateLabel(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Label
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar labels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Badge variant="secondary" className="text-sm">
            {filteredLabels.length} de {labels.length}
          </Badge>
        </div>

        {/* Labels Grid */}
        {filteredLabels.length === 0 ? (
          <Card className="p-12 text-center">
            {labels.length === 0 ? (
              <>
                <div className="text-7xl mb-6 opacity-80">🏷️</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Nenhuma label criada
                </h3>
                <p className="text-muted-foreground mb-6 text-base">
                  Comece criando labels para organizar suas fotos
                </p>
                <Button onClick={() => setShowCreateLabel(true)} size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Criar primeira label
                </Button>
              </>
            ) : (
              <>
                <div className="text-7xl mb-6 opacity-80">🔍</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Nenhuma label encontrada
                </h3>
                <p className="text-muted-foreground text-base">
                  Tente buscar por outro termo
                </p>
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLabels.map((label, index) => {
              const { photoCount, videoCount } = getLabelMediaCount(label.id);
              
              return (
                <Card 
                  key={label.id} 
                  className="p-4 hover:shadow-lg transition-all duration-200 animate-fade-in group"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="px-3 py-1.5 rounded-full text-sm font-medium flex-1 text-center text-white"
                      style={{
                        backgroundColor: label.color || '#6b7280'
                      }}
                    >
                      {label.name}
                    </div>
                    
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditLabel(label.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLabel(label.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex gap-3">
                      {photoCount > 0 && (
                        <span>{photoCount} foto{photoCount !== 1 ? 's' : ''}</span>
                      )}
                      {videoCount > 0 && (
                        <span>{videoCount} vídeo{videoCount !== 1 ? 's' : ''}</span>
                      )}
                      {photoCount === 0 && videoCount === 0 && (
                        <span>Nenhum arquivo</span>
                      )}
                    </div>
                    <div 
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: label.color || '#6b7280' }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <StandardLabelCreator
        trigger={<></>}
        isOpen={showCreateLabel}
        onOpenChange={setShowCreateLabel}
        onCreateLabel={handleCreateLabel}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteLabelDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setLabelToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        label={labelToDelete ? labels.find(l => l.id === labelToDelete) || null : null}
        mediaCount={labelToDelete ? getLabelMediaCount(labelToDelete) : { photoCount: 0, videoCount: 0, totalCount: 0 }}
      />

      {/* Edit Label Dialog */}
      <EditLabelDialog
        isOpen={showEditLabel}
        onClose={() => {
          setShowEditLabel(false);
          setSelectedLabel(null);
        }}
        label={selectedLabel ? labels.find(l => l.id === selectedLabel) || null : null}
        onUpdateLabel={handleUpdateLabel}
      />
    </div>
  );
}