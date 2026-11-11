# 🛡️ Sentinela — Gestão de Ocorrências Patrimoniais & Central de Apuração

Aplicação **PWA Offline-First** para registro de ocorrências em campo pelo vigilante e **Painel Web de Apuração e Auditoria**, estruturada com arquitetura **Multi-Contrato ➔ Multi-Unidade (`setor_id` por unidade) ➔ Locais Fixos** e matriz de taxonomia em cascata (**6 Categorias Nucleares × 14 Setores Operacionais**).

---

## 🏗️ Arquitetura de Dados e Regras de Negócio

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

### 3. Campos de Relato do Vigilante e Auditoria Criptográfica
- **Texto Livre**: `descricao`, `acoes_tomadas` e `conclusao_agente`.
- **Integridade e Offline-First**: Captura de coordenadas GPS, fila local quando sem conectividade e geração de **Hash SHA-256 (`hash_integridade`)** de 64 caracteres no dispositivo.

### 4. Fluxo de Apuração (4 Status Oficiais)
Gerenciado pela equipe de investigação no Painel Web:
1. `Não Iniciada`: Ocorrência registrada, aguardando triagem.
2. `Em Apuração`: Investigação ativa e coleta de evidências (CFTV, oitivas).
3. `Interrompida`: Pausada por força maior ou aguardando órgãos externos (Polícia Civil, IML, Perícia).
4. `Concluída`: Exige obrigatoriamente (`CHECK CONSTRAINT`) o preenchimento de `conclusao_final` (`Infração Confirmada`, `Infração não Confirmada` ou `Sem Conclusão`).

---

## 📂 Estrutura do Repositório

- `database/migrations/001_initial_schema.sql`: Esquema relacional completo para PostgreSQL / Supabase.
- `database/seeds/002_seed_matriz_14_setores.sql`: População automática das 6 categorias, 14 setores, 22 opções nucleares e 102 opções específicas.
- `src/domain/taxonomy.mjs`: Motor da matriz de taxonomia, resolução Multi-Unidade, cálculo SHA-256 e validação de regras de apuração.
- `src/storage/offlineQueue.mjs`: Camada de persistência e sincronização Offline-First.
- `public/index.html`: Aplicativo Web/PWA interativo unificado (Simulador Mobile 3 Passos + Central de Apuração + Admin de Locais + Explorador da Matriz).
- `tests/domain.test.mjs`: Suíte de testes automatizados validando toda a matriz e os 7 cenários operacionais de teste.

---

## 🚀 Execução de Testes e Seeds

```bash
# Executar suíte de testes automatizados (Node.js Test Runner)
npm test

# Regerar o arquivo SQL de seed da matriz completa
npm run generate:seed
```
