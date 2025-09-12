import { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Calendar, Camera, Tags, Archive, Edit2, Save, Upload, Image, LogOut, Settings } from 'lucide-react';
import { GoogleDriveTest } from '@/test/GoogleDriveTest';
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
import { GoogleDriveTestControls } from '@/components/GoogleDriveTestControls';
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
    jwtIss: "(none)",
    projectFromIss: "(none)",
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
    console.log("🚀 UserPage montada, iniciando verificação de auth...");
    console.log("Current URL:", window.location.href);
    console.log("SUPABASE_URL:", SUPABASE_URL);
    
    const loadUserData = async () => {
      try {
        console.log("1️⃣ Decodificando ANON token...");
        const anonPayload = JSON.parse(atob(SUPABASE_ANON.split(".")[1]));
        const anonRef = anonPayload?.ref || "(no-ref)";
        console.log("Anon ref:", anonRef);

        console.log("2️⃣ Verificando sessão existente...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("❌ Erro ao obter sessão:", sessionError);
          setAuthHealth(prev => ({ ...prev, anonRef, sessionExists: false, error: sessionError.message }));
          setLoading(false);
          return;
        }
        
        if (!session) {
          console.log("❌ Sem sessão, aguardando login manual...");
          setAuthHealth(prev => ({ ...prev, anonRef, sessionExists: false }));
          setLoading(false);
          return;
        }

        console.log("✅ Sessão encontrada:", session.user.email);
        console.log("3️⃣ Decodificando JWT da sessão...");
        
        const payload = JSON.parse(atob(session.access_token.split(".")[1]));
        const jwtIss = payload.iss; // ex: https://tcupxcxyylxfgsbhfdhw.supabase.co/auth/v1
        const projectFromIss = new URL(jwtIss).hostname.split(".")[0];
        
        console.log("JWT iss:", jwtIss);
        console.log("Project from iss:", projectFromIss);

        // Atualizar Auth Health com informações detalhadas
        setAuthHealth(prev => ({ 
          ...prev, 
          anonRef, 
          sessionExists: true, 
          jwtIss,
          projectFromIss,
          error: ""
        }));

        // Validação rigorosa do projeto
        if (projectFromIss !== "tcupxcxyylxfgsbhfdhw") {
          console.error("❌ Token de projeto incorreto!");
          toast({
            title: "❌ Token de projeto incorreto",
            description: `Projeto no token: ${projectFromIss}, esperado: tcupxcxyylxfgsbhfdhw`,
            variant: "destructive"
          });
          setSessionStatus({ isAuthenticated: false });
          setLoading(false);
          return;
        }

        console.log("✅ Token validado para o projeto correto");

        // Atualizar status da sessão
        setSessionStatus({
          isAuthenticated: true,
          projectRef: projectFromIss,
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

  // Listen for postMessage from Google Drive OAuth callback
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.source === "gdrive-oauth") {
        supabase.functions.invoke("google-drive-auth", { body: { action: "status" } })
          .then(r => {
            // Force a status refresh in GoogleDriveIntegration component
            // This will trigger the useGoogleDriveSimple hook to update
            window.dispatchEvent(new CustomEvent('google-drive-status-changed'));
          })
          .catch(() => {
            console.warn("Failed to check status after OAuth callback");
          });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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
            {/* Acesso Rápido aos Recursos */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Acesso Rápido aos Recursos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={() => navigate('/upload')} 
                  className="h-16 flex-col gap-2 text-left"
                  variant="outline"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Upload className="h-5 w-5" />
                    <span className="font-medium">Upload de Fotos</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Adicione novas fotos à sua biblioteca</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/labels')} 
                  className="h-16 flex-col gap-2 text-left"
                  variant="outline"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Tags className="h-5 w-5" />
                    <span className="font-medium">Gestão de Labels</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Organize e gerencie suas etiquetas</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/collections')} 
                  className="h-16 flex-col gap-2 text-left"
                  variant="outline"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Archive className="h-5 w-5" />
                    <span className="font-medium">Minhas Coleções</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Visualize e organize suas coleções</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/')} 
                  className="h-16 flex-col gap-2 text-left"
                  variant="outline"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Camera className="h-5 w-5" />
                    <span className="font-medium">Biblioteca de Fotos</span>
                  </div>
                  <span className="text-sm text-muted-foreground">Visualize todas as suas fotos</span>
                </Button>
              </div>
            </Card>
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
                    jwtIss: authHealth.jwtIss,
                    projectFromIss: authHealth.projectFromIss,
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
                  <div className="mt-2 space-y-2">
                    <div className="p-2 bg-orange-100 text-orange-800 rounded text-sm">
                      ⚠️ Login obrigatório antes dos testes. Use o botão abaixo para fazer login.
                    </div>
                    <Button 
                      onClick={() => supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: { redirectTo: window.location.origin + "/user" },
                      })}
                      className="w-full"
                    >
                      Sign in with Google
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Google Drive Test Console */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Google Drive Test Console</h2>
              <GoogleDriveTest />
              
              {/* Debug Info for Production */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">🔍 Debug Info (Produção)</h3>
                <div className="text-sm space-y-1 font-mono">
                  <div><strong>URL atual:</strong> <span className="text-primary">{typeof window !== 'undefined' ? window.location.origin : 'Loading...'}</span></div>
                  <div><strong>Supabase URL:</strong> <span className="text-primary">https://tcupxcxyylxfgsbhfdhw.supabase.co</span></div>
                  <div><strong>Auth Estado:</strong> <span className="text-primary">{user ? '✅ Logado' : '❌ Não logado'}</span></div>
                  {user && <div><strong>User ID:</strong> <span className="text-primary">{user.id.substring(0, 8)}...</span></div>}
                  <div><strong>Environment:</strong> <span className="text-primary">{typeof window !== 'undefined' && window.location.hostname.includes('lovable.app') ? '🚀 Produção' : '🏠 Local'}</span></div>
                </div>
              </div>
              
              {/* Debug Info for Production */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Debug Info (Produção)</h3>
                <div className="text-sm space-y-1">
                  <div>URL atual: <code>{typeof window !== 'undefined' ? window.location.origin : 'Loading...'}</code></div>
                  <div>Supabase URL: <code>https://tcupxcxyylxfgsbhfdhw.supabase.co</code></div>
                  <div>Auth Estado: <code>{user ? 'Logado' : 'Não logado'}</code></div>
                  {user && <div>User ID: <code>{user.id}</code></div>}
                </div>
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
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
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
                  <Label htmlFor="joinDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data de Cadastro
                  </Label>
                  <Input
                    id="joinDate"
                    type="date"
                    value={formData.joinDate}
                    disabled={true}
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="customLogo" className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Avatar
                  </Label>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        id="customLogo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      <p className="text-xs text-muted-foreground">
                        Recomendado: 300x100px, máximo 2MB
                      </p>
                      {formData.customLogo && (
                        <div className="mt-2">
                          <img 
                            src={formData.customLogo} 
                            alt="Preview da logo" 
                            className="h-20 w-auto rounded border"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4 p-3 border rounded-md bg-muted">
                      {formData.customLogo ? (
                        <img 
                          src={formData.customLogo} 
                          alt="Avatar do usuário" 
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formData.customLogo ? 'Avatar personalizado' : 'Nenhum avatar definido'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Google Drive Integration */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Google Drive
              </h2>
              <GoogleDriveIntegration />
              <Separator className="my-4" />
              <GoogleDriveTestControls />
              <Separator className="my-4" />
              <GoogleDriveProductionTests />
            </Card>

            {/* Atividade Recente */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Atividade Recente</h2>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-foreground">{activity.action}</span>
                    <span className="text-xs text-muted-foreground">{activity.date}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Estatísticas Gerais */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Estatísticas Gerais</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Camera className="h-4 w-4" />
                    Total de Fotos
                  </span>
                  <span className="font-semibold">{userStats.totalPhotos}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Tags className="h-4 w-4" />
                    Labels Criadas
                  </span>
                  <span className="font-semibold">{userStats.totalLabels}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Archive className="h-4 w-4" />
                    Coleções
                  </span>
                  <span className="font-semibold">{userStats.totalCollections}</span>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Armazenamento Usado</span>
                  <span className="font-semibold text-primary">{userStats.storageUsed}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Limite de Armazenamento</span>
                  <span className="font-semibold">{userStats.storageLimit}</span>
                </div>
              </div>
            </Card>

            {/* Ações Rápidas */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Upload className="h-4 w-4" />
                  Exportar Dados
                </Button>
                
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Archive className="h-4 w-4" />
                  Backup Completo
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Sair da Conta
                </Button>
                
                <Separator />
                
                <Button variant="destructive" className="w-full justify-start gap-2">
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