# ✅ Validação Final – Hotfix Google Drive Sync

## 🎯 Objetivo
Confirmar que o hotfix resolve:
1. ❌ Erro 500 "Invalid time value" → ✅ agora trata datas inválidas
2. ❌ Erro 500 em token expirado → ✅ agora retorna 401 TOKEN_EXPIRED  
3. ✅ Fonte única sempre respeitada (settings → state)
4. ✅ Front dispara reauth automaticamente em 401

---

## 🔍 Evidências do Edge Function Log

### Erro ANTES do Hotfix ❌
```
traceId: e4d40b5b-86b2-4912-9aaa-ec06a2db7431
RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
    at drive-sync-run/index.ts:139:71
```

### Erro DEPOIS do Hotfix ✅

**Cenário 1: Token expirado**
```json
{
  "ok": false,
  "code": "TOKEN_EXPIRED",
  "message": "Token expirado ou inválido. Reconecte sua conta do Google Drive.",
  "traceId": "..."
}
```
Status HTTP: **401** (não 500)

**Cenário 2: Pasta mudou sem start**
```json
{
  "ok": false,
  "code": "ROOT_MISMATCH",
  "message": "Pasta alterada. Clique em Sincronizar novamente para rearmar o root.",
  "stateRoot": "...",
  "settingsRoot": "...",
  "traceId": "..."
}
```
Status HTTP: **409** (não 500)

**Cenário 3: Sucesso**
```json
{
  "ok": true,
  "done": false,
  "queued": 123,
  "processedFolders": 5,
  "updatedItems": 456,
  "traceId": "..."
}
```
Status HTTP: **200**

---

## 📊 Logs Esperados (Supabase)

### 1. google-drive-auth (status)
```
[status] {
  traceId: "xxx",
  user_id: "42e4275e-4b02-4304-b6a7-7279cc855bad",
  dedicatedFolderId: "1dPU1bxbHLbPZWHGC2qe4XpWK3f-lPXV5",
  stateRootFolderId: "1dPU1bxbHLbPZWHGC2qe4XpWK3f-lPXV5"
}
```

### 2. drive-sync-start
```
[sync-start][before] {
  traceId: "yyy",
  user_id: "42e4275e-4b02-4304-b6a7-7279cc855bad",
  settingsFolderId: "1dPU1bxbHLbPZWHGC2qe4XpWK3f-lPXV5",
  stateRootBefore: null ou "old_folder_id"
}

[sync-start][after] {
  traceId: "yyy",
  user_id: "42e4275e-4b02-4304-b6a7-7279cc855bad",
  effectiveRootFolderId: "1dPU1bxbHLbPZWHGC2qe4XpWK3f-lPXV5",
  rearmed: true
}
```

### 3. drive-sync-run
```
[sync-run][start] {
  traceId: "zzz",
  user_id: "42e4275e-4b02-4304-b6a7-7279cc855bad",
  settingsFolderId: "1dPU1bxbHLbPZWHGC2qe4XpWK3f-lPXV5",
  stateRootFolderId: "1dPU1bxbHLbPZWHGC2qe4XpWK3f-lPXV5"
}
```

**Critérios de aceite:**
- ✅ `settingsFolderId` == `stateRootFolderId` (pasta nova)
- ✅ Mesmo `user_id` nas 3 funções
- ✅ Cada traceId único

---

## 🧪 Script de Teste Completo

Cole no console do navegador em `/settings/drive`:

