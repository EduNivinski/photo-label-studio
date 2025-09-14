import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GoogleDriveStatus {
  isConnected: boolean;
  isExpired: boolean;
  dedicatedFolder: {
    id: string;
    name: string;
  } | null;
  dedicatedFolderPath?: string | null;
}

export function useGoogleDriveSimple() {
  const [status, setStatus] = useState<GoogleDriveStatus>({
    isConnected: false,
    isExpired: false,
    dedicatedFolder: null,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const isCheckingStatus = useRef(false);
  const isConnecting = useRef(false);

  const checkStatus = useCallback(async (showErrors = false) => {
    // Prevent multiple simultaneous calls
    if (isCheckingStatus.current) {
      console.log('⏳ Status check already in progress, aborting duplicate call');
      return;
    }

    // Prevent check during loading
    if (loading) {
      console.log('⏳ Already loading, skipping status check');
      return;
    }

    try {
      isCheckingStatus.current = true;
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('⚠️ No session found');
        setStatus({
          isConnected: false,
          isExpired: false,
          dedicatedFolder: null,
        });
        return;
      }

      console.log('🔍 Checking Google Drive status...');
      const response = await supabase.functions.invoke('google-drive-auth', {
        body: { action: "status" },
      });

      console.log('📊 Status response:', response);

      if (response.error) {
        console.error('❌ Failed to check Google Drive status:', response.error);
        setStatus({
          isConnected: false,
          isExpired: false,
          dedicatedFolder: null,
        });
        
        if (showErrors) {
          toast({
            variant: 'destructive',
            title: 'Erro ao verificar status',
            description: 'Não foi possível verificar o status do Google Drive',
          });
        }
        return;
      }

      const statusData = response.data;
      const isConnected = Boolean(statusData?.connected);
      const isExpired = statusData?.reason === "EXPIRED";
      
      const newStatus = {
        isConnected,
        isExpired,
        dedicatedFolder: statusData?.dedicatedFolderId ? {
          id: statusData.dedicatedFolderId,
          name: statusData?.dedicatedFolderName || 'Drive Folder'
        } : null,
        dedicatedFolderPath: statusData?.dedicatedFolderPath || null,
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
      
      if (showErrors) {
        toast({
          variant: 'destructive',
          title: 'Erro de conexão',
          description: 'Falha ao conectar com o serviço do Google Drive',
        });
      }
    } finally {
      setLoading(false);
      isCheckingStatus.current = false;
    }
  }, [toast, loading]);

  const connect = useCallback(async () => {
    // Prevent multiple simultaneous connections
    if (isConnecting.current) {
      console.log('⏳ Connection already in progress, aborting duplicate call');
      return;
    }

    try {
      isConnecting.current = true;
      setLoading(true);
      
      console.log('🔗 Iniciando conexão Google Drive...');
      
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { 
          action: "authorize", 
          redirect: window.location.origin + "/user" 
        },
      });
      
      if (error) {
        console.error('❌ Erro ao obter authorizeUrl:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao conectar',
          description: 'Falha ao iniciar conexão com Google Drive',
        });
        return;
      }
      
      if (!data?.authorizeUrl) {
        throw new Error('authorizeUrl não retornada pela função');
      }
      
      console.log('✅ AuthorizeUrl obtida, redirecionando...');
      window.location.href = data.authorizeUrl;

    } catch (error) {
      console.error('Error connecting to Google Drive:', error);
      
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao conectar com Google Drive',
      });
    } finally {
      setLoading(false);
      isConnecting.current = false;
    }
  }, [toast]);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      
      await supabase.functions.invoke('google-drive-auth', {
        body: { action: "disconnect" },
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
  }, [toast]);

  // Only initialize on first mount, no automatic checking
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    console.log('🚀 Google Drive hook initialized - call checkStatus manually to verify connection');
    hasInitialized.current = true;
  }, []); // Empty dependency array - only run once

  // Listen for status change events from OAuth callback
  useEffect(() => {
    const handleStatusChange = () => {
      console.log('📡 Received Google Drive status change event, checking status...');
      checkStatus(false);
    };

    window.addEventListener('google-drive-status-changed', handleStatusChange);
    return () => window.removeEventListener('google-drive-status-changed', handleStatusChange);
  }, [checkStatus]);

  return {
    status,
    loading,
    checkStatus,
    connect,
    disconnect,
  };
}