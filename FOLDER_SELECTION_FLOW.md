# Fluxo de Seleção de Pasta (Sem Colar ID)

## Visão Geral
O fluxo permite que o usuário selecione uma pasta do Google Drive através de um picker visual, sem precisar colar IDs manualmente. O sistema valida, salva e confirma automaticamente antes de habilitar a sincronização.

## Etapas do Fluxo (FSM)

### 1. **IDLE** - Estado inicial
- Botão "Buscar pasta" habilitado
- Botão "Sincronizar" desabilitado (se nenhuma pasta configurada)
- Usuário pode clicar em "Buscar pasta" para abrir o picker

### 2. **VERIFYING** - Verificando pasta no Google Drive
**Trigger:** Usuário seleciona uma pasta no picker

**Ações:**
```typescript
POST /drive-folder-verify
Body: { folderId: "<id capturado do picker>" }
```

**Validações:**
- ✅ Pasta existe e é acessível
- ✅ Token não expirado (401 → auto-reconnect)
- ✅ Escopos suficientes (403 → auto-reconnect com novos escopos)
- ✅ Não é lixeira (trashed: false)
- ✅ É pasta (mimeType: folder)
- ✅ Resolve shortcuts automaticamente (targetId)

**Tratamento de Erros:**
- `401 TOKEN_EXPIRED` → Chama `connect()` para reautenticar automaticamente
- `403 INSUFFICIENT_SCOPE` → Chama `connect()` para obter permissões faltantes
- `404 FOLDER_NOT_FOUND` → Mostra link para abrir no Drive e verificar conta
- `SHORTCUT_ID_PROVIDED` → Chama recursivamente com `targetId`

**UI:**
- Card azul mostrando "Verificando pasta no Google Drive..."
- Todos os botões desabilitados
- Loading spinner

### 3. **SAVING** - Salvando configuração
**Trigger:** Verificação bem-sucedida

**Ações:**
```typescript
POST /google-drive-auth
Body: { 
  action: "set_folder", 
  folderId: "<id>", 
  folderName: "<name>",
  folderPath: "<path>" 
}
```

**Backend (set_folder):**
1. Valida pasta via Drive API (mesmas validações do verify)
2. Persiste em `user_drive_settings` (service_role):
   - `drive_folder_id`
   - `drive_folder_name`
   - `drive_folder_path`
   - `updated_at = now()`
3. Reseta `drive_sync_state`:
   - `root_folder_id = null`
   - `pending_folders = []`
   - `status = 'idle'`
   - `start_page_token = null`
4. Read-back e retorna `{ ok: true, persisted: true, savedFolderId, ... }`

**UI:**
- Card azul mostrando "Salvando configuração..."
- Todos os botões desabilitados

### 4. **REFRESHING** - Confirmando consistência
**Trigger:** Salvamento bem-sucedido

**Ações:**
```typescript
// Status
POST /google-drive-auth
Body: { action: "status" }
Headers: { "Cache-Control": "no-store" }

// Diagnostics
GET /drive-sync-diagnostics
Headers: { "Cache-Control": "no-store" }
```

**Validações:**
```typescript
status.dedicatedFolderId === selectedFolderId
diagnostics.settings.folderId === selectedFolderId
```

**Se inconsistente:**
- Aborta o fluxo
- Mostra erro com TraceID
- Retorna ao estado ERROR

**UI:**
- Card azul mostrando "Confirmando consistência..."
- Todos os botões desabilitados

### 5. **READY** - Pasta configurada e pronta
**Trigger:** Confirmação bem-sucedida

**Ações:**
- Atualiza UI com nome/path da pasta
- Habilita botão "Sincronizar"
- Dispara evento `google-drive-folder-updated`
- Refresh do status

**UI:**
- Toast verde: "Pasta configurada com sucesso"
- Botão "Sincronizar" habilitado
- Botão "Trocar pasta" habilitado
- Mostra path completo da pasta selecionada

### 6. **ERROR** - Erro em qualquer etapa
**Ações:**
- Mostra toast com erro específico
- Loga detalhes com TraceID
- Permite tentar novamente (volta para IDLE)

**UI:**
- Toast vermelho com mensagem de erro
- Card azul mostrando "Erro ao selecionar pasta"
- Botão "Buscar pasta" habilitado para retry

## Sincronização (após READY)

### Pré-requisitos
- Estado deve ser `ready` ou `idle`
- Pasta deve estar configurada

### Orquestração
```typescript
1. drive-sync-start    // Rearme com pasta atual
2. drive-sync-diagnostics  // Confirma root_folder_id
3. Se pending === 0: drive-index-folder  // Primeira vez
4. Loop drive-sync-run até pending === 0
   - Trata 409 ROOT_MISMATCH com backoff + rearm
5. drive-changes-pull  // Delta sync
6. Invalida cache da biblioteca
7. Dispara eventos de refresh
```

