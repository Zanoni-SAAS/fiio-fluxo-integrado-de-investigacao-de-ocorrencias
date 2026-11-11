import crypto from 'node:crypto';

export function extractAuditContext(req) {
  const geoLat = req.headers['x-client-geo-lat'] ? Number(req.headers['x-client-geo-lat']) : null;
  const geoLng = req.headers['x-client-geo-lng'] ? Number(req.headers['x-client-geo-lng']) : null;
  const geoAccuracy = req.headers['x-client-geo-accuracy'] ? Number(req.headers['x-client-geo-accuracy']) : null;

  return {
    usuario_id: req.user?.id || '00000000-0000-0000-0000-000000000000',
    perfil_usuario: req.user?.role || 'INVESTIGADOR',
    geo_latitude: Number.isFinite(geoLat) ? geoLat : null,
    geo_longitude: Number.isFinite(geoLng) ? geoLng : null,
    geo_precisao_metros: Number.isFinite(geoAccuracy) ? geoAccuracy : null,
    ip_origem: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim(),
    dispositivo_info: {
      userAgent: req.headers['user-agent'] || 'Unknown',
      platform: req.headers['sec-ch-ua-platform'] || 'Web/PWA',
      appVersion: req.headers['x-fiio-version'] || '1.0.0'
    }
  };
}

export function createAuditLogger(auditStore = []) {
  return {
    logReadOccurrence(ocorrenciaId, req) {
      const ctx = extractAuditContext(req);
      const entry = {
        id: crypto.randomUUID(),
        ocorrencia_id: ocorrenciaId,
        ...ctx,
        tipo_evento: 'READ_OCORRENCIA',
        detalhes_alteracao: { visualizacao_completa: true },
        created_at: new Date().toISOString()
      };
      auditStore.push(entry);
      return entry;
    },

    logUpdateInvestigation(ocorrenciaId, oldState, newState, req) {
      const ctx = extractAuditContext(req);
      const diff = {};

      for (const field of [
        'status',
        'responsavel_id',
        'analise_texto',
        'conclusao_final',
        'apuracao_formal_nome',
        'apuracao_formal_hash'
      ]) {
        if (oldState[field] !== newState[field]) {
          diff[field] = { antes: oldState[field] ?? null, depois: newState[field] ?? null };
        }
      }

      const entry = {
        id: crypto.randomUUID(),
        ocorrencia_id: ocorrenciaId,
        ...ctx,
        tipo_evento: 'UPDATE_APURACAO',
        detalhes_alteracao: diff,
        created_at: new Date().toISOString()
      };
      auditStore.push(entry);
      return entry;
    },

    getHistoryByOccurrence(ocorrenciaId) {
      return auditStore
        .filter((log) => log.ocorrencia_id === ocorrenciaId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  };
}
