import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Photo, Label } from '@/types/photo';

export function useSupabaseData() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = async () => {
    const { data, error } = await (supabase as any)
      .from('photos')
      .select('*')
      .order('upload_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching photos:', error);
      return;
    }
    
    const formattedPhotos: Photo[] = (data || []).map((photo: any) => ({
      id: photo.id,
      url: photo.url,
      name: photo.name,
      uploadDate: photo.upload_date,
      labels: photo.labels || []
    }));
    
    setPhotos(formattedPhotos);
  };

  const fetchLabels = async () => {
    const { data, error } = await (supabase as any)
      .from('labels')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching labels:', error);
      return;
    }
    
    const formattedLabels: Label[] = (data || []).map((label: any) => ({
      id: label.id,
      name: label.name,
      color: label.color || undefined
    }));
    
    setLabels(formattedLabels);
  };

  const createLabel = async (name: string, color?: string) => {
    const { data, error } = await (supabase as any)
      .from('labels')
      .insert({ name, color })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating label:', error);
      return null;
    }
    
    if (!data) return null;
    
    const newLabel: Label = {
      id: data.id,
      name: data.name,
      color: data.color || undefined
    };
    
    setLabels(prev => [...prev, newLabel]);
    return newLabel;
  };

  const deleteLabel = async (labelId: string) => {
    const { error } = await (supabase as any)
      .from('labels')
      .delete()
      .eq('id', labelId);
    
    if (error) {
      console.error('Error deleting label:', error);
      return false;
    }
    
    setLabels(prev => prev.filter(label => label.id !== labelId));
    
    // Remove label from all photos that have it
    const photosWithLabel = photos.filter(photo => photo.labels.includes(labelId));
    for (const photo of photosWithLabel) {
      const updatedLabels = photo.labels.filter(id => id !== labelId);
      await (supabase as any)
        .from('photos')
        .update({ labels: updatedLabels })
        .eq('id', photo.id);
    }
    
    if (photosWithLabel.length > 0) {
      await fetchPhotos(); // Refresh photos only if changes were made
    }
    
    return true;
  };

  const updatePhotoLabels = async (photoId: string, labelIds: string[]) => {
    const { error } = await (supabase as any)
      .from('photos')
      .update({ labels: labelIds })
      .eq('id', photoId);
    
    if (error) {
      console.error('Error updating photo labels:', error);
      return false;
    }
    
    setPhotos(prev => prev.map(photo => 
      photo.id === photoId 
        ? { ...photo, labels: labelIds }
        : photo
    ));
    
    return true;
  };

  const deletePhoto = async (photoId: string) => {
    // Get photo data first to delete from storage
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return false;

    // Extract file path from URL for storage deletion
    const url = new URL(photo.url);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('photos')
      .remove([fileName]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
    }

    // Delete from database
    const { error } = await (supabase as any)
      .from('photos')
      .delete()
      .eq('id', photoId);
    
    if (error) {
      console.error('Error deleting photo:', error);
      return false;
    }
    
    setPhotos(prev => prev.filter(photo => photo.id !== photoId));
    return true;
  };

  const uploadPhotos = async (files: File[]) => {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return null;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Save to database
      const { data: photoData, error: dbError } = await (supabase as any)
        .from('photos')
        .insert({
          url: publicUrl,
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          labels: []
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error saving to database:', dbError);
        return null;
      }

      if (!photoData) return null;

      return {
        id: photoData.id,
        url: photoData.url,
        name: photoData.name,
        uploadDate: photoData.upload_date,
        labels: photoData.labels || []
      } as Photo;
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter(Boolean) as Photo[];
    
    setPhotos(prev => [...successfulUploads, ...prev]);
    return successfulUploads;
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchPhotos(), fetchLabels()]);
      setLoading(false);
    };

    initializeData();

    // Set up real-time subscriptions
    const photosChannel = supabase
      .channel('photos-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'photos' },
        () => fetchPhotos()
      )
      .subscribe();

    const labelsChannel = supabase
      .channel('labels-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'labels' },
        () => fetchLabels()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(photosChannel);
      supabase.removeChannel(labelsChannel);
    };
  }, []);

  return {
    photos,
    labels,
    loading,
    createLabel,
    deleteLabel,
    updatePhotoLabels,
    deletePhoto,
    uploadPhotos,
    getSuggestedLabels: async (imageUrl: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('suggest-labels', {
          body: { imageUrl }
        });

        if (error) {
          console.error('Error getting suggestions:', error);
          return {
            suggestions: ['paisagem', 'natureza', 'pessoas'], // Fallback mock data
            source: 'mock' as const
          };
        }

        return data;
      } catch (error) {
        console.error('Error calling suggest-labels function:', error);
        return {
          suggestions: ['paisagem', 'natureza', 'pessoas'], // Fallback mock data
          source: 'mock' as const
        };
      }
    },
    applyLabelSuggestions: async (photoId: string, labelNames: string[]) => {
      try {
        // Create labels that don't exist yet
        const existingLabelNames = labels.map(l => l.name.toLowerCase());
        const newLabelNames = labelNames.filter(name => 
          !existingLabelNames.includes(name.toLowerCase())
        );

        // Create new labels
        for (const labelName of newLabelNames) {
          await createLabel(labelName);
        }

        // Get current labels including newly created ones by refetching
        await fetchLabels();
        
        // Find all label IDs for the names we want to apply
        const labelIdsToApply = labelNames.map(name => {
          const existingLabel = labels.find(l => 
            l.name.toLowerCase() === name.toLowerCase()
          );
          return existingLabel?.id;
        }).filter(Boolean) as string[];

        // Get current photo labels and add new ones
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          const currentPhotoLabels = photo.labels;
          const updatedLabels = Array.from(new Set([...currentPhotoLabels, ...labelIdsToApply]));
          await updatePhotoLabels(photoId, updatedLabels);
        }

        return true;
      } catch (error) {
        console.error('Error applying label suggestions:', error);
        return false;
      }
    },
    refetch: () => Promise.all([fetchPhotos(), fetchLabels()])
  };
}