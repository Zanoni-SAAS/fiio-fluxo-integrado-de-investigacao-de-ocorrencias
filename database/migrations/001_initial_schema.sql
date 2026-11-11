-- ============================================================================
-- MIGRATION 001: ESQUEMA INICIAL (PostgreSQL / Supabase)
-- FIIO - Fluxo Integrado de Investigação de Ocorrências (PWA + Central Web)
-- Arquitetura Multi-Contrato / Multi-Unidade (setor_id vinculado à Unidade)
-- Matriz Completa: 14 Setores x 6 Categorias (22 Nucleares + 167 Específicas)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela de Setores Operacionais (Os 14 setores da matriz)
CREATE TABLE setores (
    id SMALLINT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    descricao VARCHAR(255)
);

-- 2. Tabela de Categorias Nucleares (Toque 1 - Fixas de 1 a 6)
CREATE TABLE categorias_nucleares (
    id SMALLINT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE
);

-- 3. Tabela de Tipos de Ocorrência (Toque 2 - Nucleares Globais + Específicas por Setor)
CREATE TABLE tipos_ocorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id SMALLINT NOT NULL REFERENCES categorias_nucleares(id),
    setor_id SMALLINT REFERENCES setores(id), -- NULL quando is_global = TRUE
    titulo VARCHAR(255) NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE para os 22 itens [Nuclear]
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_global_ou_setor CHECK (
        (is_global = TRUE AND setor_id IS NULL) OR
        (is_global = FALSE AND setor_id IS NOT NULL)
    )
);

-- 4. Tabela de Clientes / Contratos (Um mesmo cliente pode ter unidades em vários setores)
CREATE TABLE clientes_contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_cliente VARCHAR(150) NOT NULL,       -- Ex: 'Sabesp', 'Grupo Varejo S.A.', 'Mineradora Serra Sul'
    codigo_contrato VARCHAR(50) UNIQUE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela de Unidades Operacionais (O setor_id fica no nível da Unidade/Posto!)
-- Exemplo prático: Cliente 'Sabesp' possui:
--   - Unidade 'Sede Corporativa Pinheiros' -> setor_id = 2 (Setor Administrativo)
--   - Unidade 'ETA Guaraú - Tratamento'    -> setor_id = 3 (Setor Industrial)
CREATE TABLE unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES clientes_contratos(id) ON DELETE CASCADE,
    setor_id SMALLINT NOT NULL REFERENCES setores(id),
    nome VARCHAR(150) NOT NULL,
    cidade_uf VARCHAR(80),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabela de Locais (Gerenciada pelo Usuário Administrador por Unidade Operacional)
CREATE TABLE locais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,               -- Ex: 'Portaria Principal', 'Doca 02', 'Corredor de Bombas'
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tabela de Ocorrências (Alimentada pelo Agente via Mobile PWA / Offline Sync)
CREATE TABLE ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo VARCHAR(30) UNIQUE NOT NULL,
    agente_id UUID NOT NULL,
    contrato_id UUID NOT NULL REFERENCES clientes_contratos(id),
    unidade_id UUID NOT NULL REFERENCES unidades(id),
    setor_id SMALLINT NOT NULL REFERENCES setores(id),
    local_id UUID NOT NULL REFERENCES locais(id),

    -- Taxonomia em Cascata (Toque 1 e Toque 2)
    categoria_id SMALLINT NOT NULL REFERENCES categorias_nucleares(id),
    tipo_ocorrencia_id UUID REFERENCES tipos_ocorrencia(id),
    categoria_nuclear VARCHAR(120) NOT NULL,  -- Snapshot textual para auditoria imutável
    opcao_selecionada VARCHAR(255) NOT NULL,  -- Snapshot textual ([Nuclear] ou [Específico])
    origem_opcao VARCHAR(20) NOT NULL CHECK (origem_opcao IN ('NUCLEAR', 'ESPECIFICO')),

    -- Campos de Texto Livre do Agente
    descricao TEXT NOT NULL,
    acoes_tomadas TEXT NOT NULL,
    conclusao_agente TEXT,                    -- Campo de texto livre do agente em campo

    -- Metadados de Contexto, Sincronização Offline e Auditoria
    data_hora_fato TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    criado_offline BOOLEAN NOT NULL DEFAULT FALSE,
    geo_latitude DECIMAL(10, 8),
    geo_longitude DECIMAL(11, 8),
    dispositivo_info JSONB,                   -- SO, navegador, versão do PWA
    hash_integridade CHAR(64) NOT NULL        -- Hash SHA-256 gerado no dispositivo
);

-- 8. Tabela de Apuração (Alimentada pela Equipe de Investigação/Auditoria no Painel Web)
CREATE TABLE apuracao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocorrencia_id UUID REFERENCES ocorrencias(id) ON DELETE CASCADE UNIQUE NOT NULL,
    responsavel_id UUID,
    responsavel_nome VARCHAR(120),

    -- Regra de Negócio: 4 Status de Investigação definidos
    status VARCHAR(30) NOT NULL DEFAULT 'Não Iniciada'
        CHECK (status IN ('Não Iniciada', 'Em Apuração', 'Interrompida', 'Concluída')),

    -- Campos Investigativos
    motivo_interrupcao TEXT,                  -- Detalhe quando aguardando perícia/órgãos públicos
    analise_texto TEXT,
    conclusao_final VARCHAR(50)
        CHECK (conclusao_final IN ('Infração Confirmada', 'Infração não Confirmada', 'Sem Conclusão')),

    data_encerramento TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Garante que uma apuração só seja 'Concluída' se houver 'conclusao_final' preenchida
    CONSTRAINT chk_conclusao_obrigatoria CHECK (
        (status <> 'Concluída') OR (status = 'Concluída' AND conclusao_final IS NOT NULL)
    )
);

-- 9. Tabela de Evidências (Fotos e Arquivos anexados)
CREATE TABLE evidencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
    tipo_arquivo VARCHAR(30) NOT NULL
        CHECK (tipo_arquivo IN ('FOTO_LOCAL', 'FOTO_DOCUMENTO', 'BOLETIM_POLICIAL', 'VIDEO_CFTV', 'OUTRO')),
    url_armazenamento TEXT NOT NULL,
    hash_arquivo CHAR(64),
    data_upload TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance de filtros e Mapas de Calor (Heatmaps) por Contrato/Unidade/Local
CREATE INDEX idx_unidades_contrato_setor ON unidades(contrato_id, setor_id);
CREATE INDEX idx_locais_unidade ON locais(unidade_id);
CREATE INDEX idx_ocorrencias_unidade_local ON ocorrencias(unidade_id, local_id);
CREATE INDEX idx_ocorrencias_categoria ON ocorrencias(categoria_id);
CREATE INDEX idx_apuracao_status ON apuracao(status);
