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
