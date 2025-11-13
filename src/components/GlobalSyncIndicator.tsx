import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDriveSyncStatus } from "@/hooks/useDriveSyncStatus";
import { Link } from "react-router-dom";

export function GlobalSyncIndicator() {
  const syncStatus = useDriveSyncStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastSyncId, setLastSyncId] = useState<string>("");

  // Reset dismissed state when a new sync starts
  useEffect(() => {
    if (syncStatus.isActive) {
      const currentSyncId = `${syncStatus.processed}-${syncStatus.pending}`;
      if (currentSyncId !== lastSyncId) {
        setIsDismissed(false);
        setLastSyncId(currentSyncId);
      }
    }
  }, [syncStatus.isActive, syncStatus.processed, syncStatus.pending, lastSyncId]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const totalFolders = syncStatus.processed + syncStatus.pending;
  const progressPercent = totalFolders > 0 ? (syncStatus.processed / totalFolders) * 100 : 0;

  return (
    <AnimatePresence>
      {syncStatus.isActive && !isDismissed && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white shadow-lg"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <p className="font-medium text-sm md:text-base">
                      Sincronizando Google Drive
                    </p>
                    <p className="text-xs md:text-sm opacity-90 whitespace-nowrap">
                      {syncStatus.processed}/{totalFolders} pastas
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-orange-600 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className="bg-white h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to="/drive-settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-orange-600 hover:text-white h-8 text-xs"
                  >
                    Detalhes
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-white hover:bg-orange-600 hover:text-white h-8 w-8 p-0"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
