import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, User as UserIcon, ArrowLeft } from 'lucide-react';
import type { User, Session } from '@supabase/supabase-js';
import { logSecurityEvent, checkRateLimit, validateSecureInput, sanitizeUserInput } from '@/lib/securityMonitoring';
import { Link } from 'react-router-dom';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Configurar listener de mudanças de auth PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Usuário autenticado, redirecionar para home
        navigate('/', { replace: true });
      }
    });

    // DEPOIS verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate('/', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const cleanupAuthState = () => {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.removeItem('supabase.auth.token');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSecureInput(email, 254) || !validateSecureInput(password, 128)) {
      toast.error('Dados de entrada inválidos. Verifique e tente novamente.');
      return;
    }

    const sanitizedEmail = sanitizeUserInput(email);
    
    if (!checkRateLimit('signin_' + sanitizedEmail, 5, 15 * 60 * 1000)) {
      toast.error('Muitas tentativas de login. Tente novamente em alguns minutos.');
      logSecurityEvent({
        event_type: 'rate_limit_exceeded',
        metadata: { action: 'signin_attempt', email: sanitizedEmail }
      });
      return;
    }

    setLoading(true);

    try {
      // Limpar estado de auth antes de fazer signin
      await supabase.auth.signOut({ scope: 'global' });
      cleanupAuthState();

      // Fazer signin
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: password,
      });

      if (error) {
        logSecurityEvent({
          event_type: 'sensitive_operation',
          metadata: { action: 'signin_failed', email: sanitizedEmail, error: error.message }
        });
        toast.error(error.message);
      } else {
        logSecurityEvent({
          event_type: 'sensitive_operation',
          metadata: { action: 'signin_success', email: sanitizedEmail }
        });
        toast.success('Login realizado com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      toast.error('Erro inesperado no login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSecureInput(email, 254) || 
        !validateSecureInput(password, 128) || 
        !validateSecureInput(displayName, 100)) {
      toast.error('Dados de entrada inválidos. Verifique e tente novamente.');
      return;
    }

    const sanitizedEmail = sanitizeUserInput(email);
    const sanitizedDisplayName = sanitizeUserInput(displayName);
    
    if (!checkRateLimit('signup_' + sanitizedEmail, 3, 60 * 60 * 1000)) {
      toast.error('Muitas tentativas de cadastro. Tente novamente em uma hora.');
      logSecurityEvent({
        event_type: 'rate_limit_exceeded',
        metadata: { action: 'signup_attempt', email: sanitizedEmail }
      });
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: sanitizedDisplayName,
          }
        }
      });

      if (error) {
        logSecurityEvent({
          event_type: 'sensitive_operation',
          metadata: { action: 'signup_failed', email: sanitizedEmail, error: error.message }
        });
        toast.error(error.message);
      } else {
        logSecurityEvent({
          event_type: 'sensitive_operation',
          metadata: { action: 'signup_success', email: sanitizedEmail }
        });
        toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      toast.error('Erro inesperado no cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    cleanupAuthState();
    await supabase.auth.signOut({ scope: 'global' });
    navigate('/auth');
  };

  // Se usuário está logado, mostrar opções de logout
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Bem-vindo!</CardTitle>
            <CardDescription>
              Você está logado como {user.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/')} className="w-full">
                Ir para o App
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                Fazer Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao App
            </Button>
          </Link>
        </div>
        
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Autenticação Segura</CardTitle>
            <CardDescription>
              Entre com sua conta ou crie uma nova para acessar suas fotos com segurança
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Nome completo"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={loading}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Senha (mín. 6 caracteres)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                        minLength={6}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar Conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}