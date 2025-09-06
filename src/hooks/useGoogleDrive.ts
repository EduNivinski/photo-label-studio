import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  thumbnailLink?: string;
  webViewLink: string;
  mediaType: 'photo' | 'video';
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
}

export interface GoogleDriveStatus {
  isConnected: boolean;
  isExpired: boolean;
  dedicatedFolder: {
    id: string;
    name: string;
  } | null;
}

export function useGoogleDrive() {
  const [status, setStatus] = useState<GoogleDriveStatus>({
    isConnected: false,
    isExpired: false,
    dedicatedFolder: null,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const checkStatus = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      const response = await supabase.functions.invoke('google-drive-auth/status', {
        headers,
      });

      if (response.error) {
        console.error('Failed to check Google Drive status:', response.error);
        return;
      }

      setStatus(response.data);
    } catch (error) {
      console.error('Error checking Google Drive status:', error);
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      setLoading(true);
      
      const response = await supabase.functions.invoke('google-drive-auth/authorize');

      if (response.error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao conectar',
          description: 'Falha ao iniciar conexão com Google Drive',
        });
        return;
      }

      // Open popup for OAuth
      const popup = window.open(
        response.data.authUrl,
        'google-drive-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for auth success
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
          popup?.close();
          
          // Store tokens in database
          const { tokens } = event.data;
          await storeTokens(tokens);
          
          toast({
            title: 'Conectado com sucesso!',
            description: 'Google Drive conectado. Agora escolha uma pasta.',
          });
          
          await checkStatus();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed without auth
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
        }
      }, 1000);

    } catch (error) {
      console.error('Error connecting to Google Drive:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao conectar com Google Drive',
      });
    } finally {
      setLoading(false);
    }
  };

  const storeTokens = async (tokens: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('google_drive_tokens')
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

      if (error) {
        console.error('Failed to store tokens:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      const response = await supabase.functions.invoke('google-drive-auth/disconnect', {
        headers,
      });

      if (response.error) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Falha ao desconectar Google Drive',
        });
        return;
      }

      setStatus({
        isConnected: false,
        isExpired: false,
        dedicatedFolder: null,
      });

      toast({
        title: 'Desconectado',
        description: 'Google Drive desconectado com sucesso',
      });
    } catch (error) {
      console.error('Error disconnecting from Google Drive:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao desconectar Google Drive',
      });
    } finally {
      setLoading(false);
    }
  };

  const listFolders = async (): Promise<GoogleDriveFolder[]> => {
    try {
      const headers = await getAuthHeaders();
      
      const response = await supabase.functions.invoke('google-drive-api/folders', {
        headers,
      });

      if (response.error) {
        throw new Error('Failed to fetch folders');
      }

      return response.data.folders || [];
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  };

  const setDedicatedFolder = async (folderId: string, folderName: string) => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      const response = await supabase.functions.invoke('google-drive-api/set-folder', {
        body: { folderId, folderName },
        headers,
      });

      if (response.error) {
        throw new Error('Failed to set dedicated folder');
      }

      await checkStatus();
      
      toast({
        title: 'Pasta configurada',
        description: `Pasta "${folderName}" configurada como pasta dedicada`,
      });
    } catch (error) {
      console.error('Error setting dedicated folder:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao configurar pasta dedicada',
      });
    } finally {
      setLoading(false);
    }
  };

  const listFiles = async (folderId?: string): Promise<{ files: GoogleDriveFile[]; folders: GoogleDriveFolder[] }> => {
    try {
      const headers = await getAuthHeaders();
      const url = folderId ? `google-drive-api/files?folderId=${folderId}` : 'google-drive-api/files';
      
      const response = await supabase.functions.invoke(url, {
        headers,
      });

      if (response.error) {
        throw new Error('Failed to fetch files');
      }

      return {
        files: response.data.files || [],
        folders: response.data.folders || [],
      };
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  };

  const downloadFile = async (fileId: string): Promise<Blob> => {
    try {
      const headers = await getAuthHeaders();
      
      const response = await supabase.functions.invoke(`google-drive-api/download?fileId=${fileId}`, {
        headers,
      });

      if (response.error) {
        throw new Error('Failed to download file');
      }

      return response.data;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  };

  const uploadFile = async (file: File, fileName?: string): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.append('file', file);
      if (fileName) {
        formData.append('fileName', fileName);
      }
      
      const response = await supabase.functions.invoke('google-drive-api/upload', {
        body: formData,
        headers: {
          'Authorization': headers.Authorization,
        },
      });

      if (response.error) {
        throw new Error('Failed to upload file');
      }

      toast({
        title: 'Upload concluído',
        description: `Arquivo "${file.name}" enviado para Google Drive`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: 'Falha ao enviar arquivo para Google Drive',
      });
      throw error;
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return {
    status,
    loading,
    connect,
    disconnect,
    listFolders,
    setDedicatedFolder,
    listFiles,
    downloadFile,
    uploadFile,
    checkStatus,
  };
}