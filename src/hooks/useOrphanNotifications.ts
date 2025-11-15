import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrphanNotification {
  id: string;
  items_count: number;
  created_at: string;
  acknowledged: boolean;
}

export function useOrphanNotifications() {
  const [notifications, setNotifications] = useState<OrphanNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;

    const { data, error } = await supabase
      .from('drive_orphan_notifications')
      .select('*')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.length);
    }
  };

  const acknowledgeNotification = async (id: string) => {
    const { error } = await supabase
      .from('drive_orphan_notifications')
      .update({ 
        acknowledged: true, 
        acknowledged_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (!error) {
      loadNotifications();
    }
  };

  const acknowledgeAll = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;

    const { error } = await supabase
      .from('drive_orphan_notifications')
      .update({ 
        acknowledged: true, 
        acknowledged_at: new Date().toISOString() 
      })
      .eq('acknowledged', false);

    if (!error) {
      loadNotifications();
    }
  };

  useEffect(() => {
    loadNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('orphan-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'drive_orphan_notifications'
        },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    notifications,
    unreadCount,
    acknowledgeNotification,
    acknowledgeAll,
    reload: loadNotifications
  };
}
