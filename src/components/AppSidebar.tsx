import { useState, useEffect } from 'react';
import { 
  User, 
  Upload, 
  Tag, 
  FolderOpen, 
  Library,
  Settings,
  Search,
  X
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { supabase } from '@/integrations/supabase/client';

const navigation = [
  { title: 'Home', url: '/', icon: Library },
  { title: 'Upload de Fotos', url: '/upload', icon: Upload },
  { title: 'Gestão de Labels', url: '/labels', icon: Tag },
  { title: 'Minhas Coleções', url: '/collections', icon: FolderOpen },
  { title: 'Perfil do Usuário', url: '/user', icon: User },
  { title: 'Integrações', url: '/settings/drive', icon: Settings },
];

interface AppSidebarProps {
  onUpload?: () => void;
  onManageLabels?: () => void;
  onManageCollections?: () => void;
}

export function AppSidebar({
  onUpload,
  onManageLabels,
  onManageCollections
}: AppSidebarProps) {
  const { open, setOpen } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [userProfile, setUserProfile] = useState<any>(null);

  // Carregar perfil do usuário
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setUserProfile(profile);
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      }
    };

    loadUserProfile();

    // Escutar mudanças no perfil
    const channel = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles'
      }, (payload) => {
        loadUserProfile();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isActive = (path: string) => currentPath === path;

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'upload':
        onUpload?.();
        break;
      case 'labels':
        onManageLabels?.();
        break;
      case 'collections':
        onManageCollections?.();
        break;
    }
  };

  return (
    <Sidebar
      className="border-r border-border bg-sidebar"
      collapsible="icon"
    >
      <SidebarHeader className="p-4 border-b border-border bg-black">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
            {userProfile?.display_name ? userProfile.display_name.charAt(0).toUpperCase() : 'U'}
          </div>
          {open && (
            <div>
              <h2 className="text-sm font-medium text-white">
                {userProfile?.display_name || 'Usuário'}
              </h2>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs">
            {open && 'Navegação'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild
                  className={`relative ${
                    isActive(item.url) 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  } transition-all duration-200`}
                >
                  <NavLink 
                    to={item.url} 
                    className={`flex items-center gap-3 ${
                      isActive(item.url) 
                        ? 'border-l-4 border-l-sidebar-primary pl-3' 
                        : 'pl-4'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${
                      isActive(item.url) ? 'text-sidebar-primary' : ''
                    }`} />
                    {open && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


      </SidebarContent>
    </Sidebar>
  );
}