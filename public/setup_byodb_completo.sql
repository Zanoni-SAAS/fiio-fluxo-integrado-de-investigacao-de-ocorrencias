-- ============================================================================
-- FIIO - FLUXO INTEGRADO DE INVESTIGAÇÃO DE OCORRÊNCIAS
-- SCRIPT ÚNICO DE INSTALAÇÃO BYODB (Bring Your Own Database - Supabase / PostgreSQL)
-- Ordem Consolidada:
--   1. database/migrations/001_initial_schema.sql
--   2. database/seeds/002_seed_matriz_14_setores.sql
--   3. database/migrations/003_audit_and_formal_investigation.sql
-- Instrução ao Assinante: Copie e cole todo este arquivo no SQL Editor da sua
-- conta Supabase e clique em "Run" para provisionar tabelas, matriz e travas.
-- ============================================================================

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


-- ============================================================================
-- SEED 002: POPULAÇÃO DA MATRIZ COMPLETA (14 SETORES x 6 CATEGORIAS)
-- 22 Opções Nucleares Globais (is_global = TRUE) + 102 Opções Específicas
-- ============================================================================

-- 1. Inserindo as 6 Categorias Nucleares (Toque 1)
INSERT INTO categorias_nucleares (id, nome) VALUES
  (1, '1. Crimes Contra o Patrimônio'),
  (2, '2. Controle de Acesso, Intrusão e Evasão'),
  (3, '3. Incidentes com Pessoas'),
  (4, '4. Inconformidades Procedimentais e Operacionais'),
  (5, '5. Infraestrutura, Emergências e Tráfego'),
  (6, '6. Segurança Pública e Ilícitos Diversos')
ON CONFLICT (id) DO NOTHING;

-- 2. Inserindo os 14 Setores Operacionais
INSERT INTO setores (id, nome) VALUES
  (1, '1. Setor Logístico (Transportadoras e Centros de Distribuição)'),
  (2, '2. Setor Administrativo (Escritórios e Sedes Corporativas)'),
  (3, '3. Setor Industrial (Fábricas, Usinas e Estações de Tratamento)'),
  (4, '4. Setor Tecnológico (Data Centers e Hubs de TI)'),
  (5, '5. Setor Varejista (Lojas, Atacarejos e Supermercados)'),
  (6, '6. Setor Recreativo (Clubes, Parques, Arenas e Estádios)'),
  (7, '7. Setor Agropecuarista (Fazendas, Usinas Agrícolas e Silos)'),
  (8, '8. Setor Extrativista (Mineração, Siderurgia de Base e Florestal)'),
  (9, '9. Setor Hospitalar (Hospitais, Clínicas e Laboratórios)'),
  (10, '10. Setor Educacional (Escolas, Universidades e Campus)'),
  (11, '11. Setor Multicomercial (Shopping Centers, Galerias e Centros Empresariais)'),
  (12, '12. Setor Aeroportuário (Aeroportos, Terminais de Carga Aérea e Heliportos)'),
  (13, '13. Setor Rodoferroviário (Rodovias, Ferrovias, Metrôs e Terminais)'),
  (14, '14. Setor Residencial (Condomínios Horizontais e Verticais)')
ON CONFLICT (id) DO NOTHING;

