import { FolderOpen, AlertTriangle, Brain, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface NavigationHubProps {
  albumsCount?: number;
  unlabeledCount?: number;
  clustersCount?: number;
  onScrollToSection?: (section: 'collections' | 'unlabeled' | 'smart') => void;
}

export function NavigationHub({ 
  albumsCount = 0, 
  unlabeledCount = 0, 
  clustersCount = 0,
  onScrollToSection 
}: NavigationHubProps) {
  const navigate = useNavigate();

  const handleCardClick = (section: 'collections' | 'unlabeled' | 'smart') => {
    if (onScrollToSection) {
      onScrollToSection(section);
    } else {
      // Fallback navigation routes
      const routes = {
        collections: '/collections',
        unlabeled: '/?filter=unlabeled',
        smart: '/?filter=smart'
      };
      navigate(routes[section]);
    }
  };

  const cards = [
    {
      id: 'collections',
      title: 'Minhas Coleções',
      icon: FolderOpen,
      count: albumsCount,
      description: 'Álbuns organizados',
      bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      visual: (
        <div className="absolute top-2 right-2 flex -space-x-1">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-700 dark:to-blue-800 rounded-sm shadow-sm transform rotate-3"></div>
          <div className="w-6 h-6 bg-gradient-to-br from-blue-300 to-blue-400 dark:from-blue-600 dark:to-blue-700 rounded-sm shadow-sm transform -rotate-2"></div>
          <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-500 dark:from-blue-500 dark:to-blue-600 rounded-sm shadow-sm"></div>
        </div>
      )
    },
    {
      id: 'unlabeled',
      title: 'Fotos para Organizar',
      icon: AlertTriangle,
      count: unlabeledCount,
      description: 'Sem etiquetas',
      bgGradient: 'from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      visual: (
        <div className="absolute top-2 right-2 flex -space-x-1">
          <div className="w-6 h-6 bg-gradient-to-br from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 rounded-sm shadow-sm transform rotate-6 opacity-80"></div>
          <div className="w-6 h-6 bg-gradient-to-br from-amber-300 to-amber-400 dark:from-amber-600 dark:to-amber-700 rounded-sm shadow-sm transform -rotate-3"></div>
          <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 rounded-sm shadow-sm border-2 border-amber-300 dark:border-amber-600 animate-pulse"></div>
        </div>
      )
    },
    {
      id: 'smart',
      title: 'Sugestões Inteligentes',
      icon: Brain,
      count: clustersCount,
      description: 'IA organizando',
      bgGradient: 'from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
      visual: (
        <div className="absolute top-2 right-2 flex -space-x-1">
          <div className="w-5 h-5 bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800 rounded-full shadow-sm animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-4 h-4 bg-gradient-to-br from-purple-300 to-purple-400 dark:from-purple-600 dark:to-purple-700 rounded-full shadow-sm animate-bounce" style={{ animationDelay: '200ms' }}></div>
          <div className="w-3 h-3 bg-gradient-to-br from-purple-400 to-purple-500 dark:from-purple-500 dark:to-purple-600 rounded-full shadow-sm animate-bounce" style={{ animationDelay: '400ms' }}></div>
        </div>
      )
    }
  ];

  return (
    <section className="p-6 border-b border-border/50">
      
      {/* Mobile Carousel / Desktop Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 overflow-x-auto md:overflow-x-visible">
        <div className="flex md:grid md:grid-cols-3 md:col-span-3 gap-4 md:gap-6 snap-x snap-mandatory md:snap-none pb-2 md:pb-0"
             style={{ minWidth: 'max-content' }}
        >
          {cards.map((card) => {
            const IconComponent = card.icon;
            return (
              <Card
                key={card.id}
                className={`relative p-4 md:p-6 cursor-pointer group transition-all duration-300 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-primary/20 bg-gradient-to-br ${card.bgGradient} flex-shrink-0 snap-center min-w-[280px] md:min-w-0`}
                onClick={() => handleCardClick(card.id as 'collections' | 'unlabeled' | 'smart')}
              >
              {card.visual}
              
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`p-3 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent className={`h-6 w-6 ${card.iconColor}`} />
                </div>
                
                <div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                  <div className="flex items-center justify-center mt-2 space-x-1">
                    <span className={`text-lg font-bold ${card.iconColor}`}>
                      {card.count}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}