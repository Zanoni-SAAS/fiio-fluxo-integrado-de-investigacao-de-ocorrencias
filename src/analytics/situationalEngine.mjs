import { CATEGORIAS_NUCLEARES, SETORES, STATUS_APURACAO_OFICIAIS, CONCLUSOES_FINAIS_OFICIAIS } from "../domain/taxonomy.mjs";

/**
 * Motor de Inteligência Situacional, Mapa de Calor e Exportação de Relatórios do FIIO
 */
export function computeSituationalMetrics(ocorrencias = []) {
  const total = ocorrencias.length;

  // 1. Contagem por Status de Apuração
  const porStatus = {};
  for (const st of STATUS_APURACAO_OFICIAIS) {
    porStatus[st] = 0;
  }

  // 2. Contagem por Conclusão Final (apenas nas Concluídas)
  const porConclusao = {};
  for (const cf of CONCLUSOES_FINAIS_OFICIAIS) {
    porConclusao[cf] = 0;
  }

  // 3. Contagem por Categoria Nuclear (Toque 1) separando Nuclear vs Específico
  const porCategoria = CATEGORIAS_NUCLEARES.map(cat => ({
    categoriaId: cat.id,
    nome: cat.nome,
    icone: cat.icone,
    total: 0,
    nucleares: 0,
    especificos: 0,
    percentual: 0
  }));

  // 4. Agrupamento para Mapa de Calor por Setor + Local Fixo
  const mapaLocais = new Map();

  for (const ocr of ocorrencias) {
    const st = ocr.apuracao?.status || "Não Iniciada";
    if (porStatus[st] !== undefined) porStatus[st]++;

    if (st === "Concluída" && ocr.apuracao?.conclusaoFinal) {
      const cf = ocr.apuracao.conclusaoFinal;
      if (porConclusao[cf] !== undefined) porConclusao[cf]++;
    }

    const catEntry = porCategoria.find(c => c.categoriaId === Number(ocr.categoriaId));
    if (catEntry) {
      catEntry.total++;
      if (ocr.origemOpcao === "NUCLEAR") {
        catEntry.nucleares++;
      } else {
        catEntry.especificos++;
      }
    }

    const chaveLocal = `${ocr.setorId}::${ocr.localNome}`;
    if (!mapaLocais.has(chaveLocal)) {
      const setorObj = SETORES.find(s => s.id === Number(ocr.setorId));
      mapaLocais.set(chaveLocal, {
        setorId: Number(ocr.setorId),
        setorNome: ocr.setorNome || setorObj?.nome || `Setor ${ocr.setorId}`,
        localNome: ocr.localNome,
        total: 0,
        confirmadas: 0,
        emAberto: 0,
        nivelCalor: "BAIXO"
      });
    }
    const locStats = mapaLocais.get(chaveLocal);
    locStats.total++;
    if (ocr.apuracao?.status === "Concluída" && ocr.apuracao?.conclusaoFinal === "Infração Confirmada") {
      locStats.confirmadas++;
    }
    if (ocr.apuracao?.status !== "Concluída") {
      locStats.emAberto++;
    }
  }

  // Calcula percentuais por categoria
  for (const catEntry of porCategoria) {
    catEntry.percentual = total > 0 ? Math.round((catEntry.total / total) * 100) : 0;
  }

  // Classifica intensidade do Mapa de Calor por Local
  const heatmapLocais = Array.from(mapaLocais.values()).sort((a, b) => b.total - a.total || b.confirmadas - a.confirmadas);
  const maxLocalCount = heatmapLocais[0]?.total || 1;

  for (const item of heatmapLocais) {
    const ratio = item.total / maxLocalCount;
    if (item.total >= 3 || (ratio >= 0.75 && item.confirmadas >= 1)) {
      item.nivelCalor = "CRÍTICO";
    } else if (item.total === 2 || ratio >= 0.5) {
      item.nivelCalor = "ALTO";
    } else {
      item.nivelCalor = "MODERADO";
    }
    item.intensidadePct = Math.max(15, Math.round(ratio * 100));
  }

  const concluidas = porStatus["Concluída"] || 0;
  const taxaConfirmacaoPct = concluidas > 0
    ? Math.round((porConclusao["Infração Confirmada"] / concluidas) * 100)
    : 0;

  return {
    total,
    porStatus,
    porConclusao,
    taxaConfirmacaoPct,
    porCategoria,
    heatmapLocais
  };
}

/**
 * Gera conteúdo CSV (UTF-8 com BOM opcional para Excel) das ocorrências e apurações
 */
export function exportOcorrenciasToCSV(ocorrencias = []) {
  const headers = [
    "Protocolo",
    "Data_Hora_Fato",
    "Setor",
    "Local_Fixo_Admin",
    "Categoria_Nuclear_Toque1",
    "Origem_Toque2",
    "Opcao_Tipificada_Toque2",
    "Status_Apuracao",
    "Conclusao_Final_Apuracao",
    "Descricao_Agente",
    "Acoes_Tomadas",
    "Conclusao_Agente",
    "Analise_Investigador",
    "Hash_Integridade_SHA256"
  ];

  const escapeCsv = (val) => {
    const str = String(val ?? "").replace(/\r?\n/g, " ");
    if (str.includes(",") || str.includes("\"") || str.includes(";")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = ocorrencias.map(o => [
    o.protocolo,
    o.dataHoraFato,
    o.setorNome,
    o.localNome,
    o.categoriaNuclear,
    o.origemOpcao,
    o.opcaoEspecifica,
    o.apuracao?.status || "Não Iniciada",
    o.apuracao?.conclusaoFinal || "",
    o.descricao,
    o.acoesTomadas,
    o.conclusaoAgente || "",
    o.apuracao?.analiseTexto || "",
    o.hashIntegridade
  ].map(escapeCsv).join(","));

  return [headers.join(","), ...rows].join("\n");
}
