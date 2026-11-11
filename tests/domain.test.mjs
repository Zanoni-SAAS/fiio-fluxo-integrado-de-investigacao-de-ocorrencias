import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIAS_NUCLEARES,
  SETORES,
  CLIENTES_CONTRATOS,
  getOptionsForSectorAndCategory,
  getOptionsForUnitAndCategory,
  computeIntegrityHash,
  validateApuracaoUpdate
} from "../src/domain/taxonomy.mjs";
import { OfflineSyncQueue } from "../src/storage/offlineQueue.mjs";

test("1. Matriz possui exatamente 6 categorias nucleares e 22 opções [Nuclear] globais", () => {
  assert.equal(CATEGORIAS_NUCLEARES.length, 6);
  const totalNucleares = CATEGORIAS_NUCLEARES.reduce((acc, c) => acc + c.nucleares.length, 0);
  assert.equal(totalNucleares, 22);
});

test("2. Matriz possui todos os 14 setores e todas as opções nucleares aparecem em cada setor", () => {
  assert.equal(SETORES.length, 14);

  for (const setor of SETORES) {
    let nuclearCountInSector = 0;
    for (const cat of CATEGORIAS_NUCLEARES) {
      const opcoes = getOptionsForSectorAndCategory(setor.id, cat.id);
      const nucleares = opcoes.filter(o => o.origem === "NUCLEAR" && o.isGlobal === true);
      assert.equal(nucleares.length, cat.nucleares.length);
      nuclearCountInSector += nucleares.length;
    }
    assert.equal(nuclearCountInSector, 22, `Setor ${setor.id} deve conter todas as 22 opções nucleares`);
  }
});

test("3. Hierarquia Multi-Contrato / Multi-Unidade: Mesmo cliente (Sabesp) opera com setores distintos por Unidade", () => {
  // Unidade 1 da Sabesp: Sede Corporativa (Setor 2 - Administrativo)
  const sede = getOptionsForUnitAndCategory("uni-sabesp-adm", 1);
  assert.equal(sede.contrato.id, "ctr-sabesp");
  assert.equal(sede.unidade.setorId, 2);
  assert.ok(
    sede.opcoes.some(o => o.titulo.includes("Furto de equipamentos de TI")),
    "Unidade Administrativa da Sabesp deve listar opções específicas do Setor 2"
  );

  // Unidade 2 da Sabesp: ETA Guaraú (Setor 3 - Industrial)
  const eta = getOptionsForUnitAndCategory("uni-sabesp-eta", 5);
  assert.equal(eta.contrato.id, "ctr-sabesp");
  assert.equal(eta.unidade.setorId, 3);
  assert.ok(
    eta.opcoes.some(o => o.titulo.includes("Incidente ambiental, vazamento químico")),
    "Unidade Industrial (ETA) da Sabesp deve listar opções específicas do Setor 3"
  );
  assert.ok(
    eta.opcoes.some(o => o.titulo.includes("extintores") && o.origem === "NUCLEAR"),
    "Unidade Industrial (ETA) da Sabesp deve incluir a opção nuclear de extintores na Categoria 5"
  );
});

test("4. Validação dos 7 Casos de Teste reais da conversa na Matriz", () => {
  const casos = [
    { setorId: 8, categoriaId: 2, esperado: "Violação de perímetro de segurança em zona de detonação (fogo/desmonte) ou barragem" },
    { setorId: 3, categoriaId: 4, esperado: "Ausência ou uso incorreto de EPI/EPC obrigatório" },
    { setorId: 4, categoriaId: 4, esperado: "Instalação ou acesso encontrado vulnerável (porta/janela destrancada)" },
    { setorId: 13, categoriaId: 3, esperado: "Atropelamento ferroviário ou rodoviário (acidental ou tentativa de suicídio na via)" },
    { setorId: 7, categoriaId: 1, esperado: "Dano ao Patrimônio / Vandalismo (Geral)" },
    { setorId: 4, categoriaId: 4, esperado: "Descumprimento de norma interna / Procedimento padrão" },
    { setorId: 3, categoriaId: 5, esperado: "Problemas com equipamentos de segurança ou combate a incêndio (CFTV, controle de acesso, alarme, extintores)" }
  ];

  for (const c of casos) {
    const opcoes = getOptionsForSectorAndCategory(c.setorId, c.categoriaId);
    const match = opcoes.find(o => o.titulo === c.esperado);
    assert.ok(match, `Caso de teste "${c.esperado}" deve existir no Setor ${c.setorId}, Categoria ${c.categoriaId}`);
  }
});

