import { useEffect, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_ANON } from "@/integrations/supabase/client";

export default function UserPage() {
  const [state, setState] = useState({
    clientUrl: SUPABASE_URL,
    anonRef: "(checking…)",
    sessionExists: false,
    jwtIss: "(none)",
    projectFromIss: "(none)",
    error: "",
  });

  useEffect(() => { 
    console.log("🚀 UserPage montada, iniciando verificação de auth...");
    console.log("Current URL:", window.location.href);
    console.log("SUPABASE_URL:", SUPABASE_URL);
    
    (async () => {
      try {
        console.log("1️⃣ Decodificando ANON token...");
        const anonPayload = JSON.parse(atob(SUPABASE_ANON.split(".")[1]));
        const anonRef = anonPayload?.ref || "(no-ref)";
        console.log("Anon ref:", anonRef);

        console.log("2️⃣ Verificando sessão existente...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("❌ Erro ao obter sessão:", sessionError);
          setState(s => ({ ...s, anonRef, sessionExists: false, error: sessionError.message }));
          return;
        }
        
        if (!session) {
          console.log("❌ Sem sessão, iniciando OAuth...");
          setState(s => ({ ...s, anonRef, sessionExists: false }));
          
          const redirectUrl = window.location.origin + "/user";
          console.log("Redirect URL:", redirectUrl);
          
          const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: redirectUrl },
          });
          
          if (oauthError) {
            console.error("❌ Erro no OAuth:", oauthError);
            setState(s => ({ ...s, error: oauthError.message }));
          }
          return;
        }

        console.log("✅ Sessão encontrada:", session.user.email);
        console.log("3️⃣ Decodificando JWT da sessão...");
        
        const p = JSON.parse(atob(session.access_token.split(".")[1]));
        const jwtIss = p.iss || "(no-iss)";
        const projectFromIss = new URL(jwtIss).hostname.split(".")[0];
        
        console.log("JWT iss:", jwtIss);
        console.log("Project from iss:", projectFromIss);

        setState(s => ({ 
          ...s, 
          anonRef, 
          sessionExists: true, 
          jwtIss, 
          projectFromIss 
        }));
        
        console.log("✅ Auth health atualizado com sucesso");
      } catch (e: any) {
        console.error("❌ Erro na verificação de auth:", e);
        setState(s => ({ ...s, error: e?.message || String(e) }));
      }
    })(); 
  }, []);

  async function runAllTests() {
    try {
      // Get current user ID from session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("❌ Nenhuma sessão encontrada");
        return;
      }
      
      const userId = session.user.id;
      console.log("🧪 Executando testes com userId:", userId);
      
      console.log("diag-scopes →",      await supabase.functions.invoke("diag-scopes",      { body: { user_id: userId }}));
      console.log("diag-list-root →",   await supabase.functions.invoke("diag-list-root",   { body: { user_id: userId }}));
      console.log("diag-list-folder →", await supabase.functions.invoke("diag-list-folder", { body: { user_id: userId, folderId: "root" }}));
    } catch (error) {
      console.error("❌ Erro nos testes:", error);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Supabase Auth Health</h3>
      <pre style={{ 
        backgroundColor: '#f5f5f5', 
        padding: 16, 
        borderRadius: 8, 
        fontSize: 14,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}>
        {JSON.stringify({
          ...state,
          localStorage: state.sessionExists ? 
            `!!localStorage["sb-tcupxcxyylxfgsbhfdhw-auth-token"] = ${!!localStorage.getItem("sb-tcupxcxyylxfgsbhfdhw-auth-token")}` : 
            "Session required"
        }, null, 2)}
      </pre>
      
      {state.error && (
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          backgroundColor: '#fee', 
          color: '#c00', 
          borderRadius: 4 
        }}>
          Error: {state.error}
        </div>
      )}
      
      {!state.sessionExists && (
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          backgroundColor: '#fff3cd', 
          color: '#856404', 
          borderRadius: 4 
        }}>
          ⚠️ Login obrigatório antes dos testes. Use o botão abaixo para fazer login.
          <br />
          <button 
            onClick={() => supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.origin + "/user" },
            })}
            style={{
              marginTop: 8,
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Sign in with Google
          </button>
        </div>
      )}
      
      {state.sessionExists && (
        <button 
          onClick={runAllTests}
          style={{
            marginTop: 16,
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          Run All Tests
        </button>
      )}
    </div>
  );
}