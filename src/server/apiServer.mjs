import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  CATEGORIAS_NUCLEARES,
  SETORES,
  CLIENTES_CONTRATOS,
  getOptionsForUnitAndCategory,
  computeIntegrityHash,
  validateApuracaoUpdate
} from "../domain/taxonomy.mjs";
import { computeSituationalMetrics, exportOcorrenciasToCSV } from "../analytics/situationalEngine.mjs";
import { authenticateByPin, hasPermission } from "../auth/rbac.mjs";

/**
 * Cria uma instância do servidor HTTP/REST do FIIO (Fluxo Integrado de Investigação de Ocorrências)
 */
export function createFiioServer() {
  const state = {
    contratos: structuredClone(CLIENTES_CONTRATOS),
    ocorrencias: []
  };

  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Fiio-Role"
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
          conclusaoFinal: null,
          analiseTexto: ""
        }
      };
      state.ocorrencias.unshift(nova);
      return sendJson(res, 201, { ocorrencia: nova });
    }

    // 4. Atualização de Status e Parecer da Apuração (Exige perfil INVESTIGADOR ou ADMIN)
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
      const check = validateApuracaoUpdate({
        status: body.status,
        conclusaoFinal: body.conclusaoFinal
      });
      if (!check.valid) {
        return sendJson(res, 422, { error: check.error });
      }

      ocr.apuracao.status = body.status;
      ocr.apuracao.analiseTexto = body.analiseTexto ?? ocr.apuracao.analiseTexto;
      ocr.apuracao.conclusaoFinal = body.status === "Concluída" ? body.conclusaoFinal : (body.conclusaoFinal || null);
      return sendJson(res, 200, { ocorrencia: ocr });
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

  return { server, state };
}

// Se executado diretamente via CLI (`node src/server/apiServer.mjs`), inicia na porta 3000 (ou PORT)
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createFiioServer();
  server.listen(port, () => {
    console.log(`🛡️ Servidor FIIO (API + PWA) ativo em http://localhost:${port}`);
  });
}
