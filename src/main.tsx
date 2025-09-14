import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useAppVersion } from './hooks/useAppVersion'
import { toast } from './components/ui/use-toast'

// Desativado por padrão para evitar cache eterno
const ENABLE_SW = import.meta.env.VITE_ENABLE_SW === 'true';
if ('serviceWorker' in navigator && ENABLE_SW) {
  // navigator.serviceWorker.register('/service-worker.js'); // desativado
}

function RootApp() {
  useAppVersion((version) => {
    toast({
      title: "Nova versão disponível",
      description: "Clique para atualizar a aplicação.",
      action: (
        <button 
          onClick={() => window.location.reload()}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus-visible:ring-destructive"
        >
          Atualizar
        </button>
      ),
    });
  }, 30000);

  return <App />;
}

createRoot(document.getElementById("root")!).render(<RootApp />);
