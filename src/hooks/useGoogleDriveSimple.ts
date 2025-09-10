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

  const checkStatus = useCallback(async (showErrors = false) => {
    try {
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
        dedicatedFolder: statusData?.folderId ? {
          id: statusData.folderId,
          name: 'Drive Folder'
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
      
      if (showErrors) {
        toast({
          variant: 'destructive',
          title: 'Erro de conexão',
          description: 'Falha ao conectar com o serviço do Google Drive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const connect = useCallback(async () => {
    try {
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

  // Initialize once
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    const initialize = async () => {
      try {
        console.log('🚀 Initializing Google Drive hook...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          console.log('👤 User authenticated, checking status');
          await checkStatus();
        } else {
          console.log('👤 User not authenticated, skipping status check');
        }
      } catch (error) {
        console.error('❌ Error during initialization:', error);
      } finally {
        hasInitialized.current = true;
      }
    };

    initialize();
  }, []); // Empty dependency array - only run once

  return {
    status,
    loading,
    checkStatus,
    connect,
    disconnect,
  };
}