test("5. Regras de Negócio da Apuração: 4 status oficiais e obrigatoriedade de Conclusão ao encerrar", () => {
  assert.equal(validateApuracaoUpdate({ status: "Não Iniciada", conclusaoFinal: null }).valid, true);
  assert.equal(validateApuracaoUpdate({ status: "Em Apuração", conclusaoFinal: null }).valid, true);
  assert.equal(validateApuracaoUpdate({ status: "Interrompida", conclusaoFinal: null }).valid, true);

  // Concluída sem conclusão final deve falhar
  const invalida = validateApuracaoUpdate({ status: "Concluída", conclusaoFinal: null });
  assert.equal(invalida.valid, false);

  // Concluída com conclusão válida deve passar
  const valida = validateApuracaoUpdate({ status: "Concluída", conclusaoFinal: "Infração Confirmada" });
  assert.equal(valida.valid, true);
});

test("6. Fila Offline-First e geração de Hash SHA-256 de 64 caracteres", () => {
  const queue = new OfflineSyncQueue();
  queue.setOnlineStatus(false);

  const resOffline = queue.registerOcorrencia({
    unidadeId: "uni-sabesp-eta",
    setorId: 3,
    localNome: "Estação de Tratamento (ETA/ETE)",
    categoriaId: 5,
    opcaoEspecifica: "Problemas com equipamentos de segurança ou combate a incêndio (CFTV, controle de acesso, alarme, extintores)",
    descricao: "Extintor vencido na ETA",
    dataHoraFato: "2026-11-11T07:00:00Z"
  });

  assert.equal(resOffline.status, "QUEUED_OFFLINE");
  assert.equal(resOffline.registro.criadoOffline, true);
  assert.equal(resOffline.registro.hashIntegridade.length, 64);
  assert.equal(queue.pendingQueue.length, 1);
  assert.equal(queue.syncedDatabase.length, 0);

  // Reconecta e sincroniza automaticamente
  const syncRes = queue.setOnlineStatus(true);
  assert.equal(syncRes.syncedCount, 1);
  assert.equal(queue.pendingQueue.length, 0);
  assert.equal(queue.syncedDatabase.length, 1);
});

test("7. Painel Situacional & Mapa de Calor agrupa locais fixos e calcula taxa de confirmação", async () => {
  const { computeSituationalMetrics, exportOcorrenciasToCSV } = await import("../src/analytics/situationalEngine.mjs");

  const mockOcorrencias = [
    {
      protocolo: "FIIO-2026-1001",
      dataHoraFato: "2026-11-11 08:00",
      setorId: 3,
      setorNome: "3. Setor Industrial",
      localNome: "Estação de Tratamento (ETA/ETE)",
      categoriaId: 5,
      categoriaNuclear: "5. Infraestrutura, Emergências e Tráfego",
      origemOpcao: "NUCLEAR",
      opcaoEspecifica: "Problemas com equipamentos de segurança ou combate a incêndio (CFTV, controle de acesso, alarme, extintores)",
      descricao: "Extintor vencido",
      acoesTomadas: "Sinalizado ao SESMT",
      conclusaoAgente: "Substituição solicitada",
      hashIntegridade: "a".repeat(64),
      apuracao: { status: "Concluída", conclusaoFinal: "Infração Confirmada", analiseTexto: "Troca realizada" }
    },
    {
      protocolo: "FIIO-2026-1002",
      dataHoraFato: "2026-11-11 08:30",
      setorId: 3,
      setorNome: "3. Setor Industrial",
      localNome: "Estação de Tratamento (ETA/ETE)",
      categoriaId: 4,
      categoriaNuclear: "4. Inconformidades Procedimentais e Operacionais",
      origemOpcao: "ESPECIFICO",
      opcaoEspecifica: "Ausência ou uso incorreto de EPI/EPC obrigatório",
      descricao: "Operador sem óculos de proteção",
      acoesTomadas: "Orientação imediata",
      conclusaoAgente: "EPI colocado",
      hashIntegridade: "b".repeat(64),
      apuracao: { status: "Concluída", conclusaoFinal: "Infração Confirmada", analiseTexto: "Confirmado no CFTV" }
    },
    {
      protocolo: "FIIO-2026-1003",
      dataHoraFato: "2026-11-11 09:00",
      setorId: 4,
      setorNome: "4. Setor Tecnológico",
      localNome: "Sala Cofre Principal - Hall A",
      categoriaId: 4,
      categoriaNuclear: "4. Inconformidades Procedimentais e Operacionais",
      origemOpcao: "NUCLEAR",
      opcaoEspecifica: "Descumprimento de norma interna / Procedimento padrão",
      descricao: "Limpeza úmida próxima ao rack",
      acoesTomadas: "Interrompida limpeza",
      conclusaoAgente: "Sem danos",
      hashIntegridade: "c".repeat(64),
      apuracao: { status: "Em Apuração", conclusaoFinal: null, analiseTexto: "Em análise" }
    }
  ];

  const metrics = computeSituationalMetrics(mockOcorrencias);
  assert.equal(metrics.total, 3);
  assert.equal(metrics.porStatus["Concluída"], 2);
  assert.equal(metrics.porStatus["Em Apuração"], 1);
  assert.equal(metrics.taxaConfirmacaoPct, 100);
  assert.equal(metrics.heatmapLocais[0].localNome, "Estação de Tratamento (ETA/ETE)");
  assert.equal(metrics.heatmapLocais[0].total, 2);

  const csv = exportOcorrenciasToCSV(mockOcorrencias);
  assert.ok(csv.includes("Protocolo,Data_Hora_Fato,Setor,Local_Fixo_Admin"));
  assert.ok(csv.includes("FIIO-2026-1001"));
  assert.ok(csv.includes("Infração Confirmada"));
});

