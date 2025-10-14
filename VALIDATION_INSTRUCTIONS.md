# 🔍 Instruções de Validação - Google Drive Sync Hotfix

## 📋 Resumo do Hotfix Implementado

### ✅ Backend (Edge Functions)

1. **google-drive-auth**
   - `handleStatus`: Adiciona `traceId` + logs com `settingsFolderId` e `stateRootFolderId`
   - `handleSetFolder`: Reseta completamente `drive_sync_state` incluindo `start_page_token = null`

2. **drive-sync-start**
   - Rearme INCONDICIONAL do state com pasta atual de `user_drive_settings`
   - Logs `[sync-start][before]` e `[sync-start][after]` com `traceId`
   - Reseta `start_page_token = null` ao rearmar
   - Resposta inclui `traceId` e `effectiveRootFolderId`
   - **NÃO aceita** `folderId` do front

3. **drive-sync-run**
   - Logs `[sync-run][start]` com `traceId`
   - Trava **409 ROOT_MISMATCH** se `state.root_folder_id ≠ settings.drive_folder_id`
   - Resposta de erro inclui `traceId`, `stateRoot`, `settingsRoot`

4. **drive-index-folder**
   - Usa root sempre de `user_drive_settings`
   - Logs com `traceId`
   - Resposta inclui `traceId`

5. **drive-sync-diagnostics** (NOVO)
   - Endpoint GET que retorna settings + state em JSON
   - Logs com `traceId`
   - `Cache-Control: no-store`

### ✅ Database

- **Migrations executadas**: Índices únicos criados
- `user_drive_settings(user_id)`: Índice único
- `drive_sync_state(user_id)`: Índice único
- **Eliminado**: `ORDER BY updated_at DESC` em todos os SELECTs

### ✅ Frontend

1. **Sequência de Sync Corrigida**
   - (a) `await drive-sync-start` → rearma root
   - (b) Se `pending === 0`, chama `drive-index-folder` (primeira vez)
   - (c) Loop `drive-sync-run` até `done === true`

2. **Tratamento de Erro 409**
   - Ao receber `ROOT_MISMATCH`, chama `drive-sync-start` novamente
   - Backoff de 1 segundo
   - Toast informativo: "Pasta alterada, rearmando sync..."

3. **Botão de Diagnóstico**
   - Chama `drive-sync-diagnostics`
   - Exibe: `settingsFolderId`, `stateRootFolderId`, `pending`, `status`
   - Mostra `traceId` no toast

4. **Nunca envia folderId**
   - Todas as chamadas a start/index/run **não enviam** `folderId` no body

---

## 🧪 Como Executar a Validação em Produção

### OPÇÃO 1: Script Automático (RECOMENDADO)

1. Abra o site publicado em: https://photo-label-studio.lovable.app
2. Faça login
3. Vá para: `/settings/drive`
4. Abra o console do navegador (F12)
5. Cole o script de validação:

```javascript
// O script está em: public/validation-script.js
// Ou copie do arquivo e cole no console
```

6. Pressione Enter e aguarde
7. O script vai:
   - ✅ Coletar informações do ambiente (SUPABASE_URL, ANON_KEY, user)
   - ✅ Executar sequência de 5 testes
   - ✅ Baixar um JSON com todas as evidências
   - ✅ Exibir análise formatada no console

8. **Copie**:
   - Todo o log do console
   - O arquivo JSON baixado
   - Screenshots dos logs do Supabase (com traceIds correlacionados)

### OPÇÃO 2: Manual (passo a passo)

Se preferir testar manualmente:

#### 1. Verificar Ambiente

Abra o console e rode:

```javascript
console.log({
  SUPABASE_URL: window.supabase?.supabaseUrl,
  SUPABASE_ANON_KEY: window.supabase?.supabaseKey?.substring(0, 30) + '...',
  functionsBase: 'https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1'
});
```

#### 2. Obter Token de Auth

```javascript
const session = await window.supabase.auth.getSession();
const token = session.data.session.access_token;
const userId = session.data.session.user.id;
console.log('User ID:', userId);
```

#### 3. Executar Sequência de Testes

