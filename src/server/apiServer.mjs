import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  CATEGORIAS_NUCLEARES,
  SETORES,
  CLIENTES_CONTRATOS,
  computeIntegrityHash,
  validateApuracaoUpdate
} from "../domain/taxonomy.mjs";
import { computeSituationalMetrics, exportOcorrenciasToCSV } from "../analytics/situationalEngine.mjs";
import { authenticateByPin, hasPermission } from "../auth/rbac.mjs";
import { createAuditLogger } from "../auditMiddleware.mjs";

/**
 * Cria uma instância do servidor HTTP/REST do FIIO (Fluxo Integrado de Investigação de Ocorrências)
 * com Cadeia de Custódia, Auditoria de Leitura/Mutação (Append-Only) e Apuração Formal.
 */
export function createFiioServer() {
  const state = {
    contratos: structuredClone(CLIENTES_CONTRATOS),
    ocorrencias: [],
    auditLogs: []
  };

  const auditLogger = createAuditLogger(state.auditLogs);

  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Fiio-Role,X-Fiio-User-Id,X-Client-Geo-Lat,X-Client-Geo-Lng,X-Client-Geo-Accuracy,X-Fiio-Version"
    });
    res.end(JSON.stringify(data));
  }

  function parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const roleHeader = req.headers["x-fiio-role"] || "ADMIN";
    const userIdHeader = req.headers["x-fiio-user-id"] || "00000000-0000-0000-0000-000000000000";

    req.user = {
      id: userIdHeader,
      role: roleHeader
    };

    if (req.method === "OPTIONS") {
      return sendJson(res, 200, { ok: true });
    }

    // 1. Autenticação por PIN
    if (pathname === "/api/auth/pin" && req.method === "POST") {
      const body = await parseBody(req);
      const auth = authenticateByPin(body.pin);
      return sendJson(res, auth.authenticated ? 200 : 401, auth);
    }

    // 2. Taxonomia Completa (6 Categorias, 14 Setores e Contratos/Unidades)
    if (pathname === "/api/taxonomy" && req.method === "GET") {
      return sendJson(res, 200, {
        categoriasNucleares: CATEGORIAS_NUCLEARES,
        setores: SETORES,
        contratos: state.contratos
      });
    }

    // 3. Listar ou Registrar Ocorrências
    if (pathname === "/api/ocorrencias" && req.method === "GET") {
      return sendJson(res, 200, { ocorrencias: state.ocorrencias });
    }

    // 3b. Visualizar Ocorrência Específica (Registra READ_OCORRENCIA na Cadeia de Custódia)
    if (
      pathname.startsWith("/api/ocorrencias/") &&
      pathname.split("/").length === 4 &&
      req.method === "GET"
    ) {
      const id = pathname.split("/")[3];
      const ocr = state.ocorrencias.find(o => o.id === id);
      if (!ocr) {
        return sendJson(res, 404, { error: "Ocorrência não encontrada." });
      }
      const auditEntry = auditLogger.logReadOccurrence(id, req);
      return sendJson(res, 200, {
        ocorrencia: ocr,
        auditEntry,
        auditHistory: auditLogger.getHistoryByOccurrence(id)
      });
    }

    // 3c. Consultar Histórico de Auditoria de uma Ocorrência
    if (
      pathname.startsWith("/api/ocorrencias/") &&
      pathname.endsWith("/audit") &&
      req.method === "GET"
    ) {
      const id = pathname.split("/")[3];
      return sendJson(res, 200, {
        ocorrencia_id: id,
        logs: auditLogger.getHistoryByOccurrence(id)
      });
    }

    if (pathname === "/api/ocorrencias" && req.method === "POST") {
      if (!hasPermission(roleHeader, "REGISTRAR_OCORRENCIA")) {
        return sendJson(res, 403, { error: "Perfil sem permissão para registrar ocorrência." });
      }
      const body = await parseBody(req);
      if (!body.localNome || !body.descricao || !body.opcaoEspecifica) {
        return sendJson(res, 400, { error: "Campos obrigatórios ausentes (localNome, opcaoEspecifica, descricao)." });
      }

      const hashIntegridade = computeIntegrityHash(body);
      const nova = {
        id: `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        protocolo: body.protocolo || `FIIO-2026-${1000 + state.ocorrencias.length + 1}`,
        unidadeId: body.unidadeId || "uni-sabesp-eta",
        setorId: Number(body.setorId || 3),
        setorNome: body.setorNome || "3. Setor Industrial",
        localNome: body.localNome,
        categoriaId: Number(body.categoriaId || 4),
        categoriaNuclear: body.categoriaNuclear || "4. Inconformidades Procedimentais e Operacionais",
        origemOpcao: body.origemOpcao || "NUCLEAR",
        opcaoEspecifica: body.opcaoEspecifica,
        descricao: body.descricao,
        acoesTomadas: body.acoesTomadas || "",
        conclusaoAgente: body.conclusaoAgente || "",
        dataHoraFato: body.dataHoraFato || new Date().toISOString(),
        hashIntegridade,
        apuracao: {
          status: "Não Iniciada",
          responsavel_id: null,
          conclusaoFinal: null,
          analiseTexto: "",
          apuracaoFormalNome: null,
          apuracaoFormalHash: null,
          apuracaoFormalUrl: null,
          apuracaoFormalUploadedAt: null
        }
      };
      state.ocorrencias.unshift(nova);
      return sendJson(res, 201, { ocorrencia: nova });
    }

    // 4. Atualização de Status, Parecer e Apuração Formal (Exige perfil INVESTIGADOR ou ADMIN + Loga UPDATE_APURACAO)
    if (pathname.startsWith("/api/ocorrencias/") && pathname.endsWith("/apuracao") && req.method === "PATCH") {
      if (!hasPermission(roleHeader, "ATUALIZAR_STATUS_APURACAO")) {
        return sendJson(res, 403, { error: "Apenas Investigadores ou Administradores podem alterar a apuração." });
      }
      const id = pathname.split("/")[3];
      const ocr = state.ocorrencias.find(o => o.id === id);
      if (!ocr) {
        return sendJson(res, 404, { error: "Ocorrência não encontrada." });
      }

      const body = await parseBody(req);
      const nextStatus = body.status ?? ocr.apuracao.status;
      const nextConclusao = body.conclusaoFinal !== undefined ? body.conclusaoFinal : ocr.apuracao.conclusaoFinal;

      const check = validateApuracaoUpdate({
        status: nextStatus,
        conclusaoFinal: nextConclusao
      });
      if (!check.valid) {
        return sendJson(res, 422, { error: check.error });
      }

      const oldState = {
        status: ocr.apuracao.status,
        responsavel_id: ocr.apuracao.responsavel_id ?? null,
        analise_texto: ocr.apuracao.analiseTexto ?? "",
        conclusao_final: ocr.apuracao.conclusaoFinal ?? null,
        apuracao_formal_nome: ocr.apuracao.apuracaoFormalNome ?? null,
        apuracao_formal_hash: ocr.apuracao.apuracaoFormalHash ?? null
      };

      ocr.apuracao.status = nextStatus;
      ocr.apuracao.responsavel_id = body.responsavel_id ?? ocr.apuracao.responsavel_id ?? null;
      ocr.apuracao.analiseTexto = body.analiseTexto ?? ocr.apuracao.analiseTexto;
      ocr.apuracao.conclusaoFinal = nextStatus === "Concluída" ? nextConclusao : (nextConclusao || null);

      if (body.apuracaoFormalNome !== undefined) {
        ocr.apuracao.apuracaoFormalNome = body.apuracaoFormalNome;
        ocr.apuracao.apuracaoFormalHash = body.apuracaoFormalHash || null;
        ocr.apuracao.apuracaoFormalUrl = body.apuracaoFormalUrl || `/anexos/formal/${body.apuracaoFormalNome}`;
        ocr.apuracao.apuracaoFormalUploadedAt = new Date().toISOString();
      }

      const newState = {
        status: ocr.apuracao.status,
        responsavel_id: ocr.apuracao.responsavel_id ?? null,
        analise_texto: ocr.apuracao.analiseTexto ?? "",
        conclusao_final: ocr.apuracao.conclusaoFinal ?? null,
        apuracao_formal_nome: ocr.apuracao.apuracaoFormalNome ?? null,
        apuracao_formal_hash: ocr.apuracao.apuracaoFormalHash ?? null
      };

      const auditEntry = auditLogger.logUpdateInvestigation(id, oldState, newState, req);

      return sendJson(res, 200, {
        ocorrencia: ocr,
        auditEntry,
        auditHistory: auditLogger.getHistoryByOccurrence(id)
      });
    }

    // 5. Gestão de Locais Fixos por Unidade (Exige perfil ADMIN)
    if (pathname === "/api/locais" && req.method === "POST") {
      if (!hasPermission(roleHeader, "GERENCIAR_LOCAIS")) {
        return sendJson(res, 403, { error: "Apenas o usuário Administrador pode cadastrar locais fixos." });
      }
      const body = await parseBody(req);
      for (const ctr of state.contratos) {
        const uni = ctr.unidades.find(u => u.id === body.unidadeId);
        if (uni) {
          if (!uni.locais.includes(body.nomeLocal)) {
            uni.locais.push(body.nomeLocal);
          }
          return sendJson(res, 201, { unidade: uni });
        }
      }
      return sendJson(res, 404, { error: "Unidade não encontrada." });
    }

    // 6. Inteligência Situacional & Exportação CSV
    if (pathname === "/api/analytics" && req.method === "GET") {
      return sendJson(res, 200, computeSituationalMetrics(state.ocorrencias));
    }

    if (pathname === "/api/export.csv" && req.method === "GET") {
      const csv = exportOcorrenciasToCSV(state.ocorrencias);
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=FIIO_Relatorio_Apuracao.csv"
      });
      return res.end("\uFEFF" + csv);
    }

    // 7. Arquivos Estáticos do PWA (public/)
    const publicDir = path.resolve("public");
    const safePath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.join(publicDir, safePath);
    if (filePath.startsWith(publicDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".webmanifest": "application/manifest+json; charset=utf-8",
        ".json": "application/json; charset=utf-8"
      };
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8" });
      return res.end(fs.readFileSync(filePath));
    }

    return sendJson(res, 404, { error: "Rota não encontrada no FIIO." });
  });

  return { server, state, auditLogger };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createFiioServer();
  server.listen(port, () => {
    console.log(`🛡️ Servidor FIIO (API + PWA + Cadeia de Custódia) ativo em http://localhost:${port}`);
  });
}