test("8. Autenticação por PIN e Controle de Acesso (RBAC) por perfil (AGENTE, INVESTIGADOR, ADMIN)", async () => {
  const { authenticateByPin, hasPermission } = await import("../src/auth/rbac.mjs");

  const authAgente = authenticateByPin("4829");
  assert.equal(authAgente.authenticated, true);
  assert.equal(authAgente.usuario.perfil, "AGENTE");
  assert.equal(hasPermission("AGENTE", "REGISTRAR_OCORRENCIA"), true);
  assert.equal(hasPermission("AGENTE", "ATUALIZAR_STATUS_APURACAO"), false);
  assert.equal(hasPermission("AGENTE", "GERENCIAR_LOCAIS"), false);

  const authInv = authenticateByPin("9001");
  assert.equal(authInv.authenticated, true);
  assert.equal(authInv.usuario.perfil, "INVESTIGADOR");
  assert.equal(hasPermission("INVESTIGADOR", "ATUALIZAR_STATUS_APURACAO"), true);
  assert.equal(hasPermission("INVESTIGADOR", "GERENCIAR_LOCAIS"), false);

  const authInvalido = authenticateByPin("9999");
  assert.equal(authInvalido.authenticated, false);
});

test("9. Servidor REST API FIIO: registro, bloqueio RBAC, validação 422 na apuração e analytics", async () => {
  const { createFiioServer } = await import("../src/server/apiServer.mjs");
  const { server } = createFiioServer();

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Agente registra ocorrência via POST /api/ocorrencias
    const postRes = await fetch(`${baseUrl}/api/ocorrencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Fiio-Role": "AGENTE" },
      body: JSON.stringify({
        unidadeId: "uni-sabesp-eta",
        setorId: 3,
        localNome: "Estação de Tratamento (ETA/ETE)",
        categoriaId: 5,
        opcaoEspecifica: "Problemas com equipamentos de segurança ou combate a incêndio (CFTV, controle de acesso, alarme, extintores)",
        descricao: "Extintor vencido constatado em ronda"
      })
    });
    assert.equal(postRes.status, 201);
    const { ocorrencia } = await postRes.json();
    assert.equal(ocorrencia.hashIntegridade.length, 64);

    // 2. Agente tenta alterar status da apuração -> deve receber 403 Forbidden
    const patchForbidden = await fetch(`${baseUrl}/api/ocorrencias/${ocorrencia.id}/apuracao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Fiio-Role": "AGENTE" },
      body: JSON.stringify({ status: "Em Apuração" })
    });
    assert.equal(patchForbidden.status, 403);

    // 3. Investigador tenta concluir sem Conclusão Final -> deve receber 422 Unprocessable Entity
    const patchInvalid = await fetch(`${baseUrl}/api/ocorrencias/${ocorrencia.id}/apuracao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Fiio-Role": "INVESTIGADOR" },
      body: JSON.stringify({ status: "Concluída", conclusaoFinal: null })
    });
    assert.equal(patchInvalid.status, 422);

    // 4. Investigador conclui com Conclusão Final válida -> 200 OK
    const patchValid = await fetch(`${baseUrl}/api/ocorrencias/${ocorrencia.id}/apuracao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Fiio-Role": "INVESTIGADOR" },
      body: JSON.stringify({
        status: "Concluída",
        conclusaoFinal: "Infração Confirmada",
        analiseTexto: "Troca confirmada junto ao SESMT."
      })
    });
    assert.equal(patchValid.status, 200);

    // 5. Consulta Analytics em tempo real
    const analyticsRes = await fetch(`${baseUrl}/api/analytics`);
    assert.equal(analyticsRes.status, 200);
    const metrics = await analyticsRes.json();
    assert.equal(metrics.total, 1);
    assert.equal(metrics.taxaConfirmacaoPct, 100);

    // 6. Visualiza ocorrência individual (gera READ_OCORRENCIA) e consulta trilha de auditoria
    const getOcrRes = await fetch(`${baseUrl}/api/ocorrencias/${ocorrencia.id}`, {
      headers: {
        "X-Fiio-Role": "INVESTIGADOR",
        "X-Fiio-User-Id": "11111111-2222-3333-4444-555555555555",
        "X-Client-Geo-Lat": "-23.550520",
        "X-Client-Geo-Lng": "-46.633308"
      }
    });
    assert.equal(getOcrRes.status, 200);
    const ocrDetail = await getOcrRes.json();
    assert.equal(ocrDetail.auditEntry.tipo_evento, "READ_OCORRENCIA");
    assert.ok(ocrDetail.auditHistory.length >= 2);
  } finally {
    server.close();
  }
});

