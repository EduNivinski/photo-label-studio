import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface DriveReauthBannerProps {
  onReauthComplete?: () => void;
}

export function DriveReauthBanner({ onReauthComplete }: DriveReauthBannerProps) {
  const [loading, setLoading] = useState(false);

  // Listen for reauth completion event
  useEffect(() => {
    const handleReauthComplete = () => {
      console.log('[DriveReauthBanner] Reauth completed, refreshing...');
      onReauthComplete?.();
    };

    window.addEventListener('drive:reauth:complete', handleReauthComplete);
    return () => window.removeEventListener('drive:reauth:complete', handleReauthComplete);
  }, [onReauthComplete]);

  const handleReauthorize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-drive-auth', {
        body: { action: 'auth_url' }
      });

      if (error) {
        console.error('Failed to get auth URL:', error);
        toast.error('Erro ao gerar URL de autorização');
        setLoading(false);
        return;
      }

      if (data?.authorizeUrl) {
        // Redirect to Google OAuth consent screen (full page redirect)
        window.location.href = data.authorizeUrl;
      } else {
        toast.error('URL de autorização não retornada');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error during reauthorization:', error);
      toast.error('Erro ao iniciar reautorização');
      setLoading(false);
    }
  };

  return (
    <Alert variant="default" className="mb-6 border-warning bg-warning/10">
      <AlertCircle className="h-5 w-5 text-warning" />
      <AlertTitle className="text-warning font-semibold">
        Permissões do Google Drive Necessárias
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm text-muted-foreground">
          Para exibir miniaturas do Google Drive, precisamos de permissão para ler o conteúdo dos seus arquivos.
          Isso é necessário para gerar visualizações de alta qualidade.
        </p>
        <Button 
          onClick={handleReauthorize}
          disabled={loading}
          variant="default"
          size="sm"
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          {loading ? 'Redirecionando...' : 'Reautorizar Google Drive'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