-- 3. Inserindo os 22 Tipos de Ocorrência Nucleares Fixos (is_global = TRUE, setor_id = NULL)
INSERT INTO tipos_ocorrencia (categoria_id, setor_id, titulo, is_global) VALUES
  (1, NULL, 'Furto ou Tentativa (Geral)', TRUE),
  (1, NULL, 'Roubo ou Tentativa (Geral)', TRUE),
  (1, NULL, 'Dano ao Patrimônio / Vandalismo (Geral)', TRUE),
  (2, NULL, 'Acesso não autorizado a área restrita', TRUE),
  (2, NULL, 'Invasão de perímetro ou propriedade', TRUE),
  (2, NULL, 'Tentativa de acesso com falsa identificação / Fraude documental', TRUE),
  (3, NULL, 'Homicídio / Óbito violento ou suspeito', TRUE),
  (3, NULL, 'Agressão (Lesão corporal, ameaça ou vias de fato)', TRUE),
  (3, NULL, 'Acidente pessoal ou Mal súbito (Necessidade de APH)', TRUE),
  (3, NULL, 'Comportamento inadequado / Desordem / Assédio', TRUE),
  (4, NULL, 'Descumprimento de norma interna / Procedimento padrão', TRUE),
  (4, NULL, 'Obstrução de saída de emergência ou porta corta-fogo aberta/travada', TRUE),
  (4, NULL, 'Instalação ou acesso encontrado vulnerável (porta/janela destrancada)', TRUE),
  (4, NULL, 'Extravio, perda ou retenção de objeto pessoal/corporativo (crachá, chaves)', TRUE),
  (5, NULL, 'Princípio de incêndio / Fumaça / Disparo de alarme', TRUE),
  (5, NULL, 'Problemas com equipamentos de segurança ou combate a incêndio (CFTV, controle de acesso, alarme, extintores)', TRUE),
  (5, NULL, 'Problemas com estruturas prediais ou utilidades (energia, água, gás)', TRUE),
  (5, NULL, 'Acidente ou inconformidade com veículo no pátio/estacionamento', TRUE),
  (6, NULL, 'Porte ilegal de arma (branca ou de fogo) ou munição', TRUE),
  (6, NULL, 'Uso, porte ou tráfico de substâncias ilícitas', TRUE),
  (6, NULL, 'Objeto ou pacote suspeito / abandonado (Ameaça de bomba)', TRUE),
  (6, NULL, 'Outros tipos de inconformidade / Ocorrência atípica', TRUE);

