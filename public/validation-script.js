/**
 * Script de Validação de Produção - Google Drive Sync
 * 
 * INSTRUÇÕES:
 * 1. Abra o console do navegador (F12)
 * 2. Vá para /settings/drive
 * 3. Cole este script completo e pressione Enter
 * 4. Aguarde a execução completa
 * 5. Copie o JSON gerado e o log do console
 * 
 * O script vai:
 * - Coletar informações do ambiente
 * - Executar sequência de testes (diagnostics, start, run, status)
 * - Baixar um JSON com todas as evidências
 * - Exibir logs formatados no console
 */

(async function runValidation() {
  console.log("🚀 INICIANDO VALIDAÇÃO DE PRODUÇÃO - Google Drive Sync");
  console.log("=" .repeat(80));
  
  const evidence = {
    timestamp: new Date().toISOString(),
    env: {},
    user: {},
    tests: []
  };
  
  try {
    // 1. CAPTURAR AMBIENTE
    console.log("\n📋 STEP 1: Capturando informações do ambiente...");
    
    const supabaseClient = window.supabase;
    if (!supabaseClient) {
      throw new Error("window.supabase não encontrado! Certifique-se de estar na página do app.");
    }
    
    evidence.env = {
      SUPABASE_URL: supabaseClient.supabaseUrl || "N/A",
      SUPABASE_ANON_KEY: supabaseClient.supabaseKey 
        ? `${supabaseClient.supabaseKey.substring(0, 30)}...${supabaseClient.supabaseKey.substring(supabaseClient.supabaseKey.length - 10)}`
        : "N/A",
      functionsBase: `https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1`,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.log("✅ Ambiente capturado:");
    console.table(evidence.env);
    
    // 2. CAPTURAR USUÁRIO
    console.log("\n👤 STEP 2: Identificando usuário autenticado...");
    
    const session = await supabaseClient.auth.getSession();
    if (!session?.data?.session) {
      throw new Error("Usuário não autenticado! Faça login primeiro.");
    }
    
    const token = session.data.session.access_token;
    const user = session.data.session.user;
    
    // Decodificar JWT para pegar o sub
    const jwtPayload = JSON.parse(atob(token.split('.')[1]));
    
    evidence.user = {
      userId: user.id,
      email: user.email,
      jwtSub: jwtPayload.sub,
      jwtIssuer: jwtPayload.iss
    };
    
    console.log("✅ Usuário identificado:");
    console.table(evidence.user);
    
    // 3. FUNÇÃO AUXILIAR PARA CHAMAR EDGE FUNCTIONS
    async function callEdge(endpoint, method = 'POST', body = {}) {
      const url = `${evidence.env.functionsBase}/${endpoint}`;
      console.log(`\n🔗 Calling ${method} ${endpoint}...`);
      
      const startTime = Date.now();
      try {
        const resp = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseClient.supabaseKey
          },
          body: method !== 'GET' ? JSON.stringify(body) : undefined
        });
        
        const elapsed = Date.now() - startTime;
        const data = await resp.json();
        
        console.log(`✅ ${endpoint}: ${resp.status} (${elapsed}ms)`);
        console.log("Response:", data);
        
        return {
          status: resp.status,
          ok: resp.ok,
          elapsed,
          data,
          headers: {
            'content-type': resp.headers.get('content-type'),
            'cache-control': resp.headers.get('cache-control')
          }
        };
      } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ ${endpoint}: ERRO (${elapsed}ms)`, error);
        return {
          status: 0,
          ok: false,
          elapsed,
          error: error.message,
          data: null
        };
      }
    }
    
    // 4. EXECUTAR TESTES
    console.log("\n" + "=".repeat(80));
    console.log("🧪 INICIANDO SEQUÊNCIA DE TESTES");
    console.log("=".repeat(80));
    
    // TEST 1: Diagnostics BEFORE
    console.log("\n🔍 TEST 1: drive-sync-diagnostics (BEFORE)");
    evidence.tests.push({
      step: '1_diagnostics_before',
      timestamp: new Date().toISOString(),
      result: await callEdge('drive-sync-diagnostics', 'GET')
    });
    
    // Aguardar um pouco entre chamadas
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // TEST 2: Sync Start
    console.log("\n🚀 TEST 2: drive-sync-start");
    evidence.tests.push({
      step: '2_sync_start',
      timestamp: new Date().toISOString(),
      result: await callEdge('drive-sync-start', 'POST', {})
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // TEST 3: Diagnostics AFTER
    console.log("\n🔍 TEST 3: drive-sync-diagnostics (AFTER start)");
    evidence.tests.push({
      step: '3_diagnostics_after',
      timestamp: new Date().toISOString(),
      result: await callEdge('drive-sync-diagnostics', 'GET')
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // TEST 4: Sync Run (uma vez)
    console.log("\n⚙️ TEST 4: drive-sync-run");
    evidence.tests.push({
      step: '4_sync_run',
      timestamp: new Date().toISOString(),
      result: await callEdge('drive-sync-run', 'POST', { budgetFolders: 5 })
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // TEST 5: Status
    console.log("\n📊 TEST 5: google-drive-auth (status)");
    evidence.tests.push({
      step: '5_status',
      timestamp: new Date().toISOString(),
      result: await callEdge('google-drive-auth', 'POST', { action: 'status' })
    });
    
    // 5. ANÁLISE DOS RESULTADOS
    console.log("\n" + "=".repeat(80));
    console.log("📊 ANÁLISE DOS RESULTADOS");
    console.log("=".repeat(80));
    
    const test1 = evidence.tests[0].result.data;
    const test2 = evidence.tests[1].result.data;
    const test3 = evidence.tests[2].result.data;
    const test4 = evidence.tests[3].result.data;
    const test5 = evidence.tests[4].result.data;
    
    const analysis = {
      settingsFolderId: test1?.settings?.folderId || 'N/A',
      stateRootBefore: test1?.state?.rootFolderId || 'null',
      stateRootAfter: test3?.state?.rootFolderId || 'null',
      effectiveRootFromStart: test2?.effectiveRootFolderId || 'N/A',
      pendingBefore: test1?.state?.pending?.length || 0,
      pendingAfter: test3?.state?.pending?.length || 0,
      syncRunStatus: test4?.ok ? 'SUCCESS' : 'FAILED',
      syncRunCode: test4?.code || 'N/A',
      statusDedicatedFolder: test5?.dedicatedFolderId || 'N/A',
      
      // Validações
      validation: {
        rootRearmed: test2?.effectiveRootFolderId === test1?.settings?.folderId,
        stateMatchesSettings: test3?.state?.rootFolderId === test1?.settings?.folderId,
        statusMatchesSettings: test5?.dedicatedFolderId === test1?.settings?.folderId,
        allTraceIds: [
          test1?.traceId,
          test2?.traceId,
          test3?.traceId,
          test4?.traceId,
          test5?.traceId
        ].filter(Boolean)
      }
    };
    
    evidence.analysis = analysis;
    
    console.log("\n✅ ANÁLISE COMPLETA:");
    console.table(analysis);
    
    console.log("\n🔍 VALIDAÇÕES:");
    console.log(`  Root rearmed? ${analysis.validation.rootRearmed ? '✅' : '❌'}`);
    console.log(`  State matches settings? ${analysis.validation.stateMatchesSettings ? '✅' : '❌'}`);
    console.log(`  Status matches settings? ${analysis.validation.statusMatchesSettings ? '✅' : '❌'}`);
    console.log(`  TraceIDs collected: ${analysis.validation.allTraceIds.length}`);
    
    // 6. DOWNLOAD DO JSON
    console.log("\n" + "=".repeat(80));
    console.log("💾 SALVANDO EVIDÊNCIAS");
    console.log("=".repeat(80));
    
    const jsonStr = JSON.stringify(evidence, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drive-sync-validation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("✅ JSON baixado com sucesso!");
    console.log("\n📋 PRÓXIMOS PASSOS:");
    console.log("  1. Copie TODO o log deste console");
    console.log("  2. Envie o arquivo JSON baixado");
    console.log("  3. Verifique os logs do Supabase para ver os traceIds");
    console.log("     https://supabase.com/dashboard/project/tcupxcxyylxfgsbhfdhw/functions");
    
    console.log("\n🎉 VALIDAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("=" .repeat(80));
    
    return evidence;
    
  } catch (error) {
    console.error("\n❌ ERRO DURANTE A VALIDAÇÃO:", error);
    console.error("Stack:", error.stack);
    
    evidence.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    // Ainda assim tentar baixar o que foi coletado
    const jsonStr = JSON.stringify(evidence, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drive-sync-validation-ERROR-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("💾 Evidências parciais salvas mesmo com erro");
    throw error;
  }
})();
