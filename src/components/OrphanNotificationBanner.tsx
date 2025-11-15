import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrphanNotifications } from '@/hooks/useOrphanNotifications';

export function OrphanNotificationBanner() {
  const { notifications, unreadCount, acknowledgeAll } = useOrphanNotifications();

  if (unreadCount === 0) return null;

  const totalOrphans = notifications.reduce((sum, n) => sum + n.items_count, 0);

  const handleViewDetails = () => {
    window.dispatchEvent(new CustomEvent('select-orphans-collection'));
    acknowledgeAll();
  };

  return (
    <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 mb-4">
      <AlertCircle className="h-5 w-5 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <strong>⚠️ Atenção:</strong> {totalOrphans} arquivo(s) não foram encontrados no Drive 
          após a última sincronização e foram movidos para <strong>Arquivos Órfãos</strong>.
          Eles serão automaticamente deletados em 30 dias.
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleViewDetails}
          >
            Ver Detalhes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={acknowledgeAll}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
