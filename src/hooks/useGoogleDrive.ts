import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSecurityValidation } from '@/hooks/useSecurityValidation';
import { logSecurityEvent } from '@/lib/securityMonitoring';

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
  const { 
    validateGoogleDriveConnection, 
    validateFileOperation,
    isValidating 
  } = useSecurityValidation();

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
      
      console.log('🔍 Checking Google Drive status...');
      const response = await supabase.functions.invoke('google-drive-auth/status', {
        headers,
      });

      console.log('📊 Status response:', response);

      if (response.error) {
        console.error('❌ Failed to check Google Drive status:', response.error);
        // Don't set loading false here to avoid infinite loops
        setStatus({
          isConnected: false,
          isExpired: false,
          dedicatedFolder: null,
        });
        return;
      }

      const statusData = response.data;
      console.log('✅ Status data received:', statusData);
      
      // Ensure isConnected is a boolean
      const isConnected = Boolean(statusData?.isConnected);
      const isExpired = Boolean(statusData?.isExpired);
      
      setStatus({
        isConnected,
        isExpired,
        dedicatedFolder: statusData?.dedicatedFolder || null,
      });
    } catch (error) {
      console.error('💥 Error checking Google Drive status:', error);
      setStatus({
        isConnected: false,
        isExpired: false,
        dedicatedFolder: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      const response = await supabase.functions.invoke('google-drive-auth/authorize', {
        headers,
      });

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

  const listFolders = useCallback(async (): Promise<GoogleDriveFolder[]> => {
    try {
      const headers = await getAuthHeaders();
      console.log('🔍 Calling listFolders with headers:', headers);
      
      const response = await supabase.functions.invoke('google-drive-api/folders', {
        headers,
      });

      console.log('📁 listFolders response:', response);

      if (response.error) {
        console.error('❌ listFolders error:', response.error);
        toast({
          variant: 'destructive',
          title: 'Erro ao buscar pastas',
          description: response.error.message || 'Falha ao buscar pastas do Google Drive',
        });
        throw new Error(response.error.message || 'Failed to fetch folders');
      }

      if (!response.data) {
        console.error('❌ No data in response');
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Resposta vazia do Google Drive',
        });
        return [];
      }

      const folders = response.data.folders || response.data || [];
      console.log('✅ Parsed folders:', folders, 'Count:', folders.length);
      
      if (folders.length === 0) {
        toast({
          title: 'Nenhuma pasta encontrada',
          description: 'Não foram encontradas pastas no seu Google Drive',
        });
      }
      
      return folders;
    } catch (error) {
      console.error('💥 Error listing folders:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de conexão',
        description: 'Falha ao conectar com Google Drive. Tente novamente.',
      });
      throw error;
    }
  }, [toast]);

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

  // Import file from Google Drive to Photo Label
  const importFileToPhotoLabel = async (fileId: string, fileName: string): Promise<File> => {
    try {
      setLoading(true);
      
      const headers = await getAuthHeaders();
      
      // Download file from Google Drive
      const response = await fetch(`https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1/google-drive-api/download?fileId=${fileId}`, {
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to download file from Google Drive');
      }

      // Convert response to File object
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

      return file;
    } catch (error) {
      console.error('Error importing file from Google Drive:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na importação',
        description: `Falha ao importar ${fileName} do Google Drive`,
      });
      throw error;
    } finally {
      setLoading(false);
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
    importFileToPhotoLabel,
    checkStatus,
  };
}