```javascript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'apikey': window.supabase.supabaseKey
};

const base = 'https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1';

// TEST 1: Diagnostics BEFORE
const test1 = await fetch(`${base}/drive-sync-diagnostics`, {
  method: 'GET',
  headers
}).then(r => r.json());
console.log('1_diagnostics_before:', test1);

// TEST 2: Sync Start
const test2 = await fetch(`${base}/drive-sync-start`, {
  method: 'POST',
  headers,
  body: '{}'
}).then(r => r.json());
console.log('2_sync_start:', test2);

// TEST 3: Diagnostics AFTER
const test3 = await fetch(`${base}/drive-sync-diagnostics`, {
  method: 'GET',
  headers
}).then(r => r.json());
console.log('3_diagnostics_after:', test3);

// TEST 4: Sync Run
const test4 = await fetch(`${base}/drive-sync-run`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ budgetFolders: 5 })
}).then(r => r.json());
console.log('4_sync_run:', test4);

// TEST 5: Status
const test5 = await fetch(`${base}/google-drive-auth`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ action: 'status' })
}).then(r => r.json());
console.log('5_status:', test5);
```

---

## ✅ Critérios de Aceite

### Resultados Esperados:

1. **test2.effectiveRootFolderId** === **test1.settings.folderId** (pasta nova)
2. **test3.state.rootFolderId** === pasta nova
3. **test4**: 200 OK (ou 409 se pulou o start)
4. **test5.dedicatedFolderId** === pasta nova

### Validações:

- ✅ `test2.traceId` presente
- ✅ `test3.state.rootFolderId` = nova pasta
- ✅ `test4` não retorna 409 (se start foi chamado)
- ✅ Status/UI permanecem na pasta nova após reload

### Logs Esperados (Supabase Functions):

Procure pelos traceIds nos logs:

```
[status] { traceId: "...", user_id: "...", dedicatedFolderId: "...", stateRootFolderId: "..." }

[sync-start][before] { traceId: "...", user_id: "...", settingsFolderId: "...", stateRootBefore: "..." }
[sync-start][after] { traceId: "...", user_id: "...", effectiveRootFolderId: "...", rearmed: true }

[sync-run][start] { traceId: "...", user_id: "...", settingsFolderId: "...", stateRootFolderId: "..." }
```

---

## 📊 Informações do Ambiente de Produção

### Supabase Project
- **Project ID**: `tcupxcxyylxfgsbhfdhw`
- **SUPABASE_URL**: `https://tcupxcxyylxfgsbhfdhw.supabase.co`
- **SUPABASE_ANON_KEY**: (visível em `src/integrations/supabase/client.ts`)

```typescript
// src/integrations/supabase/client.ts
export const SUPABASE_URL = "https://tcupxcxyylxfgsbhfdhw.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

### Edge Functions
- **Base URL**: `https://tcupxcxyylxfgsbhfdhw.supabase.co/functions/v1`
- **Endpoints testados**:
  - `GET /drive-sync-diagnostics`
  - `POST /drive-sync-start`
  - `POST /drive-sync-run`
  - `POST /google-drive-auth` (action: status)

### Frontend
- **Site publicado**: https://photo-label-studio.lovable.app
- **Página de testes**: https://photo-label-studio.lovable.app/settings/drive

---

## 📦 Entregáveis Solicitados

Por favor, forneça:

1. ✅ **JSON das 5 chamadas** (baixado pelo script ou coletado manualmente)
   - Contendo todos os traceIds

2. ✅ **Screenshots dos logs do Supabase**
   - Com os traceIds correlacionados
   - Mostrando as linhas:
     - `[status] ...`
     - `[sync-start][before] ...` / `[sync-start][after] ...`
     - `[sync-run][start] ...`

3. ✅ **Log completo do console** durante a execução dos testes

4. ✅ **Confirmação dos ENV**
   - SUPABASE_URL usado pelo front
   - SUPABASE_ANON_KEY usado pelo front
   - Base URL das edge functions
   - User ID (sub do JWT)

---

## 🔗 Links Úteis

- [Logs drive-sync-diagnostics](https://supabase.com/dashboard/project/tcupxcxyylxfgsbhfdhw/functions/drive-sync-diagnostics/logs)
- [Logs drive-sync-start](https://supabase.com/dashboard/project/tcupxcxyylxfgsbhfdhw/functions/drive-sync-start/logs)
- [Logs drive-sync-run](https://supabase.com/dashboard/project/tcupxcxyylxfgsbhfdhw/functions/drive-sync-run/logs)
- [Logs google-drive-auth](https://supabase.com/dashboard/project/tcupxcxyylxfgsbhfdhw/functions/google-drive-auth/logs)

---

## 🎯 Objetivo Final

Garantir que após salvar uma pasta nova:

1. ✅ `start` rearma sempre o root para a pasta nova
2. ✅ `diagnostics AFTER` mostra `state.rootFolderId = nova`
3. ✅ `run` processa itens (>0 na primeira indexação)
4. ✅ Status/UI permanecem na pasta nova durante/após sync e após reload

---

**Data**: 2025-10-14
**Versão do Hotfix**: 1.0
**Status**: ✅ Implementado - Aguardando Validação em Produção