```javascript
// TEST EVIDENCE COLLECTOR
const evidence = { env: {}, calls: [] };

// 1. Environment
evidence.env = {
  supabaseUrl: 'https://tcupxcxyylxfgsbhfdhw.supabase.co',
  functionsBase: 'https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1',
  userId: (await supabase.auth.getUser()).data.user?.id || 'N/A'
};

console.log('📦 Environment:', evidence.env);

// 2. Diagnostics BEFORE
console.log('🔍 Step 1: Diagnostics BEFORE...');
const diagBefore = await supabase.functions.invoke('drive-sync-diagnostics');
evidence.calls.push({ step: 'diagnostics_before', ...diagBefore });
console.log('✅ Diagnostics BEFORE:', diagBefore.data);

// 3. Sync START
console.log('🚀 Step 2: Sync START...');
const syncStart = await supabase.functions.invoke('drive-sync-start');
evidence.calls.push({ step: 'sync_start', ...syncStart });
console.log('✅ Sync START:', syncStart.data);

// 4. Diagnostics AFTER
console.log('🔍 Step 3: Diagnostics AFTER...');
const diagAfter = await supabase.functions.invoke('drive-sync-diagnostics');
evidence.calls.push({ step: 'diagnostics_after', ...diagAfter });
console.log('✅ Diagnostics AFTER:', diagAfter.data);

// 5. Sync RUN (primeira execução)
console.log('⚙️ Step 4: Sync RUN...');
const syncRun = await supabase.functions.invoke('drive-sync-run', {
  body: { budgetFolders: 5 }
});
evidence.calls.push({ step: 'sync_run', ...syncRun });
console.log('✅ Sync RUN:', syncRun.data);

// 6. Status
console.log('📊 Step 5: Status...');
const statusCheck = await supabase.functions.invoke('google-drive-auth', {
  body: { action: 'status' }
});
evidence.calls.push({ step: 'status', ...statusCheck });
console.log('✅ Status:', statusCheck.data);

// 7. Export JSON
console.log('💾 Exportando evidências...');
const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `drive-sync-evidence-${Date.now()}.json`;
a.click();
console.log('✅ EVIDÊNCIAS EXPORTADAS!');
```

---

## 📋 Checklist de Aceite

### Resposta do drive-sync-run
- [ ] **200**: Sucesso (JSON com `ok: true, done: ..., traceId`)
- [ ] **401**: Token expirado (JSON com `code: 'TOKEN_EXPIRED', traceId`)
- [ ] **409**: Root mismatch (JSON com `code: 'ROOT_MISMATCH', stateRoot, settingsRoot, traceId`)
- [ ] **NUNCA 500** com "Invalid time value"

### Logs do Supabase
- [ ] `[status]` mostra `dedicatedFolderId` = pasta nova
- [ ] `[sync-start][after]` mostra `effectiveRootFolderId` = pasta nova
- [ ] `[sync-run][start]` mostra `settingsFolderId` == `stateRootFolderId` (pasta nova)
- [ ] Todos logs têm mesmo `user_id`

### Diagnóstico
- [ ] BEFORE: `settings.folderId` = nova, `state.rootFolderId` = null/antiga
- [ ] AFTER: `settings.folderId` = nova, `state.rootFolderId` = nova

### Front-end
- [ ] Se 401, abre popup OAuth automaticamente
- [ ] Se 409, mostra toast "Pasta alterada, rearmando..." e re-tenta
- [ ] Após reload, status continua mostrando pasta nova

---

## 🚨 Se Encontrar Problemas

### 500 Internal Server Error
1. Copie o `traceId` da resposta ou do log
2. Procure no Supabase > Edge Functions > drive-sync-run > Logs
3. Filtre por `[SYNC_RUN_ERROR]` ou pelo traceId
4. Anexe:
   - Stack completo do erro
   - Valores de `settingsFolderId` e `stateRootFolderId`
   - Resposta HTTP completa

### 401 sem popup OAuth
1. Verifique console do navegador
2. Confirme que `google-drive-auth` retornou `authorizeUrl`
3. Teste manualmente: abra o `authorizeUrl` em nova aba

### 409 sem re-arm
1. Verifique se `drive-sync-start` foi chamado
2. Confirme que `state.rootFolderId` foi atualizado
3. Rode diagnóstico após start

---

## 📝 Entregáveis

1. **JSON exportado** (drive-sync-evidence-*.json)
2. **Screenshots dos logs** no Supabase com traceIds destacados
3. **Confirmação** de que:
   - settingsFolderId == stateRootFolderId (após start)
   - Nenhum 500 com "Invalid time value"
   - 401 dispara reauth no front
   - Pasta persiste após reload