## Componentes Envolvidos

### Frontend
- `GoogleDriveIntegration.tsx` - Orquestrador principal com FSM
- `DriveBrowserCard.tsx` - Picker visual de pastas
- `DriveFolderSelectionCard.tsx` - Card com botões e status
- `useDriveSyncOrchestrator.ts` - Hook de sincronização

### Backend
- `drive-folder-verify` - Validação de pasta
- `google-drive-auth` (set_folder) - Persistência
- `drive-sync-diagnostics` - Validação de consistência
- `drive-sync-start` - Rearme do root
- `drive-index-folder` - Indexação inicial
- `drive-sync-run` - Processamento de batches
- `drive-changes-pull` - Delta sync

## Segurança e Consistência

### Mutex Anti-Concorrência
```typescript
const [selectionMutex, setSelectionMutex] = useState(false);

// Bloqueia seleções simultâneas
if (selectionMutex) {
  console.warn('[FOLDER_SELECT] Already selecting, ignoring...');
  return;
}
```

### Sem UI Otimista
- Não atualiza UI antes da confirmação do servidor
- Evento `google-drive-folder-updated` só dispara após validação completa
- Read-back obrigatório após persistência

### Validação Multi-Camada
1. **Verify** - Valida no Google Drive
2. **Save** - Valida novamente + persiste
3. **Refresh** - Confirma consistência status + diagnostics

### Tratamento de ROOT_MISMATCH
```typescript
// No drive-sync-run
if (error.includes('ROOT_MISMATCH') && retries < 3) {
  // Backoff exponencial
  await sleep(1000 * 2^retries);
  
  // Re-arm
  await drive-sync-start();
  
  // Retry
  continue;
}
```

## Logs para Debug

Cada etapa loga com prefixos específicos:
- `[FOLDER_SELECT]` - Fluxo geral
- `[FOLDER_SELECT][verify]` - Verificação
- `[FOLDER_SELECT][save]` - Salvamento
- `[FOLDER_SELECT][refresh]` - Confirmação
- `[FOLDER_SELECT][ready]` - Sucesso
- `[ORCHESTRATOR]` - Sincronização

Todos incluem `traceId` para correlação.

## Teste de Validação (Produção)

### Cenário A: Primeira pasta
1. Login → Google Drive → Buscar pasta
2. Navegar até "PhotoLabel_Test"
3. Clicar em "Selecionar pasta"
4. ✅ Card azul mostra: verifying → saving → confirming
5. ✅ Toast verde: "Pasta configurada com sucesso"
6. ✅ Botão "Sincronizar" habilitado
7. ✅ Path mostra "Meu Drive > Back-up's Gerais > PhotoLabel_Test"
8. Clicar em "Sincronizar"
9. ✅ Indexa e sincroniza apenas arquivos de PhotoLabel_Test
10. ✅ Biblioteca mostra apenas arquivos de PhotoLabel_Test

### Cenário B: Troca de pasta
1. Estado atual: PhotoLabel_Test configurado
2. Clicar em "Trocar pasta"
3. Navegar até "Marcia"
4. Clicar em "Selecionar pasta"
5. ✅ Mesmo fluxo FSM (verify → save → confirm)
6. ✅ Path atualiza para "Meu Drive > Marcia"
7. Clicar em "Sincronizar"
8. ✅ Indexa e sincroniza apenas arquivos de Marcia
9. ✅ Biblioteca mostra apenas arquivos de Marcia (não mais PhotoLabel_Test)

### Cenário C: Pasta inacessível (404)
1. Copiar ID de pasta sem permissão
2. Forçar verify com esse ID
3. ✅ Toast vermelho: "Pasta não encontrada"
4. ✅ Link para abrir no Drive
5. ✅ Dica de verificar conta/compartilhamento
6. ✅ TraceID no erro para debug

### Cenário D: Token expirado (401)
1. Esperar token expirar (1h)
2. Tentar selecionar pasta
3. ✅ Auto-reconnect dispara
4. ✅ Popup OAuth abre
5. ✅ Após reconectar, retry automático
6. ✅ Fluxo completa normalmente

## Critérios de Aceite

✅ Usuário NUNCA precisa colar ID manualmente
✅ Picker visual captura id/name/path automaticamente
✅ Validação em 3 camadas (verify → save → confirm)
✅ Botão "Sincronizar" só habilita após confirmação
✅ Sem UI otimista (atualiza após servidor confirmar)
✅ Erros específicos com mensagens acionáveis
✅ Troca de pasta substitui completamente a anterior
✅ Biblioteca filtra por root_folder_id atual
✅ Tratamento automático de 401/403/404/409
✅ Logs detalhados com TraceID em todas as etapas
