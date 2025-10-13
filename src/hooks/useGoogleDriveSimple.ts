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
  const [loading, setLoading] = useState(true); // Start as loading until first check
  const { toast } = useToast();
  const hasInitialized = useRef(false);
  const isCheckingStatus = useRef(false);
  const isConnecting = useRef(false);
  const optimisticUntil = useRef(0);
  const optimisticData = useRef<{ id: string; name: string; path?: string | null } | null>(null);
  const lastStatusVersion = useRef<string | null>(null);

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
      const incomingVersion = statusData?.statusVersion || statusData?.updatedAt;
      
      console.log('[DRIVE_STATUS] Raw status data:', statusData);
      
      const newStatus = {
        isConnected,
        isExpired,
        dedicatedFolder: statusData?.dedicatedFolderId ? {
          id: statusData.dedicatedFolderId,
          name: statusData?.dedicatedFolderName || 'Drive Folder'
        } : null,
        dedicatedFolderPath: statusData?.dedicatedFolderPath || null,
      };
      
      // Only accept data if version is newer or equal (prevents stale cache)
      const shouldAccept = !lastStatusVersion.current || 
                          !incomingVersion ||
                          incomingVersion >= lastStatusVersion.current;
      
      if (!shouldAccept) {
        console.log('[DRIVE_STATUS] Ignoring stale status response');
        return;
      }
      
      // If we recently updated the folder optimistically and server is still stale, keep optimistic briefly
      const now = Date.now();
      if (
        optimisticData.current && now < optimisticUntil.current &&
        (
          !newStatus.dedicatedFolder ||
          newStatus.dedicatedFolder.id !== optimisticData.current.id ||
          newStatus.dedicatedFolderPath !== (optimisticData.current.path ?? optimisticData.current.name)
        )
      ) {
        console.log('[DRIVE_STATUS] Server appears stale; keeping optimistic folder for a short period');
        setStatus(prev => ({
          ...prev,
          isConnected: newStatus.isConnected,
          isExpired: newStatus.isExpired,
          dedicatedFolder: { id: optimisticData.current!.id, name: optimisticData.current!.name },
          dedicatedFolderPath: optimisticData.current!.path ?? optimisticData.current!.name,
        }));
      } else {
        console.log('[DRIVE_STATUS] Updating status to:', newStatus);
        setStatus(newStatus);
        lastStatusVersion.current = incomingVersion;
        // Clear optimistic data once server confirms
        optimisticData.current = null;
        optimisticUntil.current = 0;
      }

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
      
      // Call the new google-drive-auth endpoint (POST only)
      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: {}  // No body needed, user ID comes from JWT
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
      
      console.log('✅ AuthorizeUrl obtida, redirecionando para Google...');
      // Redirect to Google OAuth (not opening popup)
      window.location.href = data.authorizeUrl;

    } catch (error) {
      console.error('❌ Error connecting to Google Drive:', error);
      
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

  // Bootstrap: clean legacy storage and fetch fresh status on mount
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    // Clear any legacy localStorage keys that might contain stale folder data
    const legacyKeys = [
      'driveFolderPath', 
      'driveFolderName',
      'googleDrive.dedicatedFolder', 
      'pl_backup_path',
      'drive_folder_id',
    ];
    legacyKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Failed to clear legacy key:', key);
      }
    });

    console.log('🚀 Google Drive hook initialized - fetching fresh status from server');
    hasInitialized.current = true;
    
    // Fetch fresh status on mount
    checkStatus(false);
  }, [checkStatus]);

  // Revalidate on focus/visibility change to ensure fresh data
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Window focused - revalidating Drive status');
      checkStatus(false);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab visible - revalidating Drive status');
        checkStatus(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkStatus]);

  // Listen for status change events from OAuth callback
  useEffect(() => {
    const handleStatusChange = () => {
      console.log('📡 Received Google Drive status change event, checking status...');
      checkStatus(false);
    };

    const handleFolderUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        dedicatedFolderId: string;
        dedicatedFolderName: string;
        dedicatedFolderPath?: string | null;
      } | undefined;

      if (!detail) return;
      console.log('📁 Optimistic folder update received:', detail);

      // hold optimistic state for a short window to avoid server race
      optimisticData.current = {
        id: detail.dedicatedFolderId,
        name: detail.dedicatedFolderName,
        path: detail.dedicatedFolderPath ?? detail.dedicatedFolderName,
      };
      optimisticUntil.current = Date.now() + 5000; // 5s hold

      setStatus((prev) => ({
        ...prev,
        dedicatedFolder: {
          id: detail.dedicatedFolderId,
          name: detail.dedicatedFolderName,
        },
        dedicatedFolderPath: detail.dedicatedFolderPath ?? detail.dedicatedFolderName,
      }));

      // Also schedule a server-confirmed status refresh
      setTimeout(() => checkStatus(false), 800);
    };

    window.addEventListener('google-drive-status-changed', handleStatusChange);
    window.addEventListener('google-drive-folder-updated', handleFolderUpdated as EventListener);
    return () => {
      window.removeEventListener('google-drive-status-changed', handleStatusChange);
      window.removeEventListener('google-drive-folder-updated', handleFolderUpdated as EventListener);
    };
  }, [checkStatus]);

  return {
    status,
    loading,
    checkStatus,
    connect,
    disconnect,
  };
}