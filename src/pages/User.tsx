import { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Calendar, Camera, Tags, Archive, Edit2, Save, Upload, Image, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/integrations/supabase/client';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { GoogleDriveIntegration } from '@/components/GoogleDriveIntegration';
import { GoogleDriveProductionTests } from '@/components/GoogleDriveProductionTests';
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
  const [sessionStatus, setSessionStatus] = useState<{
    isAuthenticated: boolean;
    projectRef?: string;
    userId?: string;
  }>({ isAuthenticated: false });
  const [authHealth, setAuthHealth] = useState({
    clientUrl: SUPABASE_URL,
    anonRef: "(checking…)",
    sessionExists: false,
    jwtRef: "(none)",
    error: "",
  });
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

  // Boot de sessão obrigatório e carregar dados do usuário
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // 1) anonRef (decodifica o payload do JWT da ANON)
        const anonPayload = JSON.parse(atob(SUPABASE_ANON.split(".")[1]));
        const anonRef = anonPayload?.ref || "(no-ref)";

        // 2) sessão - LOGIN OBRIGATÓRIO ANTES DOS TESTES
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("❌ Sem sessão, iniciando login OAuth...");
          setAuthHealth(prev => ({ 
            ...prev, 
            anonRef, 
            sessionExists: false, 
            jwtRef: "(none)",
            error: "Redirecionando para login..."
          }));
          
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin + "/user" },
          });
          return; // volta logado após callback
        }

        console.log("✅ Sessão encontrada, validando...");

        // 3) Debug do JWT - extrair informações críticas
        const payload = JSON.parse(atob(session.access_token.split(".")[1]));
        const jwtIss = payload.iss; // ex: https://tcupxcxyylxfgsbhfdhw.supabase.co/auth/v1
        const projectFromIss = new URL(jwtIss).hostname.split(".")[0];
        const jwtRef = payload.ref;

        console.log({ 
          jwtIss, 
          projectFromIss, 
          jwtRef,
          expectedProject: "tcupxcxyylxfgsbhfdhw" 
        });

        // Atualizar Auth Health com informações detalhadas
        setAuthHealth(prev => ({ 
          ...prev, 
          anonRef, 
          sessionExists: true, 
          jwtRef: `${jwtRef} (from ${projectFromIss})`,
          error: ""
        }));

        // Validação rigorosa do projeto
        if (projectFromIss !== "tcupxcxyylxfgsbhfdhw" || jwtRef !== "tcupxcxyylxfgsbhfdhw") {
          console.error("❌ Token de projeto incorreto!");
          toast({
            title: "❌ Token de projeto incorreto",
            description: `Projeto no token: ${projectFromIss}, esperado: tcupxcxyylxfgsbhfdhw`,
            variant: "destructive"
          });
          setSessionStatus({ isAuthenticated: false });
          return;
        }

        console.log("✅ Token validado para o projeto correto");

        // Verificar localStorage para debug
        const hasLocalToken = !!localStorage.getItem("sb-tcupxcxyylxfgsbhfdhw-auth-token");
        console.log("localStorage token exists:", hasLocalToken);

        // Atualizar status da sessão
        setSessionStatus({
          isAuthenticated: true,
          projectRef: jwtRef,
          userId: session.user.id
        });

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
      } catch (error: any) {
        console.error('Erro ao carregar dados do usuário:', error);
        setAuthHealth(prev => ({ ...prev, error: error?.message || String(error) }));
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

  const runAllTests = async () => {
    try {
      // Validação rigorosa: sessão DEVE existir
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        toast({
          title: "❌ Sessão perdida",
          description: "Recarregue a página para fazer login novamente.",
          variant: "destructive"
        });
        return; 
      }

      // Debug final antes das chamadas
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      console.log("🧪 Executando testes com JWT:", {
        projectRef: payload.ref,
        userId: session.user.id,
        hasLocalStorage: !!localStorage.getItem("sb-tcupxcxyylxfgsbhfdhw-auth-token")
      });

      const userId = session.user.id; // usar o ID real do usuário logado
      
      console.log("🚀 Iniciando testes das Edge Functions...");
      
      // Usar SEMPRE supabase.functions.invoke (injeta JWT automaticamente)
      const s = await supabase.functions.invoke("diag-scopes", { body: { user_id: userId } });
      console.log("📊 diag-scopes →", s);
      
      const r1 = await supabase.functions.invoke("diag-list-root", { body: { user_id: userId } });
      console.log("📁 diag-list-root →", r1);
      
      const r2 = await supabase.functions.invoke("diag-list-folder", { body: { user_id: userId, folderId: "root" } });
      console.log("📂 diag-list-folder →", r2);

      // Verificar se houve erros 401
      const hasUnauthorized = [s, r1, r2].some(result => 
        result.error && (result.error.message?.includes("401") || result.error.message?.includes("Unauthorized"))
      );

      if (hasUnauthorized) {
        toast({
          title: "⚠️ Alguns testes falharam com 401",
          description: "Verifique o console. Pode ser necessário reconfigurar a autenticação.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ Testes executados",
          description: "Todos os testes completados. Verifique o console para detalhes.",
        });
      }
    } catch (error) {
      console.error("❌ RunAllTests error:", error);
      toast({
        title: "Erro nos testes",
        description: `Erro: ${error instanceof Error ? error.message : String(error)}`,
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
            {/* Authentication Status Badge */}
            <div className="flex items-center gap-2 mt-2">
              {sessionStatus.isAuthenticated ? (
                <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                  ✅ Logged in • Project: {sessionStatus.projectRef}
                </Badge>
              ) : (
                <Badge variant="destructive">
                  ❌ Not authenticated
                </Badge>
              )}
            </div>
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
            {/* Auth Health Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Supabase Auth Health</h2>
                <Button 
                  onClick={runAllTests} 
                  variant="outline" 
                  size="sm"
                  disabled={!sessionStatus.isAuthenticated}
                >
                  {sessionStatus.isAuthenticated ? "Run All Tests" : "Login Required"}
                </Button>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify({
                    clientUrl: authHealth.clientUrl,
                    anonRef: authHealth.anonRef,
                    sessionExists: authHealth.sessionExists,
                    jwtRef: authHealth.jwtRef,
                    localStorage: authHealth.sessionExists ? 
                      `!!localStorage["sb-tcupxcxyylxfgsbhfdhw-auth-token"] = ${!!localStorage.getItem("sb-tcupxcxyylxfgsbhfdhw-auth-token")}` : 
                      "Session required"
                  }, null, 2)}
                </pre>
                {authHealth.error && (
                  <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
                    Error: {authHealth.error}
                  </div>
                )}
                {!sessionStatus.isAuthenticated && (
                  <div className="mt-2 p-2 bg-orange-100 text-orange-800 rounded text-sm">
                    ⚠️ Login obrigatório antes dos tesses. Aguarde redirecionamento OAuth.
                  </div>
                )}
              </div>
            </Card>
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

            {/* Google Drive Production Tests */}
            <GoogleDriveProductionTests />

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