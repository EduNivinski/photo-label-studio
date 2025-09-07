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

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const checkStatus = useCallback(async () => {
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
      const isConnected = Boolean(statusData?.hasConnection);
      const isExpired = Boolean(statusData?.isExpired);
      
      const newStatus = {
        isConnected,
        isExpired,
        dedicatedFolder: statusData?.dedicatedFolderId ? {
          id: statusData.dedicatedFolderId,
          name: statusData.dedicatedFolderName || 'Pasta do Google Drive'
        } : null,
      };
      
      console.log('🔄 Updating status to:', newStatus);
      setStatus(newStatus);
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
  }, [getAuthHeaders]);

  const connect = useCallback(async () => {
    try {
      setLoading(true);
      
      // Log security event for connection attempt
      await logSecurityEvent({
        event_type: 'sensitive_operation',
        metadata: {
          action: 'google_drive_connection_attempt',
          timestamp: new Date().toISOString()
        }
      });

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

      if (!popup) {
        throw new Error('Popup bloqueado. Permita popups para este site.');
      }

      // Listen for auth success
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          popup?.close();
          
          console.log('🎉 Google Drive auth success received');
          
          // Validate the auth success data
          const validationResult = await validateGoogleDriveConnection(
            { code: event.data.code, state: event.data.state },
            { connection_source: 'popup_callback' }
          );

          if (validationResult.isValid) {
            // Show success toast
            toast({
              title: 'Conectado com sucesso!',
              description: `Google Drive conectado${event.data.user_email ? ` como ${event.data.user_email}` : ''}. Agora escolha uma pasta.`,
            });
            
            // Force refresh status immediately
            console.log('🔄 Refreshing Google Drive status...');
            await checkStatus();
            
            await logSecurityEvent({
              event_type: 'sensitive_operation',
              metadata: {
                action: 'google_drive_connection_success',
                validation_flags: validationResult.securityFlags,
                user_email: event.data.user_email
              }
            });
          } else {
            throw new Error('Dados de conexão inválidos recebidos');
          }
          
          window.removeEventListener('message', handleMessage);
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          popup?.close();
          
          console.error('❌ Google Drive auth error:', event.data.error);
          
          await logSecurityEvent({
            event_type: 'sensitive_operation',
            metadata: {
              action: 'google_drive_connection_error',
              error: event.data.error
            }
          });
          
          toast({
            variant: 'destructive',
            title: 'Erro na autenticação',
            description: event.data.error || 'Falha na autenticação com Google Drive',
          });
          
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
      
      await logSecurityEvent({
        event_type: 'sensitive_operation',
        metadata: {
          action: 'google_drive_connection_failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao conectar com Google Drive',
      });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, toast, validateGoogleDriveConnection, checkStatus]);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      
      await supabase.functions.invoke('google-drive-auth/disconnect', {
        headers,
      });

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
      console.error('Error disconnecting:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao desconectar Google Drive',
      });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, toast]);

  const listFolders = useCallback(async (): Promise<GoogleDriveFolder[]> => {
    try {
      const headers = await getAuthHeaders();
      console.log('🚀 Calling google-drive-api/folders...');
      
      const response = await supabase.functions.invoke('google-drive-api/folders', {
        headers,
      });

      console.log('📋 Folders response:', response);

      if (response.error) {
        console.error('❌ Error response from folders API:', response.error);
        throw new Error(response.error.message);
      }

      const folders = response.data?.folders || [];
      console.log('✅ Successfully retrieved folders:', folders.length);
      return folders;
    } catch (error) {
      console.error('💥 Error listing folders:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao listar pastas do Google Drive',
      });
      return [];
    }
  }, [getAuthHeaders, toast]);

  const setDedicatedFolder = useCallback(async (folderId: string, folderName: string) => {
    try {
      const headers = await getAuthHeaders();
      console.log('🔧 Setting dedicated folder:', { folderId, folderName });
      
      const response = await supabase.functions.invoke('google-drive-api/set-folder', {
        body: {
          folderId,
          folderName,
        },
        headers,
      });

      console.log('📁 Set folder response:', response);

      if (response.error) {
        console.error('❌ Error setting folder:', response.error);
        throw new Error(response.error.message);
      }

      setStatus(prev => ({
        ...prev,
        dedicatedFolder: { id: folderId, name: folderName },
      }));

      toast({
        title: 'Pasta configurada',
        description: `Pasta dedicada: ${folderName}`,
      });
    } catch (error) {
      console.error('💥 Error setting dedicated folder:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao configurar pasta dedicada',
      });
    }
  }, [getAuthHeaders, toast]);

  const listFiles = useCallback(async (folderId?: string): Promise<GoogleDriveFile[]> => {
    try {
      const targetFolderId = folderId || status.dedicatedFolder?.id;
      
      // Validate file operation parameters
      const validationResult = await validateFileOperation(
        { folderId: targetFolderId },
        { operation: 'list_files' }
      );

      if (!validationResult.isValid) {
        return [];
      }

      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke('google-drive-api', {
        body: {
          action: 'listFiles',
          folderId: validationResult.sanitizedData?.folderId
        },
        headers,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await logSecurityEvent({
        event_type: 'sensitive_operation',
        metadata: {
          action: 'google_drive_list_files',
          folder_id: validationResult.sanitizedData?.folderId,
          file_count: response.data.files?.length || 0
        }
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      
      await logSecurityEvent({
        event_type: 'sensitive_operation',
        metadata: {
          action: 'google_drive_list_files_error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao listar arquivos do Google Drive',
      });
      return [];
    }
  }, [getAuthHeaders, status.dedicatedFolder?.id, toast, validateFileOperation]);

  const downloadFile = useCallback(async (fileId: string): Promise<Blob | null> => {
    try {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke('google-drive-api', {
        body: {
          action: 'downloadFile',
          fileId,
        },
        headers,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Convert base64 to blob
      const base64Data = response.data.data;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: response.data.mimeType });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao baixar arquivo do Google Drive',
      });
      return null;
    }
  }, [getAuthHeaders, toast]);

  const uploadFile = useCallback(async (file: File, fileName?: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      const response = await supabase.functions.invoke('google-drive-api', {
        body: {
          action: 'uploadFile',
          fileName: fileName || file.name,
          mimeType: file.type,
          data: base64Data,
          folderId: status.dedicatedFolder?.id,
        },
        headers,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: 'Upload concluído',
        description: `Arquivo ${fileName || file.name} enviado com sucesso`,
      });

      return true;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: 'Falha ao enviar arquivo para Google Drive',
      });
      return false;
    }
  }, [getAuthHeaders, status.dedicatedFolder?.id, toast]);

  const importFileToPhotoLabel = useCallback(async (fileId: string, fileName: string): Promise<File | null> => {
    try {
      const blob = await downloadFile(fileId);
      if (!blob) return null;

      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error('Error importing file:', error);
      return null;
    }
  }, [downloadFile]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    loading: loading || isValidating,
    connect,
    disconnect,
    checkStatus,
    listFolders,
    setDedicatedFolder,
    listFiles,
    downloadFile,
    uploadFile,
    importFileToPhotoLabel,
  };
}