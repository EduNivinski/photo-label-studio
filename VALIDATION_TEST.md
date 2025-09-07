# Validação da Integração Google Drive - Token Provider v2

## ✅ Implementação Completa

### 1. Schema da Base de Dados
- ✅ Tabela `private.user_drive_tokens` criada com:
  - `user_id` (UUID)
  - `access_token_enc` (texto cifrado)
  - `refresh_token_enc` (texto cifrado) 
  - `scope` (texto com escopos separados por espaço)
  - `expires_at` (timestamp)
  - `created_at` / `updated_at`

### 2. Token Provider v2
- ✅ AES-GCM com IV+ciphertext concatenado (formato compatível)
- ✅ Funções: `upsertTokens`, `getTokens`, `refreshAccessToken`, `ensureAccessToken`
- ✅ Refresh automático quando token expira em < 5 minutos
- ✅ Conversão scope string ↔ array

### 3. OAuth Callback
- ✅ Troca code → tokens
- ✅ Armazena tokens cifrados via `upsertTokens()`
- ✅ Converte `scope` string para array com `/\s+/`

### 4. Funções de Diagnóstico
- ✅ `diag-scopes`: Tokeninfo + retry em 401
- ✅ `diag-list-root`: Lista pastas raiz + retry
- ✅ `diag-list-folder`: Lista conteúdo pasta + retry  
- ✅ `diag-list-shared-drive`: Lista shared drive + retry

### 5. Limpeza do Vault
- ✅ Removidas funções RPC antigas (`get_google_drive_tokens_secure`)
- ✅ Removidas tabelas antigas (`google_drive_tokens`, `gd_token_debug`)
- ✅ Todas funções usam apenas `token_provider_v2.ts`

## 📋 Para Testar

### 1. Reconectar Google Drive
```javascript
// OAuth URL com parameters corretos
const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: 'postmessage',
  scope: 'openid email profile https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file',
  response_type: 'code',
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'false'
})}`;
```

### 2. Verificar Gravação no DB
```sql
SELECT 
  updated_at, 
  expires_at, 
  length(scope) as scope_length,
  length(access_token_enc) as token_enc_length
FROM private.user_drive_tokens 
WHERE user_id = 'USER_UUID';
```

### 3. Testar Diagnósticos
```javascript
// 1. Verificar scopes
const scopesResult = await supabase.functions.invoke('diag-scopes');
// Deve retornar: { scopes: ['drive.metadata.readonly', 'drive.file', ...] }

// 2. Listar pastas raiz  
const rootResult = await supabase.functions.invoke('diag-list-root');
// Deve retornar: { status: 'OK', folders: [...], echo: { corpora: 'user' } }

// 3. Testar pasta específica
const folderResult = await supabase.functions.invoke('diag-list-folder', {
  body: { folderId: 'FOLDER_ID' }
});
```

## 🚨 Troubleshooting

### Se der 400 NO_ACCESS_TOKEN
- OAuth callback não salvou → verificar logs da função

### Se der 401 UNAUTHORIZED  
- Token expirado e refresh falhou → verificar GOOGLE_CLIENT_ID/SECRET

### Se der 403 INSUFFICIENT_PERMISSIONS
- Refazer OAuth com `prompt=consent` e scopes corretos

### Códigos de Sucesso Esperados
- `diag-scopes`: 200 com array de scopes
- `diag-list-root`: 200 (mesmo com filesCount: 0)  
- `diag-list-folder`: 200 ou 404 se pasta não existe