# 🛡️ FIIO — Fluxo Integrado de Investigação de Ocorrências (Arquitetura BYODB)

Aplicação **PWA Offline-First** para registro de ocorrências em campo pelo vigilante e **Painel Web de Apuração e Auditoria**, estruturada com arquitetura **Multi-Contrato ➔ Multi-Unidade (`setor_id` por unidade) ➔ Locais Fixos**, matriz de taxonomia em cascata (**6 Categorias Nucleares × 14 Setores Operacionais**), **Cadeia de Custódia Imutável (Append-Only)** e modelo **BYODB (*Bring Your Own Database* — Supabase / PostgreSQL)**.

---

## ⚡ Passo a Passo de 3 Minutos: Como Configurar seu Próprio Banco Supabase Gratuito (Modelo BYODB)

O **FIIO** opera sob a arquitetura **BYODB (*Bring Your Own Database*)**: o aplicativo é distribuído gratuitamente e cada empresa contratante conecta sua própria instância isolada do **Supabase / PostgreSQL**, garantindo **sigilo absoluto dos dados** (sem acesso centralizado de terceiros) e **custo zero de hospedagem**.

### Minuto 1: Criar o Projeto Gratuito no Supabase
1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta gratuita (plano *Free Tier* — inclui 500 MB de banco PostgreSQL e 1 GB de Storage).
2. Clique em **"New Project"**, escolha o nome da sua empresa/operação (ex.: `FIIO-Seguranca-Patrimonial`), defina uma senha forte para o banco e selecione a região mais próxima (ex.: *South America - São Paulo*).

### Minuto 2: Executar o Script Único de Instalação (`setup_byodb_completo.sql`)
1. No menu lateral esquerdo do painel do Supabase, clique em **SQL Editor** ➔ **"+ New query"**.
2. No aplicativo **FIIO**, acesse a aba **📍 Admin: Locais do Contrato** e clique no botão verde **"📋 Copiar Script SQL de Instalação Completa (`setup_byodb_completo.sql`)"** (ou copie diretamente o conteúdo do arquivo [`database/setup_byodb_completo.sql`](database/setup_byodb_completo.sql)).
3. Cole o script completo no **SQL Editor** do Supabase e clique em **"Run"** (canto inferior direito).
   - *Pronto!* Em menos de 5 segundos o Supabase criará todas as tabelas, populará automaticamente os **14 Setores Operacionais** (22 opções `[Nuclear]` globais + 102 opções `[Específico]` setoriais) e ativará as travas criptográficas de **Cadeia de Custódia** (`fn_lock_initial_occurrence_report`, `fn_prevent_audit_tampering`, `fn_audit_apuracao_changes` e `fn_registrar_acesso_ocorrencia`).

### Minuto 3: Conectar o Aplicativo à Sua Conta (Credenciais Locais)
1. No painel do Supabase, acesse **Project Settings (ícone de engrenagem)** ➔ **API**.
2. Copie a **Project URL** (`SUPABASE_URL`) e a chave pública **`anon` / `public`** (`SUPABASE_ANON_KEY`).
3. Na aba **📍 Admin: Locais do Contrato** do aplicativo FIIO, cole a `SUPABASE_URL` e a `SUPABASE_ANON_KEY` na seção **"🔌 Conexão do Banco do Cliente (BYODB - Supabase)"**.
4. Clique em **"💾 Salvar Credenciais no Dispositivo"** e em **"🧪 Testar Conexão"**.
   - As chaves ficam gravadas **exclusivamente no navegador/dispositivo do cliente (`localStorage`)**, sem trânsito por servidores de terceiros.
   - As fotos capturadas pelos vigilantes em campo passam por **compressão automática client-side via HTML5 Canvas (`WebP/JPEG ~150 KB`) antes do cálculo do Hash SHA-256**, preservando a franquia gratuita de armazenamento do seu Supabase.

---

## 🏗️ Arquitetura de Dados, Cadeia de Custódia e Regras de Negócio

### 1. Hierarquia Multi-Contrato / Multi-Unidade
Um mesmo cliente pode possuir unidades operacionais em setores distintos (ex.: **Sabesp** com *Sede Corporativa* no **Setor 2 - Administrativo** e *Estação de Tratamento (ETA)* no **Setor 3 - Industrial**).
- `clientes_contratos`: Cadastro corporativo do cliente/contrato.
- `unidades`: Cada unidade operacional pertence a um contrato e possui seu próprio `setor_id` (1 a 14).
- `locais`: Gerenciados pelo usuário Administrador por unidade operacional (ex.: *Portaria Principal*, *Doca 02*, *Sala Cofre*), eliminando erros de digitação e agrupando mapas de calor.