test("10. Cadeia de Custódia (createAuditLogger): registro de READ_OCORRENCIA e diff de UPDATE_APURACAO", async () => {
  const { createAuditLogger } = await import("../src/auditMiddleware.mjs");
  const store = [];
  const logger = createAuditLogger(store);

  const mockReq = {
    user: { id: "99999999-8888-7777-6666-555555555555", role: "INVESTIGADOR" },
    headers: {
      "x-client-geo-lat": "-23.550520",
      "x-client-geo-lng": "-46.633308",
      "x-client-geo-accuracy": "12.5",
      "x-forwarded-for": "192.168.1.50",
      "user-agent": "FIIO-Auditor-Client/1.0",
      "sec-ch-ua-platform": "Linux",
      "x-fiio-version": "1.0.0"
    },
    socket: { remoteAddress: "127.0.0.1" }
  };

  const ocorrenciaId = "ocr-audit-test-001";

  // 1. Log de leitura (READ_OCORRENCIA)
  const readLog = logger.logReadOccurrence(ocorrenciaId, mockReq);
  assert.equal(readLog.tipo_evento, "READ_OCORRENCIA");
  assert.equal(readLog.ocorrencia_id, ocorrenciaId);
  assert.equal(readLog.usuario_id, "99999999-8888-7777-6666-555555555555");
  assert.equal(readLog.perfil_usuario, "INVESTIGADOR");
  assert.equal(readLog.geo_latitude, -23.55052);
  assert.equal(readLog.geo_longitude, -46.633308);
  assert.equal(readLog.geo_precisao_metros, 12.5);
  assert.equal(readLog.ip_origem, "192.168.1.50");
  assert.equal(readLog.detalhes_alteracao.visualizacao_completa, true);

  // 2. Log de atualização da apuração com documento formal (UPDATE_APURACAO)
  const oldState = {
    status: "Em Apuração",
    responsavel_id: "usr-inv-9001",
    analise_texto: "Análise preliminar",
    conclusao_final: null,
    apuracao_formal_nome: null,
    apuracao_formal_hash: null
  };

  const newState = {
    status: "Concluída",
    responsavel_id: "usr-inv-9001",
    analise_texto: "Análise concluída com perícia e CFTV.",
    conclusao_final: "Infração Confirmada",
    apuracao_formal_nome: "Laudo_Final_OCR_1001.pdf",
    apuracao_formal_hash: "f".repeat(64)
  };

  const updateLog = logger.logUpdateInvestigation(ocorrenciaId, oldState, newState, mockReq);
  assert.equal(updateLog.tipo_evento, "UPDATE_APURACAO");
  assert.deepEqual(updateLog.detalhes_alteracao.status, { antes: "Em Apuração", depois: "Concluída" });
  assert.deepEqual(updateLog.detalhes_alteracao.conclusao_final, { antes: null, depois: "Infração Confirmada" });
  assert.deepEqual(updateLog.detalhes_alteracao.apuracao_formal_nome, { antes: null, depois: "Laudo_Final_OCR_1001.pdf" });
  assert.deepEqual(updateLog.detalhes_alteracao.apuracao_formal_hash, { antes: null, depois: "f".repeat(64) });
  assert.equal(updateLog.detalhes_alteracao.responsavel_id, undefined, "Campo inalterado não deve entrar no diff");

  const history = logger.getHistoryByOccurrence(ocorrenciaId);
  assert.equal(history.length, 2);
});



