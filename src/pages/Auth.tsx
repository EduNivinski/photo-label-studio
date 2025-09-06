import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { User, Session } from '@supabase/supabase-js';
import { logSecurityEvent, checkRateLimit, validateSecureInput, sanitizeUserInput } from '@/lib/securityMonitoring';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Redirect to main page if signed in
        if (session?.user) {
          const from = location.state?.from?.pathname || '/';
          navigate(from);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const from = location.state?.from?.pathname || '/';
        navigate(from);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  const cleanupAuthState = () => {
    // Clear all auth-related keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation and sanitization
    const sanitizedEmail = sanitizeUserInput(email);
    const sanitizedPassword = password; // Don't sanitize passwords
    
    if (!sanitizedEmail || !sanitizedPassword) {
      toast({
        title: "Erro",
        description: "Por favor, preencha email e senha.",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateSecureInput(sanitizedEmail, 254)) { // RFC standard email max length
      toast({
        title: "Erro",
        description: "Email contém caracteres inválidos.",
        variant: "destructive",
      });
      return;
    }

    // Rate limiting for login attempts
    const rateLimitKey = `auth_signin_${sanitizedEmail}`;
    if (!checkRateLimit(rateLimitKey, 5, 300000)) { // 5 attempts per 5 minutes
      toast({
        title: "Muitas tentativas",
        description: "Muitas tentativas de login. Tente novamente em 5 minutos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Log authentication attempt
      logSecurityEvent({
        event_type: 'auth_attempt',
        metadata: { action: 'signin', email: sanitizedEmail }
      });
      
      // Clean up existing state
      cleanupAuthState();
      
      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: sanitizedPassword,
      });

      if (error) throw error;

      if (data.user) {
        // Log successful authentication
        logSecurityEvent({
          event_type: 'auth_attempt',
          user_id: data.user.id,
          metadata: { action: 'signin_success', email: sanitizedEmail }
        });
        
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso!",
        });
        // Navigation will be handled by the auth state change listener
      }
    } catch (error: any) {
      // Log failed authentication
      logSecurityEvent({
        event_type: 'auth_attempt',
        metadata: { action: 'signin_failed', email: sanitizedEmail, error: error.message }
      });
      
      toast({
        title: "Erro no login",
        description: error.message || "Erro ao fazer login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation and sanitization
    const sanitizedEmail = sanitizeUserInput(email);
    const sanitizedDisplayName = sanitizeUserInput(displayName);
    const sanitizedPassword = password; // Don't sanitize passwords
    
    if (!sanitizedEmail || !sanitizedPassword || !sanitizedDisplayName) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateSecureInput(sanitizedEmail, 254) || !validateSecureInput(sanitizedDisplayName, 100)) {
      toast({
        title: "Erro",
        description: "Email ou nome contém caracteres inválidos.",
        variant: "destructive",
      });
      return;
    }

    // Rate limiting for signup attempts
    const rateLimitKey = `auth_signup_${sanitizedEmail}`;
    if (!checkRateLimit(rateLimitKey, 3, 600000)) { // 3 attempts per 10 minutes
      toast({
        title: "Muitas tentativas",
        description: "Muitas tentativas de cadastro. Tente novamente em 10 minutos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Log authentication attempt
      logSecurityEvent({
        event_type: 'auth_attempt',
        metadata: { action: 'signup', email: sanitizedEmail }
      });
      
      // Clean up existing state
      cleanupAuthState();
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password: sanitizedPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: sanitizedDisplayName,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Log successful signup
        logSecurityEvent({
          event_type: 'auth_attempt',
          user_id: data.user.id,
          metadata: { action: 'signup_success', email: sanitizedEmail }
        });
        
        toast({
          title: "Conta criada",
          description: "Conta criada com sucesso! Verifique seu email para confirmar.",
        });
      }
    } catch (error: any) {
      // Log failed signup
      logSecurityEvent({
        event_type: 'auth_attempt',
        metadata: { action: 'signup_failed', email: sanitizedEmail, error: error.message }
      });
      
      toast({
        title: "Erro no cadastro",
        description: error.message || "Erro ao criar conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      cleanupAuthState();
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Bem-vindo!</CardTitle>
            <CardDescription>
              Você está conectado como {user.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/')} className="w-full">
              Ir para a Biblioteca
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>PhotoLabel</CardTitle>
          <CardDescription>
            Entre na sua conta ou crie uma nova para gerenciar suas fotos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Crie uma senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
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
  );
}