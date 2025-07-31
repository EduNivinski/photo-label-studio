import { useState } from 'react';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LabelChip } from '@/components/LabelChip';
import type { Album } from '@/types/album';
import type { Label } from '@/types/photo';

interface AlbumCardProps {
  album: Album;
  labels: Label[];
  onClick: () => void;
  onEdit: (album: Album) => void;
  onDelete: (albumId: string) => void;
  isUserCreated?: boolean;
}

export function AlbumCard({ album, labels, onClick, onEdit, onDelete, isUserCreated = true }: AlbumCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(album);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(album.id);
  };

  return (
    <Card 
      className="group cursor-pointer hover:shadow-md transition-all border border-border bg-card"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {album.name}
            </h3>
            {isUserCreated && (
              <span className="text-xs text-muted-foreground">Álbum personalizado</span>
            )}
          </div>
          
          {isUserCreated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={handleMenuClick}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Cover Image */}
        <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
          {album.cover_photo_url && !imageError ? (
            <img
              src={album.cover_photo_url}
              alt={album.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-2xl mb-1">📸</div>
                <div className="text-sm">Sem capa</div>
              </div>
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="flex flex-wrap gap-1">
          {album.labels.map(labelId => {
            const label = labels.find(l => l.id === labelId);
            return label ? (
              <LabelChip
                key={labelId}
                label={label}
                isSelected={false}
                onClick={() => {}}
                showCount={undefined}
                size="sm"
              />
            ) : null;
          })}
        </div>
      </CardContent>
    </Card>
  );
}