### 2. Taxonomia em Cascata (Toque 1 ➔ Toque 2)
- **Toque 1 (6 Categorias Nucleares)**:
  1. `1. Crimes Contra o Patrimônio`
  2. `2. Controle de Acesso, Intrusão e Evasão`
  3. `3. Incidentes com Pessoas`
  4. `4. Inconformidades Procedimentais e Operacionais`
  5. `5. Infraestrutura, Emergências e Tráfego`
  6. `6. Segurança Pública e Ilícitos Diversos`
- **Toque 2 (Opções Clicáveis)**:
  - **22 Opções `[Nuclear]` Globais (`is_global = TRUE`)**: Presentes de forma idêntica em todos os 14 setores.
  - **102 Opções `[Específico]` Setoriais (`is_global = FALSE`)**: Filtradas automaticamente pelo `setor_id` da Unidade Operacional.

### 3. Imutabilidade dos 3 Campos de Relato do Vigilante e Compressão Antes do SHA-256
- **Texto Livre Imutável (`fn_lock_initial_occurrence_report`)**: Os 3 campos do vigilante (`descricao`, `acoes_tomadas` e `conclusao_agente`), além de `hash_integridade`, `agente_id` e `data_hora_fato`, são bloqueados por trigger no banco contra qualquer edição posterior.
- **Compressão Client-Side + SHA-256**: Fotos de campo são comprimidas no dispositivo via HTML5 `<canvas>` (~150 KB) **antes** do cálculo do hash criptográfico `SHA-256` de 64 caracteres.

### 4. Fluxo de Apuração Formal e Auditoria Append-Only (`audit_logs`)
- **4 Status Oficiais**: `Não Iniciada`, `Em Apuração`, `Interrompida` e `Concluída` (exige obrigatoriamente `conclusao_final`: `Infração Confirmada`, `Infração não Confirmada` ou `Sem Conclusão`).
- **Anexo de Apuração Formal**: Upload do documento final assinado com cálculo automático de hash `SHA-256` (`apuracao_formal_hash`).
- **Auditoria de Leitura e Mutação**: Registro imutável de acessos (`READ_OCORRENCIA` via `fn_registrar_acesso_ocorrencia` / alias `fn_log_occurrence_access`) e de alterações com diff JSONB (`UPDATE_APURACAO`).

---

## 📂 Estrutura do Repositório

- `database/setup_byodb_completo.sql`: **Script Único de Instalação BYODB** consolidando `001_initial_schema.sql` + `002_seed_matriz_14_setores.sql` + `003_audit_and_formal_investigation.sql`.
- `database/migrations/001_initial_schema.sql`: Esquema relacional base para PostgreSQL / Supabase.
- `database/seeds/002_seed_matriz_14_setores.sql`: População automática das 6 categorias, 14 setores, 22 opções nucleares e 102 opções específicas.
- `database/migrations/003_audit_and_formal_investigation.sql`: Cadeia de Custódia, `audit_logs` append-only, trava de imutabilidade de `conclusao_agente` e funções RPC de auditoria.
- `src/domain/taxonomy.mjs`: Motor da matriz de taxonomia, resolução Multi-Unidade, cálculo SHA-256 e validação de imutabilidade do relato inicial.
- `src/auditMiddleware.mjs`: Extração de contexto (GPS, IP, Dispositivo) e logger imutável (`fn_registrar_acesso_ocorrencia` e alias `fn_log_occurrence_access`).
- `src/server/apiServer.mjs`: Servidor REST API e PWA do FIIO.
- `public/index.html`: Aplicativo Web/PWA interativo unificado (App Mobile 3 Passos com compressão Canvas + Central de Apuração + Painel Situacional + Configuração BYODB).
- `tests/domain.test.mjs`: Suíte de 11 testes automatizados validando toda a matriz, cadeia de custódia, imutabilidade de `conclusao_agente` e script BYODB.

---

## 🚀 Execução de Testes

```bash
# Executar suíte de testes automatizados (Node.js Test Runner)
npm test
```