-- 4. Inserindo os 102 Tipos de Ocorrência Específicos por Setor (is_global = FALSE)
INSERT INTO tipos_ocorrencia (categoria_id, setor_id, titulo, is_global) VALUES
  (1, 1, 'Furto ou violação de carga/mercadoria em doca ou armazém', FALSE),
  (1, 1, 'Roubo ou tentativa de tomada de veículo/carga na chegada ou saída', FALSE),
  (2, 1, 'Evasão de balança rodoviária ou portaria sem liberação', FALSE),
  (2, 1, 'Motorista ou ajudante circulando fora da área de espera', FALSE),
  (4, 1, 'Armazenamento inadequado de mercadoria', FALSE),
  (4, 1, 'Caminhão aberto fora da doca', FALSE),
  (4, 1, 'Manuseio inadequado de carga ou equipamento', FALSE),
  (4, 1, 'Mercadoria exposta ou fora de área demarcada', FALSE),
  (4, 1, 'Mercadoria violada ou com rompimento injustificado de lacre', FALSE),
  (4, 1, 'Objeto pessoal retido na revista', FALSE),
  (4, 1, 'Pacote encontrado fora de fluxo / sem identificação', FALSE),
  (4, 1, 'Divergência de Nota Fiscal, manifesto ou conferência de carga', FALSE),
  (5, 1, 'Problemas com equipamentos operacionais (empilhadeiras, niveladoras de doca)', FALSE),
  (5, 1, 'Tombamento de carga ou colisão interna no armazém', FALSE),
  (1, 2, 'Furto de equipamentos de TI (notebooks, periféricos, celulares corporativos)', FALSE),
  (2, 2, 'Visitante ou prestador circulando sem escolta/acompanhamento', FALSE),
  (2, 2, 'Permanência no prédio fora do horário de expediente sem autorização', FALSE),
  (4, 2, 'Quebra de protocolo de Segurança da Informação (mesa limpa, tela desbloqueada, documento exposto)', FALSE),
  (4, 2, 'Irregularidade no recebimento de malotes ou correspondências', FALSE),
  (5, 2, 'Retenção de pessoas em elevador / Falha de transporte vertical', FALSE),
  (1, 3, 'Furto de cabos de cobre, matéria-prima, insumos ou ferramental', FALSE),
  (1, 3, 'Sabotagem ou adulteração deliberada de linha de produção/tratamento', FALSE),
  (2, 3, 'Acesso não autorizado a subestação, caldeira ou área classificada de risco', FALSE),
  (3, 3, 'Acidente de trabalho severo com maquinário ou linha industrial', FALSE),
  (4, 3, 'Ausência ou uso incorreto de EPI/EPC obrigatório', FALSE),
  (4, 3, 'Violação de protocolo de segurança de máquinas (burla de sensor, falta de bloqueio LOTO)', FALSE),
  (4, 3, 'Inconformidade na pesagem, lacre ou fluxo de insumos na portaria industrial', FALSE),
  (5, 3, 'Incidente ambiental, vazamento químico, derramamento de efluentes ou emissão de gases', FALSE),
  (1, 4, 'Furto de componentes físicos de servidores (HDDs, memórias, placas, cabos)', FALSE),
  (1, 4, 'Dano físico ou corte intencional de fibra óptica / cabeamento estruturado', FALSE),
  (2, 4, 'Acesso não autorizado à Sala Cofre ou gaiola de clientes (Colocation)', FALSE),
  (2, 4, 'Quebra de protocolo de eclusa / Entrada carona (Tailgating / Piggybacking)', FALSE),
  (4, 4, 'Violação de rack (abertura sem ordem de serviço) ou conexão de mídia física não autorizada', FALSE),
  (4, 4, 'Registro fotográfico ou filmagem não autorizada no interior das áreas técnicas', FALSE),
  (5, 4, 'Alerta crítico de climatização (HVAC/Chillers), elevação de temperatura ou umidade na Sala Cofre', FALSE),
  (5, 4, 'Falha em sistema de energia ininterrupta (UPS/No-break, banco de baterias ou geradores)', FALSE),
  (5, 4, 'Disparo acidental ou real de sistema de supressão por gás inerte', FALSE),
  (1, 5, 'Furto externo por cliente no salão de vendas (Shoplifting)', FALSE),
  (1, 5, 'Furto interno ou desvio por colaborador/terceirizado/promotor', FALSE),
  (1, 5, 'Roubo a frente de caixa (PDV), cofre ou tesouraria', FALSE),
  (1, 5, 'Arrombamento noturno de loja ou quebra de vitrine', FALSE),
  (2, 5, 'Evasão de Frente de Caixa (PDV) sem pagamento', FALSE),
  (2, 5, 'Acesso não autorizado ao estoque de alto valor (eletrônicos, bebidas, perfumaria)', FALSE),
  (4, 5, 'Consumo indevido de produtos no interior da loja sem pagamento', FALSE),
  (4, 5, 'Violação de embalagens, troca de etiquetas de preço ou ocultação de produtos nas gôndolas', FALSE),
  (4, 5, 'Violação ou remoção de etiqueta rígida/adesiva antifurto (EAS)', FALSE),
  (4, 5, 'Irregularidade na doca de recebimento (divergência de nota, caminhão aberto, paletes abandonados)', FALSE),
  (5, 5, 'Falha em antenas antifurto (EAS) ou câmeras de frente de caixa', FALSE),
  (5, 5, 'Falha em balcões refrigerados ou câmaras frias (risco de perda de perecíveis)', FALSE),
  (6, 5, 'Recebimento de cédula falsa ou fraude em meio de pagamento/PIX', FALSE),
  (1, 6, 'Furto em guarda-volumes, vestiários ou armários de sócios/frequentadores', FALSE),
  (1, 6, 'Depredação de arquibancadas, assentos, banheiros ou instalações esportivas', FALSE),
  (2, 6, 'Invasão de campo/gramado, palco, camarim ou piscina interditada', FALSE),
  (2, 6, 'Evasão de bilheteria / Pulo de catraca / Uso de ingresso falso', FALSE),
  (3, 6, 'Briga generalizada / Confronto entre torcidas ou grupos', FALSE),
  (3, 6, 'Criança, idoso ou pessoa vulnerável perdida/desencontrada', FALSE),
  (3, 6, 'Embriaguez severa / Coma alcoólico', FALSE),
  (3, 6, 'Afogamento ou incidente aquático em parque/clube', FALSE),
  (4, 6, 'Descumprimento de regras de segurança em atrações, brinquedos ou piscinas', FALSE),
  (5, 6, 'Parada técnica ou falha mecânica em brinquedo/atração com público', FALSE),
  (6, 6, 'Retenção de item proibido na revista (garrafas de vidro, rojões, sinalizadores, laser)', FALSE),
  (6, 6, 'Cambismo ou venda ilegal de ingressos no perímetro', FALSE),
  (1, 7, 'Furto ou roubo de defensivos agrícolas, sementes ou fertilizantes', FALSE),
  (1, 7, 'Furto ou abate clandestino de animais / gado (Abigeato)', FALSE),
  (1, 7, 'Furto de maquinário agrícola, tratores, módulos GPS ou combustível', FALSE),
  (1, 7, 'Desvio de grãos/safra durante a colheita ou armazenamento em silos', FALSE),
  (2, 7, 'Ocupação ou invasão coletiva de terras / Esbulho possessório', FALSE),
  (2, 7, 'Trânsito de veículos ou pessoas desconhecidas em estradas internas da propriedade', FALSE),
  (3, 7, 'Acidente com animal peçonhento ou ataque de animal de grande porte', FALSE),
  (3, 7, 'Engolfamento em silo de grãos ou acidente grave com implemento agrícola', FALSE),
  (4, 7, 'Cerca cortada, mourão danificado ou porteira deixada aberta', FALSE),
  (4, 7, 'Fuga ou extravio de rebanho para áreas externas ou rodovias', FALSE),
  (5, 7, 'Incêndio florestal, queimada em pastagem ou lavoura', FALSE),
  (6, 7, 'Caça, pesca predatória ou desmatamento ilegal dentro da propriedade', FALSE),
  (1, 8, 'Furto ou desvio de minério concentrado, cargas de madeira ou explosivos', FALSE),
  (1, 8, 'Furto de componentes de maquinário pesado (baterias, pneus gigantes, cabos)', FALSE),
  (2, 8, 'Invasão para garimpo ilegal ou extração clandestina de madeira na concessão', FALSE),
  (2, 8, 'Violação de perímetro de segurança em zona de detonação (fogo/desmonte) ou barragem', FALSE),
  (3, 8, 'Soterramento, queda de rocha ou acidente em cava/subsolo', FALSE),
  (4, 8, 'Irregularidade na escolta, armazenamento ou manuseio de explosivos (paiol)', FALSE),
  (4, 8, 'Caminhão fora de estrada ou veículo leve trafegando sem bandeirola/escolta na mina', FALSE),
  (5, 8, 'Anomalia geotécnica, deslizamento de talude ou acionamento de sirene de barragem', FALSE),
  (5, 8, 'Bloqueio de via de escoamento ou ferrovia interna por manifestantes/comunidade', FALSE),
  (1, 9, 'Furto ou desvio de medicamentos controlados (psicotrópicos/opioides) ou insumos', FALSE),
  (1, 9, 'Furto de equipamentos médicos (monitores, oxímetros, bombas de infusão)', FALSE),
  (1, 9, 'Furto de pertences de pacientes internados ou acompanhantes', FALSE),
  (2, 9, 'Acesso não autorizado a UTI, Centro Cirúrgico, Farmácia Central ou Necrotério', FALSE),
  (2, 9, 'Tentativa de acesso não autorizado ou rapto em Maternidade / Berçário', FALSE),
  (2, 9, 'Evasão de paciente sem alta médica (fuga hospitalar ou psiquiátrica)', FALSE),
  (3, 9, 'Agressão ou hostilidade de pacientes/familiares contra equipe médica ou recepção', FALSE),
  (3, 9, 'Surto psicótico, agitação severa ou tentativa de suicídio de paciente', FALSE),
  (4, 9, 'Descarte irregular de lixo hospitalar, risco biológico ou material perfurocortante', FALSE),
  (4, 9, 'Troca ou ausência de pulseira de identificação de paciente/acompanhante', FALSE),
  (5, 9, 'Falha crítica no suprimento de gases medicinais (oxigênio/vácuo) ou geradores de emergência', FALSE),
  (5, 9, 'Obstrução de rampa de ambulâncias / Pronto-Socorro', FALSE),
  (6, 9, 'Exercício ilegal da medicina (falso médico/enfermeiro) ou escolta policial de paciente custodiado', FALSE),
  (1, 10, 'Furto de equipamentos de laboratório, projetores, computadores ou acervo de biblioteca', FALSE),
  (1, 10, 'Depredação ou pichação de carteiras, salas de aula e banheiros', FALSE),
  (2, 10, 'Entrada de pessoa estranha à comunidade acadêmica (não aluno/não autorizado)', FALSE),
  (2, 10, 'Evasão escolar de menor de idade sem autorização dos responsáveis', FALSE),
  (3, 10, 'Briga entre estudantes, bullying severo ou trote violento', FALSE),
  (3, 10, 'Ameaça de ataque ativo / Massacre escolar (redes sociais ou pichações)', FALSE),
  (3, 10, 'Conflito com pais ou responsáveis exaltados na portaria/secretaria', FALSE),
  (4, 10, 'Permanência de alunos em salas ou blocos isolados após o encerramento das aulas', FALSE),
  (5, 10, 'Acidente em laboratório químico/físico ou quadra poliesportiva', FALSE),
  (6, 10, 'Uso ou comercialização de cigarros eletrônicos (vapes) ou álcool por menores', FALSE),
  (1, 11, 'Furto de veículo, módulo, estepe ou pertences no interior de veículo no estacionamento', FALSE),
  (1, 11, 'Furto de celular/carteira de clientes na praça de alimentação ou corredores', FALSE),
  (1, 11, 'Furto ou arrombamento de loja/quiosque (fechamento ou madrugada)', FALSE),
  (1, 11, 'Roubo a joalheria, casa de câmbio, loja de eletrônicos ou carro-forte', FALSE),
  (2, 11, 'Evasão de cancela de estacionamento sem pagamento ou fraude de ticket', FALSE),
  (2, 11, 'Acesso não autorizado a corredores técnicos, telhado ou casa de máquinas', FALSE),
  (2, 11, 'Fornecedor ou prestador realizando carga/descarga fora do horário permitido', FALSE),
  (3, 11, 'Criança, idoso ou pessoa vulnerável perdida no mall', FALSE),
  (3, 11, 'Tumulto, arrastão, manifestação ou aglomeração atípica ("rolezinho")', FALSE),
  (4, 11, 'Abandono de paletes, caixas ou resíduos por lojistas nas docas/corredores técnicos', FALSE),
  (4, 11, 'Loja operando fora do horário padrão ou realizando obra sem autorização (RRI)', FALSE),
  (4, 11, 'Descarte irregular de óleo ou lixo orgânico fora das normas da administração', FALSE),
  (5, 11, 'Acidente ou falha em escada rolante, esteira ou elevador panorâmico', FALSE),
  (5, 11, 'Vazamento de gás/fumaça em coifa de restaurante na praça de alimentação', FALSE),
  (5, 11, 'Veículo abandonado no estacionamento (múltiplos pernoites)', FALSE),
  (6, 11, 'Comércio ambulante, mendicância ou panfletagem não autorizada no mall', FALSE),
  (1, 12, 'Violação ou furto de bagagem despachada (rampa/triagem) ou de mão', FALSE),
  (1, 12, 'Furto ou roubo no Terminal de Cargas (TECA)', FALSE),
  (1, 12, 'Dano intencional a aeronave, auxílio de navegação ou equipamento de solo (GSE)', FALSE),
  (2, 12, 'Intrusão em Área Restrita de Segurança (ARS), Pátio de Manobras ou Pista de Pouso', FALSE),
  (2, 12, 'Passageiro circulando desacompanhado no pátio de aeronaves', FALSE),
  (2, 12, 'Evasão de inspeção de segurança (canal de Raio-X / pórtico detector de metais)', FALSE),
  (3, 12, 'Passageiro indisciplinado (Unruly passenger) em solo ou desembarque compulsório de aeronave', FALSE),
  (3, 12, 'Tumulto generalizado em portão de embarque ou balcão de check-in (atrasos/cancelamentos)', FALSE),
  (4, 12, 'Não ostentação ou uso irregular de Credencial Aeroportuária (ATIV/Credencial de Pátio)', FALSE),
  (4, 12, 'Objeto deixado na pista/pátio com risco de ingestão por turbinas (FOD - Foreign Object Debris)', FALSE),
  (5, 12, 'Presença de animais ou aves na pista de pouso (Risco de Fauna / Bird Strike)', FALSE),
  (5, 12, 'Acidente ou abalroamento envolvendo veículos de apoio em solo (Pushback, catering, abastecimento)', FALSE),
  (5, 12, 'Derramamento de combustível de aviação (QAV) no pátio', FALSE),
  (6, 12, 'Retenção de item proibido no canal de inspeção (Raio-X) ou embarque clandestino de arma', FALSE),
  (6, 12, 'Apontamento de raio laser ou drone clandestino no cone de aproximação de aeronaves', FALSE),
  (1, 13, 'Furto de cabos de cobre, sinalização, baterias ou fibra óptica ao longo da via', FALSE),
  (1, 13, 'Furto de trilhos, dormentes, talas de junção ou grampos de fixação', FALSE),
  (1, 13, 'Saque de carga (após parada forçada, acidente ou abertura intencional de bica de vagão)', FALSE),
  (1, 13, 'Furto/Roubo a passageiros no interior de vagões, ônibus ou plataformas', FALSE),
  (1, 13, 'Apedrejamento, pichação (graffiti) ou depredação de trens, praças de pedágio e estações', FALSE),
  (2, 13, 'Evasão de tarifa (pulo de catraca, passagem por baixo/carona) em estação', FALSE),
  (2, 13, 'Evasão de praça de pedágio ou balança de pesagem rodoviária', FALSE),
  (2, 13, 'Invasão de faixa de domínio ou caminhada sobre a via permanente/túnel', FALSE),
  (3, 13, 'Atropelamento ferroviário ou rodoviário (acidental ou tentativa de suicídio na via)', FALSE),
  (3, 13, 'Importunação ou assédio sexual no interior de composição/estação', FALSE),
  (3, 13, 'Queda de usuário no vão entre o trem e a plataforma', FALSE),
  (4, 13, 'Passatismo ("surf" ferroviário ou carona clandestina entre vagões de carga/passageiros)', FALSE),
  (4, 13, 'Acionamento indevido de botão de emergência ou freio de composição sem emergência real', FALSE),
  (5, 13, 'Descarrilamento, abalroamento em passagem em nível (PN) ou colisão grave em rodovia', FALSE),
  (5, 13, 'Obstrução intencional de via (barricadas, queima de pneus, protestos ou pedras nos trilhos)', FALSE),
  (5, 13, 'Queda de barreira/deslizamento ou presença de animais de grande porte soltos na via', FALSE),
  (5, 13, 'Acidente envolvendo transporte de produtos perigosos (HAZMAT)', FALSE),
  (6, 13, 'Comércio irregular ambulante no interior de trens e estações (Marreteiros)', FALSE),
  (1, 14, 'Furto ou invasão no interior de unidade autônoma (casa ou apartamento)', FALSE),
  (1, 14, 'Furto de bicicletas, encomendas (delivery) ou objetos em vagas de garagem', FALSE),
  (2, 14, 'Entregador de aplicativo ou prestador circulando nos blocos/ruas sem liberação da portaria', FALSE),
  (2, 14, 'Entrada carona pelo portão de veículos ou clausura de pedestres sem identificação', FALSE),
  (3, 14, 'Ocorrência de violência doméstica ou familiar na unidade', FALSE),
  (3, 14, 'Desinteligência severa ou vias de fato entre condôminos ou contra funcionários da portaria', FALSE),
  (4, 14, 'Realização de obras, mudanças ou serviços fora do horário permitido no Regimento Interno', FALSE),
  (4, 14, 'Ocupação indevida de vaga de garagem alheia ou área de manobra', FALSE),
  (4, 14, 'Descarte irregular de lixo ou entulho nas áreas comuns/escadarias', FALSE),
  (5, 14, 'Excesso de velocidade ou direção perigosa nas vias internas do condomínio', FALSE),
  (6, 14, 'Perturbação do sossego (festas, som alto ou barulho excessivo após horário limite)', FALSE),
  (6, 14, 'Incidente com animais domésticos (soltos sem guia em área comum, ataque ou ruído contínuo)', FALSE);


