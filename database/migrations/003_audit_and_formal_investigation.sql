-- ============================================================================
-- MIGRAÇÃO 003: CADEIA DE CUSTÓDIA, LOGS APPEND-ONLY E APURAÇÃO FORMAL
-- Sistema: FIIO - Fluxo Integrado de Investigação de Ocorrências
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'VIOLAÇÃO DE SEGURANÇA FIIO: Registros de auditoria (audit_logs) são estritamente imutáveis (Append-Only) e não permitem %.', TG_OP; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_tampering();

-- 5. Trava de Imutabilidade do Relato Original do Agente em `ocorrencias`
CREATE OR REPLACE FUNCTION fn_lock_initial_occurrence_report()
RETURNS TRIGGER AS $$ BEGIN IF (OLD.descricao IS DISTINCT FROM NEW.descricao) OR (OLD.acoes_tomadas IS DISTINCT FROM NEW.acoes_tomadas) OR (OLD.hash_integridade IS DISTINCT FROM NEW.hash_integridade) OR (OLD.agente_id IS DISTINCT FROM NEW.agente_id) OR (OLD.data_hora_fato IS DISTINCT FROM NEW.data_hora_fato) THEN RAISE EXCEPTION 'CADEIA DE CUSTÓDIA FIIO: O relato inicial do agente e seu hash criptográfico são imutáveis após o registro.'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_occurrence_report ON ocorrencias;
CREATE TRIGGER trg_lock_occurrence_report
BEFORE UPDATE ON ocorrencias
FOR EACH ROW EXECUTE FUNCTION fn_lock_initial_occurrence_report();

-- 6. Trigger Automática de Auditoria para Alterações na Apuração (`UPDATE_APURACAO`)
CREATE OR REPLACE FUNCTION fn_audit_apuracao_changes()
RETURNS TRIGGER AS $$ DECLARE v_diff JSONB := '{}'::jsonb; v_user_id UUID; v_role VARCHAR(40); v_lat DECIMAL(10, 8); v_lng DECIMAL(11, 8); v_device JSONB; v_ip INET; BEGIN v_user_id := COALESCE(NULLIF(current_setting('app.current_user_id', true), '')::UUID, NEW.responsavel_id); v_role := COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'INVESTIGADOR'); v_lat := NULLIF(current_setting('app.client_geo_lat', true), '')::DECIMAL(10, 8); v_lng := NULLIF(current_setting('app.client_geo_lng', true), '')::DECIMAL(11, 8); v_device := COALESCE(NULLIF(current_setting('app.client_device', true), '')::JSONB, '{}'::jsonb); v_ip := NULLIF(current_setting('app.client_ip', true), '')::INET;      IF OLD.status IS DISTINCT FROM NEW.status THEN v_diff := jsonb_set(v_diff, '{status}', jsonb_build_object('antes', OLD.status, 'depois', NEW.status)); END IF; IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN v_diff := jsonb_set(v_diff, '{responsavel_id}', jsonb_build_object('antes', OLD.responsavel_id, 'depois', NEW.responsavel_id)); END IF; IF OLD.analise_texto IS DISTINCT FROM NEW.analise_texto THEN v_diff := jsonb_set(v_diff, '{analise_texto}', jsonb_build_object('antes', OLD.analise_texto, 'depois', NEW.analise_texto)); END IF; IF OLD.conclusao_final IS DISTINCT FROM NEW.conclusao_final THEN v_diff := jsonb_set(v_diff, '{conclusao_final}', jsonb_build_object('antes', OLD.conclusao_final, 'depois', NEW.conclusao_final)); END IF; IF OLD.apuracao_formal_url IS DISTINCT FROM NEW.apuracao_formal_url THEN v_diff := jsonb_set(v_diff, '{apuracao_formal_url}', jsonb_build_object('antes', OLD.apuracao_formal_url, 'depois', NEW.apuracao_formal_url, 'hash', NEW.apuracao_formal_hash)); END IF;      IF NEW.status = 'Concluída' THEN IF NEW.conclusao_final IS NULL THEN RAISE EXCEPTION 'REGRA DE APURAÇÃO FIIO: Não é permitido alterar o status para Concluída sem preencher a Conclusão de Apuração.'; END IF; NEW.data_encerramento := COALESCE(NEW.data_encerramento, CURRENT_TIMESTAMP); END IF;      NEW.updated_at := CURRENT_TIMESTAMP;      INSERT INTO audit_logs ( ocorrencia_id, usuario_id, perfil_usuario, tipo_evento, detalhes_alteracao, geo_latitude, geo_longitude, dispositivo_info, ip_origem ) VALUES ( NEW.ocorrencia_id, v_user_id, v_role, 'UPDATE_APURACAO', v_diff, v_lat, v_lng, v_device, v_ip );      RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_apuracao ON apuracao;
CREATE TRIGGER trg_audit_apuracao
BEFORE UPDATE ON apuracao
FOR EACH ROW EXECUTE FUNCTION fn_audit_apuracao_changes();

-- 7. Função RPC para Log Automático de Visualização (READ_OCORRENCIA)
CREATE OR REPLACE FUNCTION fn_registrar_acesso_ocorrencia(
    p_ocorrencia_id UUID,
    p_usuario_id UUID,
    p_perfil VARCHAR(40),
    p_geo_lat DECIMAL(10, 8),
    p_geo_lng DECIMAL(11, 8),
    p_dispositivo JSONB,
    p_ip INET
) RETURNS BIGINT AS $$ DECLARE v_log_id BIGINT; BEGIN INSERT INTO audit_logs ( ocorrencia_id, usuario_id, perfil_usuario, tipo_evento, detalhes_alteracao, geo_latitude, geo_longitude, dispositivo_info, ip_origem ) VALUES ( p_ocorrencia_id, p_usuario_id, p_perfil, 'READ_OCORRENCIA', jsonb_build_object('visualizacao_completa', true), p_geo_lat, p_geo_lng, COALESCE(p_dispositivo, '{}'::jsonb), p_ip ) RETURNING id INTO v_log_id;      RETURN v_log_id; END; $$ LANGUAGE plpgsql;
