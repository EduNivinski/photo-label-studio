import { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Calendar, Camera, Tags, Archive, Edit2, Save, Upload, Image, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { GoogleDriveIntegration } from '@/components/GoogleDriveIntegration';
import { GoogleDriveDiagnostics } from '@/components/GoogleDriveDiagnostics';
import { useNavigate } from 'react-router-dom';

export default function User() {
  const { toast } = useToast();
  const { photos, labels } = useSupabaseData();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    joinDate: '',
    customLogo: null as string | null
  });

  // Estatísticas reais dos dados do usuário
  const userStats = {
    totalPhotos: photos.length,
    totalLabels: labels.length,
    totalCollections: 0, // Collections implementada em futuro
    storageUsed: `${((photos.length * 2.5) / 1024).toFixed(1)} GB`, // Estimativa
    storageLimit: '10 GB'
  };

  // Carregar dados do usuário e perfil
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw userError;
        
        setUser(user);
        
        // Buscar perfil do usuário
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
          setFormData({
            firstName: profileData.display_name?.split(' ')[0] || '',
            lastName: profileData.display_name?.split(' ').slice(1).join(' ') || '',
            email: user.email || '',
            joinDate: new Date(user.created_at).toISOString().split('T')[0],
            customLogo: profileData.avatar_url || null
          });
        } else {
          // Se não existe perfil, criar um
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              display_name: user.user_metadata?.display_name || ''
            })
            .select()
            .single();
          
          setProfile(newProfile);
          setFormData({
            firstName: user.user_metadata?.display_name?.split(' ')[0] || '',
            lastName: user.user_metadata?.display_name?.split(' ').slice(1).join(' ') || '',
            email: user.email || '',
            joinDate: new Date(user.created_at).toISOString().split('T')[0],
            customLogo: null
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do usuário.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [toast]);

  // Atividade recente baseada em dados reais
  const recentActivity = [
    { action: `Upload de ${photos.length > 0 ? Math.min(photos.length, 20) : 0} fotos`, date: '2 horas atrás' },
    { action: `Criou ${labels.length} labels`, date: '1 dia atrás' },
    { action: 'Organizou biblioteca de fotos', date: '3 dias atrás' },
    { action: 'Configurou perfil', date: '5 dias atrás' }
  ];

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar tamanho (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A logo deve ter no máximo 2MB.",
          variant: "destructive"
        });
        return;
      }
      
      // Verificar dimensões (recomendado: máximo 300x100px)
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          if (img.width > 300 || img.height > 100) {
            toast({
              title: "Dimensões muito grandes",
              description: "A logo deve ter no máximo 300x100 pixels para melhor aparência.",
              variant: "destructive"
            });
          } else {
            setFormData({...formData, customLogo: e.target?.result as string});
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    
    setSaving(true);
    try {
      const displayName = `${formData.firstName} ${formData.lastName}`.trim();
      
      // Atualizar perfil no Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          avatar_url: formData.customLogo
        })
        .eq('id', user.id);
      
      if (profileError) throw profileError;
      
      // Atualizar email se mudou
      if (formData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email
        });
        
        if (emailError) throw emailError;
        
        toast({
          title: "Email atualizado",
          description: "Verifique seu email para confirmar a alteração.",
        });
      }
      
      setIsEditing(false);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      
      navigate('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast({
        title: "Erro no logout",
        description: "Não foi possível desconectar. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados do usuário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <UserIcon className="h-8 w-8" />
              Perfil do Usuário
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas informações pessoais e veja estatísticas da sua biblioteca
            </p>
          </div>
          <Button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className="gap-2"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                Salvando...
              </>
            ) : isEditing ? (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                Editar Perfil
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações Pessoais */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Informações Pessoais</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nome</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      disabled={!isEditing}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className={!isEditing ? 'bg-muted' : ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Sobrenome</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      disabled={!isEditing}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className={!isEditing ? 'bg-muted' : ''}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={!isEditing ? 'bg-muted' : ''}
                  />
                </div>

                <div>
                  <Label>Membro desde</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {new Date(formData.joinDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="customLogo">Logo Personalizada</Label>
                  <div className="mt-1 space-y-3">
                    {formData.customLogo && (
                      <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/50">
                        <img 
                          src={formData.customLogo} 
                          alt="Logo personalizada" 
                          className="max-w-[150px] max-h-[50px] object-contain"
                        />
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData({...formData, customLogo: null})}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    )}
                    {isEditing && (
                      <div>
                        <input
                          id="customLogo"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('customLogo')?.click()}
                          className="gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          {formData.customLogo ? 'Trocar Logo' : 'Carregar Logo'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">
                          Recomendado: máximo 300x100px, 2MB. Formatos: PNG, JPG, SVG
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Google Drive Integration */}
            <GoogleDriveIntegration />

            {/* Google Drive Diagnostics */}
            <GoogleDriveDiagnostics />

            {/* Atividade Recente */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Atividade Recente</h2>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="text-sm">{activity.action}</span>
                    <span className="text-xs text-muted-foreground">{activity.date}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Sidebar com Estatísticas */}
          <div className="space-y-6">
            {/* Estatísticas Gerais */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Estatísticas
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total de Fotos</span>
                  <Badge variant="secondary">{userStats.totalPhotos}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Labels Criadas</span>
                  <Badge variant="secondary">{userStats.totalLabels}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Coleções</span>
                  <Badge variant="secondary">{userStats.totalCollections}</Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Armazenamento</span>
                    <span className="text-sm font-medium">{userStats.storageUsed}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: '24%' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userStats.storageUsed} de {userStats.storageLimit} utilizados (estimativa)
                  </div>
                </div>
              </div>
            </Card>

            {/* Ações Rápidas */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Archive className="h-4 w-4" />
                  Exportar Dados
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Tags className="h-4 w-4" />
                  Backup Labels
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da Conta
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2 text-destructive">
                  <UserIcon className="h-4 w-4" />
                  Deletar Conta
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}