-- ============================================================================
-- MIGRAÇÃO 003: CADEIA DE CUSTÓDIA, LOGS APPEND-ONLY E APURAÇÃO FORMAL
-- Sistema: FIIO - Fluxo Integrado de Investigação de Ocorrências
-- Arquitetura BYODB (Bring Your Own Database - Supabase / PostgreSQL)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Garantia Defensiva da Coluna conclusao_agente na Tabela ocorrencias
ALTER TABLE ocorrencias
    ADD COLUMN IF NOT EXISTS conclusao_agente TEXT;

-- 1. Adequação da Tabela de Apuração para suportar o Anexo de Apuração Formal
ALTER TABLE apuracao
    ADD COLUMN IF NOT EXISTS apuracao_formal_url TEXT,
    ADD COLUMN IF NOT EXISTS apuracao_formal_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS apuracao_formal_nome VARCHAR(255),
    ADD COLUMN IF NOT EXISTS apuracao_formal_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 2. Adequação da Tabela de Evidências para segregar Origem (Campo vs. Investigação)
ALTER TABLE evidencias
    ADD COLUMN IF NOT EXISTS origem_anexo VARCHAR(30) DEFAULT 'CAMPO_AGENTE'
        CHECK (origem_anexo IN ('CAMPO_AGENTE', 'INVESTIGACAO_APURACAO', 'LAUDO_FORMAL')),
    ADD COLUMN IF NOT EXISTS hash_sha256 CHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    ADD COLUMN IF NOT EXISTS uploaded_by UUID;

