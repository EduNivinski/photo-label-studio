import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function DriveConnected() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if coming from OAuth success
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('ok');

    if (ok === '1') {
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('drive:reauth:complete'));
      
      // Redirect to home after 2 seconds
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      // If no ok param, redirect immediately
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold">Google Drive Conectado!</h1>
        <p className="text-muted-foreground">
          Sua conexão com o Google Drive foi autorizada com sucesso.
          Redirecionando para a página inicial...
        </p>
      </Card>
    </div>
  );
}