-- 3. Tabela Central de Auditoria (Append-Only / Imutável)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL,
    perfil_usuario VARCHAR(40) NOT NULL, -- 'AGENTE', 'INVESTIGADOR', 'SUPERVISOR', 'ADMIN'
    tipo_evento VARCHAR(30) NOT NULL
        CHECK (tipo_evento IN (
            'CREATE_OCORRENCIA',
            'READ_OCORRENCIA',
            'READ_EVIDENCIA',
            'UPDATE_APURACAO',
            'UPLOAD_EVIDENCIA',
            'UPLOAD_APURACAO_FORMAL',
            'EXPORT_RELATORIO'
        )),
    detalhes_alteracao JSONB, -- Para UPDATE: {"campo": {"antes": X, "depois": Y}}
    geo_latitude DECIMAL(10, 8),
    geo_longitude DECIMAL(11, 8),
    geo_precisao_metros DECIMAL(8, 2),
    dispositivo_info JSONB NOT NULL DEFAULT '{}'::jsonb, -- userAgent, plataforma, tela, versaoApp
    ip_origem INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ocorrencia ON audit_logs(ocorrencia_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usuario ON audit_logs(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_evento ON audit_logs(tipo_evento);

-- 4. Trava de Imutabilidade (Append-Only) na Tabela audit_logs
CREATE OR REPLACE FUNCTION fn_prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLAÇÃO DE SEGURANÇA FIIO: Registros de auditoria (audit_logs) são estritamente imutáveis (Append-Only) e não permitem %.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 5. Trava de Imutabilidade do Relato Original do Agente em `ocorrencias`
-- Protege os 3 campos de texto livre (descricao, acoes_tomadas, conclusao_agente),
-- além de hash_integridade, agente_id e data_hora_fato.
CREATE OR REPLACE FUNCTION fn_lock_initial_occurrence_report()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.descricao IS DISTINCT FROM NEW.descricao)
       OR (OLD.acoes_tomadas IS DISTINCT FROM NEW.acoes_tomadas)
       OR (OLD.conclusao_agente IS DISTINCT FROM NEW.conclusao_agente)
       OR (OLD.hash_integridade IS DISTINCT FROM NEW.hash_integridade)
       OR (OLD.agente_id IS DISTINCT FROM NEW.agente_id)
       OR (OLD.data_hora_fato IS DISTINCT FROM NEW.data_hora_fato) THEN
        RAISE EXCEPTION 'CADEIA DE CUSTÓDIA FIIO: O relato inicial do agente (descricao, acoes_tomadas, conclusao_agente) e seu hash criptográfico são imutáveis após o registro.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_occurrence_report ON ocorrencias;
CREATE TRIGGER trg_lock_occurrence_report
BEFORE UPDATE ON ocorrencias
FOR EACH ROW EXECUTE FUNCTION fn_lock_initial_occurrence_report();

-- 6. Trigger Automática de Auditoria para Alterações na Apuração (`UPDATE_APURACAO`)
CREATE OR REPLACE FUNCTION fn_audit_apuracao_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_diff JSONB := '{}'::jsonb;
    v_user_id UUID;
    v_role VARCHAR(40);
    v_lat DECIMAL(10, 8);
    v_lng DECIMAL(11, 8);
    v_device JSONB;
    v_ip INET;
BEGIN
    v_user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), '')::UUID, NEW.responsavel_id);
    v_role := COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'INVESTIGADOR');
    v_lat := NULLIF(current_setting('app.client_geo_lat', true), '')::DECIMAL(10, 8);
    v_lng := NULLIF(current_setting('app.client_geo_lng', true), '')::DECIMAL(11, 8);
    v_device := COALESCE(NULLIF(current_setting('app.client_device', true), '')::JSONB, '{}'::jsonb);
    v_ip := NULLIF(current_setting('app.client_ip', true), '')::INET;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_diff := jsonb_set(v_diff, '{status}', jsonb_build_object('antes', OLD.status, 'depois', NEW.status));
    END IF;
    IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
        v_diff := jsonb_set(v_diff, '{responsavel_id}', jsonb_build_object('antes', OLD.responsavel_id, 'depois', NEW.responsavel_id));
    END IF;
    IF OLD.analise_texto IS DISTINCT FROM NEW.analise_texto THEN
        v_diff := jsonb_set(v_diff, '{analise_texto}', jsonb_build_object('antes', OLD.analise_texto, 'depois', NEW.analise_texto));
    END IF;
    IF OLD.conclusao_final IS DISTINCT FROM NEW.conclusao_final THEN
        v_diff := jsonb_set(v_diff, '{conclusao_final}', jsonb_build_object('antes', OLD.conclusao_final, 'depois', NEW.conclusao_final));
    END IF;
    IF OLD.apuracao_formal_url IS DISTINCT FROM NEW.apuracao_formal_url THEN
        v_diff := jsonb_set(v_diff, '{apuracao_formal_url}', jsonb_build_object('antes', OLD.apuracao_formal_url, 'depois', NEW.apuracao_formal_url, 'hash', NEW.apuracao_formal_hash));
    END IF;

    IF NEW.status = 'Concluída' THEN
        IF NEW.conclusao_final IS NULL THEN
            RAISE EXCEPTION 'REGRA DE APURAÇÃO FIIO: Não é permitido alterar o status para Concluída sem preencher a Conclusão de Apuração.';
        END IF;
        NEW.data_encerramento := COALESCE(NEW.data_encerramento, CURRENT_TIMESTAMP);
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;

    INSERT INTO audit_logs (
        ocorrencia_id, usuario_id, perfil_usuario, tipo_evento,
        detalhes_alteracao, geo_latitude, geo_longitude, dispositivo_info, ip_origem
    ) VALUES (
        NEW.ocorrencia_id, v_user_id, v_role, 'UPDATE_APURACAO',
        v_diff, v_lat, v_lng, v_device, v_ip
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_apuracao ON apuracao;
CREATE TRIGGER trg_audit_apuracao
BEFORE UPDATE ON apuracao
FOR EACH ROW EXECUTE FUNCTION fn_audit_apuracao_changes();

-- 7. Função RPC Oficial para Log Automático de Visualização (READ_OCORRENCIA)
CREATE OR REPLACE FUNCTION fn_registrar_acesso_ocorrencia(
    p_ocorrencia_id UUID,
    p_usuario_id UUID,
    p_perfil VARCHAR(40),
    p_geo_lat DECIMAL(10, 8) DEFAULT NULL,
    p_geo_lng DECIMAL(11, 8) DEFAULT NULL,
    p_dispositivo JSONB DEFAULT '{}'::jsonb,
    p_ip INET DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_log_id BIGINT;
BEGIN
    INSERT INTO audit_logs (
        ocorrencia_id, usuario_id, perfil_usuario, tipo_evento,
        detalhes_alteracao, geo_latitude, geo_longitude, dispositivo_info, ip_origem
    ) VALUES (
        p_ocorrencia_id, p_usuario_id, p_perfil, 'READ_OCORRENCIA',
        jsonb_build_object('visualizacao_completa', true, 'rpc', 'fn_registrar_acesso_ocorrencia'),
        p_geo_lat, p_geo_lng, COALESCE(p_dispositivo, '{}'::jsonb), p_ip
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- 7b. Alias de Compatibilidade (fn_log_occurrence_access -> fn_registrar_acesso_ocorrencia)
CREATE OR REPLACE FUNCTION fn_log_occurrence_access(
    p_ocorrencia_id UUID,
    p_usuario_id UUID,
    p_perfil VARCHAR(40),
    p_geo_lat DECIMAL(10, 8) DEFAULT NULL,
    p_geo_lng DECIMAL(11, 8) DEFAULT NULL,
    p_dispositivo JSONB DEFAULT '{}'::jsonb,
    p_ip INET DEFAULT NULL
) RETURNS BIGINT AS $$
BEGIN
    RETURN fn_registrar_acesso_ocorrencia(
        p_ocorrencia_id,
        p_usuario_id,
        p_perfil,
        p_geo_lat,
        p_geo_lng,
        p_dispositivo,
        p_ip
    );
END;
$$ LANGUAGE plpgsql;
