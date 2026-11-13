import crypto from "node:crypto";

/**
 * 6 Categorias Nucleares Fixas (Toque 1) + 22 Opções Nucleares Globais (is_global = true)
 */
export const CATEGORIAS_NUCLEARES = [
  {
    id: 1,
    nome: "1. Crimes Contra o Patrimônio",
    icone: "🛡️",
    nucleares: [
      "Furto ou Tentativa (Geral)",
      "Roubo ou Tentativa (Geral)",
      "Dano ao Patrimônio / Vandalismo (Geral)"
    ]
  },
  {
    id: 2,
    nome: "2. Controle de Acesso, Intrusão e Evasão",
    icone: "🚧",
    nucleares: [
      "Acesso não autorizado a área restrita",
      "Invasão de perímetro ou propriedade",
      "Tentativa de acesso com falsa identificação / Fraude documental"
    ]
  },
  {
    id: 3,
    nome: "3. Incidentes com Pessoas",
    icone: "🚑",
    nucleares: [
      "Homicídio / Óbito violento ou suspeito",
      "Agressão (Lesão corporal, ameaça ou vias de fato)",
      "Acidente pessoal ou Mal súbito (Necessidade de APH)",
      "Comportamento inadequado / Desordem / Assédio"
    ]
  },
  {
    id: 4,
    nome: "4. Inconformidades Procedimentais e Operacionais",
    icone: "📋",
    nucleares: [
      "Descumprimento de norma interna / Procedimento padrão",
      "Obstrução de saída de emergência ou porta corta-fogo aberta/travada",
      "Instalação ou acesso encontrado vulnerável (porta/janela destrancada)",
      "Extravio, perda ou retenção de objeto pessoal/corporativo (crachá, chaves)"
    ]
  },
  {
    id: 5,
    nome: "5. Infraestrutura, Emergências e Tráfego",
    icone: "🔥",
    nucleares: [
      "Princípio de incêndio / Fumaça / Disparo de alarme",
      "Problemas com equipamentos de segurança ou combate a incêndio (CFTV, controle de acesso, alarme, extintores)",
      "Problemas com estruturas prediais ou utilidades (energia, água, gás)",
      "Acidente ou inconformidade com veículo no pátio/estacionamento"
    ]
  },
  {
    id: 6,
    nome: "6. Segurança Pública e Ilícitos Diversos",
    icone: "⚠️",
    nucleares: [
      "Porte ilegal de arma (branca ou de fogo) ou munição",
      "Uso, porte ou tráfico de substâncias ilícitas",
      "Objeto ou pacote suspeito / abandonado (Ameaça de bomba)",
      "Outros tipos de inconformidade / Ocorrência atípica"
    ]
  }
];

/**
 * 14 Setores Operacionais e suas Opções Específicas por Categoria (is_global = false)
 */
export const SETORES = [
  {
    id: 1,
    nome: "1. Setor Logístico (Transportadoras e Centros de Distribuição)",
    especificos: {
      1: [
        "Furto ou violação de carga/mercadoria em doca ou armazém",
        "Roubo ou tentativa de tomada de veículo/carga na chegada ou saída"
      ],
      2: [
        "Evasão de balança rodoviária ou portaria sem liberação",
        "Motorista ou ajudante circulando fora da área de espera"
      ],
      3: [],
      4: [
        "Armazenamento inadequado de mercadoria",
        "Caminhão aberto fora da doca",
        "Manuseio inadequado de carga ou equipamento",
        "Mercadoria exposta ou fora de área demarcada",
        "Mercadoria violada ou com rompimento injustificado de lacre",
        "Objeto pessoal retido na revista",
        "Pacote encontrado fora de fluxo / sem identificação",
        "Divergência de Nota Fiscal, manifesto ou conferência de carga"
      ],
      5: [
        "Problemas com equipamentos operacionais (empilhadeiras, niveladoras de doca)",
        "Tombamento de carga ou colisão interna no armazém"
      ],
      6: []
    }
  },
  {
    id: 2,
    nome: "2. Setor Administrativo (Escritórios e Sedes Corporativas)",
    especificos: {
      1: [
        "Furto de equipamentos de TI (notebooks, periféricos, celulares corporativos)"
      ],
      2: [
        "Visitante ou prestador circulando sem escolta/acompanhamento",
        "Permanência no prédio fora do horário de expediente sem autorização"
      ],
      3: [],
      4: [
        "Quebra de protocolo de Segurança da Informação (mesa limpa, tela desbloqueada, documento exposto)",
        "Irregularidade no recebimento de malotes ou correspondências"
      ],
      5: [
        "Retenção de pessoas em elevador / Falha de transporte vertical"
      ],
      6: []
    }
  },
  {
    id: 3,
    nome: "3. Setor Industrial (Fábricas, Usinas e Estações de Tratamento)",
    especificos: {
      1: [
        "Furto de cabos de cobre, matéria-prima, insumos ou ferramental",
        "Sabotagem ou adulteração deliberada de linha de produção/tratamento"
      ],
      2: [
        "Acesso não autorizado a subestação, caldeira ou área classificada de risco"
      ],
      3: [
        "Acidente de trabalho severo com maquinário ou linha industrial"
      ],
      4: [
        "Ausência ou uso incorreto de EPI/EPC obrigatório",
        "Violação de protocolo de segurança de máquinas (burla de sensor, falta de bloqueio LOTO)",
        "Inconformidade na pesagem, lacre ou fluxo de insumos na portaria industrial"
      ],
      5: [
        "Incidente ambiental, vazamento químico, derramamento de efluentes ou emissão de gases"
      ],
      6: []
    }
  },
  {
    id: 4,
    nome: "4. Setor Tecnológico (Data Centers e Hubs de TI)",
    especificos: {
      1: [
        "Furto de componentes físicos de servidores (HDDs, memórias, placas, cabos)",
        "Dano físico ou corte intencional de fibra óptica / cabeamento estruturado"
      ],
      2: [
        "Acesso não autorizado à Sala Cofre ou gaiola de clientes (Colocation)",
        "Quebra de protocolo de eclusa / Entrada carona (Tailgating / Piggybacking)"
      ],
      3: [],
      4: [
        "Violação de rack (abertura sem ordem de serviço) ou conexão de mídia física não autorizada",
        "Registro fotográfico ou filmagem não autorizada no interior das áreas técnicas"
      ],
      5: [
        "Alerta crítico de climatização (HVAC/Chillers), elevação de temperatura ou umidade na Sala Cofre",
        "Falha em sistema de energia ininterrupta (UPS/No-break, banco de baterias ou geradores)",
        "Disparo acidental ou real de sistema de supressão por gás inerte"
      ],
      6: []
    }
  },
  {
    id: 5,
    nome: "5. Setor Varejista (Lojas, Atacarejos e Supermercados)",
    especificos: {
      1: [
        "Furto externo por cliente no salão de vendas (Shoplifting)",
        "Furto interno ou desvio por colaborador/terceirizado/promotor",
        "Roubo a frente de caixa (PDV), cofre ou tesouraria",
        "Arrombamento noturno de loja ou quebra de vitrine"
      ],
      2: [
        "Evasão de Frente de Caixa (PDV) sem pagamento",
        "Acesso não autorizado ao estoque de alto valor (eletrônicos, bebidas, perfumaria)"
      ],
      3: [],
      4: [
        "Consumo indevido de produtos no interior da loja sem pagamento",
        "Violação de embalagens, troca de etiquetas de preço ou ocultação de produtos nas gôndolas",
        "Violação ou remoção de etiqueta rígida/adesiva antifurto (EAS)",
        "Irregularidade na doca de recebimento (divergência de nota, caminhão aberto, paletes abandonados)"
      ],
      5: [
        "Falha em antenas antifurto (EAS) ou câmeras de frente de caixa",
        "Falha em balcões refrigerados ou câmaras frias (risco de perda de perecíveis)"
      ],
      6: [
        "Recebimento de cédula falsa ou fraude em meio de pagamento/PIX"
      ]
    }
  },
  {
    id: 6,
    nome: "6. Setor Recreativo (Clubes, Parques, Arenas e Estádios)",
    especificos: {
      1: [
        "Furto em guarda-volumes, vestiários ou armários de sócios/frequentadores",
        "Depredação de arquibancadas, assentos, banheiros ou instalações esportivas"
      ],
      2: [
        "Invasão de campo/gramado, palco, camarim ou piscina interditada",
        "Evasão de bilheteria / Pulo de catraca / Uso de ingresso falso"
      ],
      3: [
        "Briga generalizada / Confronto entre torcidas ou grupos",
        "Criança, idoso ou pessoa vulnerável perdida/desencontrada",
        "Embriaguez severa / Coma alcoólico",
        "Afogamento ou incidente aquático em parque/clube"
      ],
      4: [
        "Descumprimento de regras de segurança em atrações, brinquedos ou piscinas"
      ],
      5: [
        "Parada técnica ou falha mecânica em brinquedo/atração com público"
      ],
      6: [
        "Retenção de item proibido na revista (garrafas de vidro, rojões, sinalizadores, laser)",
        "Cambismo ou venda ilegal de ingressos no perímetro"
      ]
    }
  },
  {
    id: 7,
    nome: "7. Setor Agropecuarista (Fazendas, Usinas Agrícolas e Silos)",
    especificos: {
      1: [
        "Furto ou roubo de defensivos agrícolas, sementes ou fertilizantes",
        "Furto ou abate clandestino de animais / gado (Abigeato)",
        "Furto de maquinário agrícola, tratores, módulos GPS ou combustível",
        "Desvio de grãos/safra durante a colheita ou armazenamento em silos"
      ],
      2: [
        "Ocupação ou invasão coletiva de terras / Esbulho possessório",
        "Trânsito de veículos ou pessoas desconhecidas em estradas internas da propriedade"
      ],
      3: [
        "Acidente com animal peçonhento ou ataque de animal de grande porte",
        "Engolfamento em silo de grãos ou acidente grave com implemento agrícola"
      ],
      4: [
        "Cerca cortada, mourão danificado ou porteira deixada aberta",
        "Fuga ou extravio de rebanho para áreas externas ou rodovias"
      ],
      5: [
        "Incêndio florestal, queimada em pastagem ou lavoura"
      ],
      6: [
        "Caça, pesca predatória ou desmatamento ilegal dentro da propriedade"
      ]
    }
  },
  {
    id: 8,
    nome: "8. Setor Extrativista (Mineração, Siderurgia de Base e Florestal)",
    especificos: {
      1: [
        "Furto ou desvio de minério concentrado, cargas de madeira ou explosivos",
        "Furto de componentes de maquinário pesado (baterias, pneus gigantes, cabos)"
      ],
      2: [
        "Invasão para garimpo ilegal ou extração clandestina de madeira na concessão",
        "Violação de perímetro de segurança em zona de detonação (fogo/desmonte) ou barragem"
      ],
      3: [
        "Soterramento, queda de rocha ou acidente em cava/subsolo"
      ],
      4: [
        "Irregularidade na escolta, armazenamento ou manuseio de explosivos (paiol)",
        "Caminhão fora de estrada ou veículo leve trafegando sem bandeirola/escolta na mina"
      ],
      5: [
        "Anomalia geotécnica, deslizamento de talude ou acionamento de sirene de barragem",
        "Bloqueio de via de escoamento ou ferrovia interna por manifestantes/comunidade"
      ],
      6: []
    }
  },
  {
    id: 9,
    nome: "9. Setor Hospitalar (Hospitais, Clínicas e Laboratórios)",
    especificos: {
      1: [
        "Furto ou desvio de medicamentos controlados (psicotrópicos/opioides) ou insumos",
        "Furto de equipamentos médicos (monitores, oxímetros, bombas de infusão)",
        "Furto de pertences de pacientes internados ou acompanhantes"
      ],
      2: [
        "Acesso não autorizado a UTI, Centro Cirúrgico, Farmácia Central ou Necrotério",
        "Tentativa de acesso não autorizado ou rapto em Maternidade / Berçário",
        "Evasão de paciente sem alta médica (fuga hospitalar ou psiquiátrica)"
      ],
      3: [
        "Agressão ou hostilidade de pacientes/familiares contra equipe médica ou recepção",
        "Surto psicótico, agitação severa ou tentativa de suicídio de paciente"
      ],
      4: [
        "Descarte irregular de lixo hospitalar, risco biológico ou material perfurocortante",
        "Troca ou ausência de pulseira de identificação de paciente/acompanhante"
      ],
      5: [
        "Falha crítica no suprimento de gases medicinais (oxigênio/vácuo) ou geradores de emergência",
        "Obstrução de rampa de ambulâncias / Pronto-Socorro"
      ],
      6: [
        "Exercício ilegal da medicina (falso médico/enfermeiro) ou escolta policial de paciente custodiado"
      ]
    }
  },
  {
    id: 10,
    nome: "10. Setor Educacional (Escolas, Universidades e Campus)",
    especificos: {
      1: [
        "Furto de equipamentos de laboratório, projetores, computadores ou acervo de biblioteca",
        "Depredação ou pichação de carteiras, salas de aula e banheiros"
      ],
      2: [
        "Entrada de pessoa estranha à comunidade acadêmica (não aluno/não autorizado)",
        "Evasão escolar de menor de idade sem autorização dos responsáveis"
      ],
      3: [
        "Briga entre estudantes, bullying severo ou trote violento",
        "Ameaça de ataque ativo / Massacre escolar (redes sociais ou pichações)",
        "Conflito com pais ou responsáveis exaltados na portaria/secretaria"
      ],
      4: [
        "Permanência de alunos em salas ou blocos isolados após o encerramento das aulas"
      ],
      5: [
        "Acidente em laboratório químico/físico ou quadra poliesportiva"
      ],
      6: [
        "Uso ou comercialização de cigarros eletrônicos (vapes) ou álcool por menores"
      ]
    }
  },
  {
    id: 11,
    nome: "11. Setor Multicomercial (Shopping Centers, Galerias e Centros Empresariais)",
    especificos: {
      1: [
        "Furto de veículo, módulo, estepe ou pertences no interior de veículo no estacionamento",
        "Furto de celular/carteira de clientes na praça de alimentação ou corredores",
        "Furto ou arrombamento de loja/quiosque (fechamento ou madrugada)",
        "Roubo a joalheria, casa de câmbio, loja de eletrônicos ou carro-forte"
      ],
      2: [
        "Evasão de cancela de estacionamento sem pagamento ou fraude de ticket",
        "Acesso não autorizado a corredores técnicos, telhado ou casa de máquinas",
        "Fornecedor ou prestador realizando carga/descarga fora do horário permitido"
      ],
      3: [
        "Criança, idoso ou pessoa vulnerável perdida no mall",
        "Tumulto, arrastão, manifestação ou aglomeração atípica (\"rolezinho\")"
      ],
      4: [
        "Abandono de paletes, caixas ou resíduos por lojistas nas docas/corredores técnicos",
        "Loja operando fora do horário padrão ou realizando obra sem autorização (RRI)",
        "Descarte irregular de óleo ou lixo orgânico fora das normas da administração"
      ],
      5: [
        "Acidente ou falha em escada rolante, esteira ou elevador panorâmico",
        "Vazamento de gás/fumaça em coifa de restaurante na praça de alimentação",
        "Veículo abandonado no estacionamento (múltiplos pernoites)"
      ],
      6: [
        "Comércio ambulante, mendicância ou panfletagem não autorizada no mall"
      ]
    }
  },
  {
    id: 12,
    nome: "12. Setor Aeroportuário (Aeroportos, Terminais de Carga Aérea e Heliportos)",
    especificos: {
      1: [
        "Violação ou furto de bagagem despachada (rampa/triagem) ou de mão",
        "Furto ou roubo no Terminal de Cargas (TECA)",
        "Dano intencional a aeronave, auxílio de navegação ou equipamento de solo (GSE)"
      ],
      2: [
        "Intrusão em Área Restrita de Segurança (ARS), Pátio de Manobras ou Pista de Pouso",
        "Passageiro circulando desacompanhado no pátio de aeronaves",
        "Evasão de inspeção de segurança (canal de Raio-X / pórtico detector de metais)"
      ],
      3: [
        "Passageiro indisciplinado (Unruly passenger) em solo ou desembarque compulsório de aeronave",
        "Tumulto generalizado em portão de embarque ou balcão de check-in (atrasos/cancelamentos)"
      ],
      4: [
        "Não ostentação ou uso irregular de Credencial Aeroportuária (ATIV/Credencial de Pátio)",
        "Objeto deixado na pista/pátio com risco de ingestão por turbinas (FOD - Foreign Object Debris)"
      ],
      5: [
        "Presença de animais ou aves na pista de pouso (Risco de Fauna / Bird Strike)",
        "Acidente ou abalroamento envolvendo veículos de apoio em solo (Pushback, catering, abastecimento)",
        "Derramamento de combustível de aviação (QAV) no pátio"
      ],
      6: [
        "Retenção de item proibido no canal de inspeção (Raio-X) ou embarque clandestino de arma",
        "Apontamento de raio laser ou drone clandestino no cone de aproximação de aeronaves"
      ]
    }
  },
  {
    id: 13,
    nome: "13. Setor Rodoferroviário (Rodovias, Ferrovias, Metrôs e Terminais)",
    especificos: {
      1: [
        "Furto de cabos de cobre, sinalização, baterias ou fibra óptica ao longo da via",
        "Furto de trilhos, dormentes, talas de junção ou grampos de fixação",
        "Saque de carga (após parada forçada, acidente ou abertura intencional de bica de vagão)",
        "Furto/Roubo a passageiros no interior de vagões, ônibus ou plataformas",
        "Apedrejamento, pichação (graffiti) ou depredação de trens, praças de pedágio e estações"
      ],
      2: [
        "Evasão de tarifa (pulo de catraca, passagem por baixo/carona) em estação",
        "Evasão de praça de pedágio ou balança de pesagem rodoviária",
        "Invasão de faixa de domínio ou caminhada sobre a via permanente/túnel"
      ],
      3: [
        "Atropelamento ferroviário ou rodoviário (acidental ou tentativa de suicídio na via)",
        "Importunação ou assédio sexual no interior de composição/estação",
        "Queda de usuário no vão entre o trem e a plataforma"
      ],
      4: [
        "Passatismo (\"surf\" ferroviário ou carona clandestina entre vagões de carga/passageiros)",
        "Acionamento indevido de botão de emergência ou freio de composição sem emergência real"
      ],
      5: [
        "Descarrilamento, abalroamento em passagem em nível (PN) ou colisão grave em rodovia",
        "Obstrução intencional de via (barricadas, queima de pneus, protestos ou pedras nos trilhos)",
        "Queda de barreira/deslizamento ou presença de animais de grande porte soltos na via",
        "Acidente envolvendo transporte de produtos perigosos (HAZMAT)"
      ],
      6: [
        "Comércio irregular ambulante no interior de trens e estações (Marreteiros)"
      ]
    }
  },
  {
    id: 14,
    nome: "14. Setor Residencial (Condomínios Horizontais e Verticais)",
    especificos: {
      1: [
        "Furto ou invasão no interior de unidade autônoma (casa ou apartamento)",
        "Furto de bicicletas, encomendas (delivery) ou objetos em vagas de garagem"
      ],
      2: [
        "Entregador de aplicativo ou prestador circulando nos blocos/ruas sem liberação da portaria",
        "Entrada carona pelo portão de veículos ou clausura de pedestres sem identificação"
      ],
      3: [
        "Ocorrência de violência doméstica ou familiar na unidade",
        "Desinteligência severa ou vias de fato entre condôminos ou contra funcionários da portaria"
      ],
      4: [
        "Realização de obras, mudanças ou serviços fora do horário permitido no Regimento Interno",
        "Ocupação indevida de vaga de garagem alheia ou área de manobra",
        "Descarte irregular de lixo ou entulho nas áreas comuns/escadarias"
      ],
      5: [
        "Excesso de velocidade ou direção perigosa nas vias internas do condomínio"
      ],
      6: [
        "Perturbação do sossego (festas, som alto ou barulho excessivo após horário limite)",
        "Incidente com animais domésticos (soltos sem guia em área comum, ataque ou ruído contínuo)"
      ]
    }
  }
];

/**
 * Hierarquia Multi-Contrato -> Multi-Unidade (onde cada Unidade possui seu próprio setorId e seus Locais)
 */
export const CLIENTES_CONTRATOS = [
  {
    id: "ctr-sabesp",
    nomeCliente: "Sabesp - Saneamento Básico",
    codigoContrato: "CT-2026-001",
    unidades: [
      {
        id: "uni-sabesp-adm",
        nome: "Sede Corporativa Pinheiros (Escritório)",
        setorId: 2, // Setor Administrativo
        locais: ["Recepção Central / Catracas", "5º Andar - Presidência & TI", "Subsolo G1 - Frota Leve", "Sala de Malotes"]
      },
      {
        id: "uni-sabesp-eta",
        nome: "ETA Guaraú - Estação de Tratamento",
        setorId: 3, // Setor Industrial
        locais: ["Estação de Tratamento (ETA/ETE)", "Corredor de Bombas #02", "Subestação de Energia", "Portaria de Insumos Químicos"]
      }
    ]
  },
  {
    id: "ctr-techmedia",
    nomeCliente: "Grupo Tech & Broadcast S.A.",
    codigoContrato: "CT-2026-002",
    unidades: [
      {
        id: "uni-datacenter",
        nome: "Data Center Tier III - Barueri",
        setorId: 4, // Setor Tecnológico
        locais: ["Sala Cofre Principal - Hall A", "Gaiola de Colocation 04", "Eclusa Biométrica", "Sala de UPS / Geradores"]
      },
      {
        id: "uni-estudiotv",
        nome: "Complexo de Estúdios Rede TV",
        setorId: 4, // Setor Tecnológico
        locais: ["Almoxarifado de Equipamentos Ópticos", "Estúdio Principal A", "Ilha de Edição & Master", "Portaria de Elenco"]
      }
    ]
  },
  {
    id: "ctr-holding-agro-min",
    nomeCliente: "Holding Brasil Recursos (Agro & Mineração)",
    codigoContrato: "CT-2026-003",
    unidades: [
      {
        id: "uni-pedreira",
        nome: "Pedreira & Mineração Serra Sul",
        setorId: 8, // Setor Extrativista
        locais: ["Perímetro da Mata / Cava da Pedreira", "Zona de Detonação (Desmonte)", "Paiol de Explosivos", "Balança de Minério"]
      },
      {
        id: "uni-fazenda-leite",
        nome: "Fazenda Leiteira Boa Vista",
        setorId: 7, // Setor Agropecuarista
        locais: ["Curral / Galpão de Ordenha Leiteira", "Silo de Grãos Principal", "Galpão de Defensivos", "Porteira Leste"]
      }
    ]
  },
  {
    id: "ctr-biopharma",
    nomeCliente: "BioPharma Laboratórios Industriais",
    codigoContrato: "CT-2026-004",
    unidades: [
      {
        id: "uni-biopharma-fab",
        nome: "Planta Farmacêutica Campinas",
        setorId: 3, // Setor Industrial
        locais: ["Linha de Produção Asséptica 01", "Vestiário de Paramentação (Sala Limpa)", "Almoxarifado de Insumos Controlados", "Doca Quarentena"]
      },
      {
        id: "uni-biopharma-cd",
        nome: "Centro de Distribuição Logístico Cajamar",
        setorId: 1, // Setor Logístico
        locais: ["Doca 02 - Carga Refrigerada", "Balança Rodoviária", "Pátio de Espera de Motoristas", "Gaiola de Alto Valor"]
      }
    ]
  },
  {
    id: "ctr-viatrilhos",
    nomeCliente: "Concessionária ViaTrilhos & Mobilidade",
    codigoContrato: "CT-2026-005",
    unidades: [
      {
        id: "uni-viatrilhos-metro",
        nome: "Linha 1 - Operação Metroferroviária",
        setorId: 13, // Setor Rodoferroviário
        locais: ["Plataforma Central - Linha 1", "Linha de Catracas / Bilheteria", "Passagem em Nível (PN) Km 42", "Pátio de Manobras"]
      }
    ]
  }
];

export const STATUS_APURACAO_OFICIAIS = [
  "Não Iniciada",
  "Em Apuração",
  "Interrompida",
  "Concluída"
];

export const CONCLUSOES_FINAIS_OFICIAIS = [
  "Infração Confirmada",
  "Infração não Confirmada",
  "Sem Conclusão"
];

/**
 * Retorna todas as opções clicáveis (Toque 2) para um dado setorId e categoriaId,
 * unindo o Bloco Nuclear Fixo (is_global = true) às opções Específicas do setor.
 */
export function getOptionsForSectorAndCategory(setorId, categoriaId) {
  const categoria = CATEGORIAS_NUCLEARES.find(c => c.id === Number(categoriaId));
  const setor = SETORES.find(s => s.id === Number(setorId));
  if (!categoria || !setor) {
    throw new Error(`Setor (${setorId}) ou Categoria (${categoriaId}) inválidos.`);
  }

  const nucleares = categoria.nucleares.map(titulo => ({
    titulo,
    origem: "NUCLEAR",
    isGlobal: true,
    setorId: null
  }));

  const especificos = (setor.especificos[categoria.id] || []).map(titulo => ({
    titulo,
    origem: "ESPECIFICO",
    isGlobal: false,
    setorId: setor.id
  }));

  return [...nucleares, ...especificos];
}

/**
 * Resolve uma Unidade Operacional pelo ID e retorna suas opções de Toque 2 (filtradas pelo setorId da Unidade)
 */
export function getOptionsForUnitAndCategory(unidadeId, categoriaId, contratos = CLIENTES_CONTRATOS) {
  for (const contrato of contratos) {
    const unidade = contrato.unidades.find(u => u.id === unidadeId);
    if (unidade) {
      return {
        contrato,
        unidade,
        setor: SETORES.find(s => s.id === unidade.setorId),
        opcoes: getOptionsForSectorAndCategory(unidade.setorId, categoriaId)
      };
    }
  }
  throw new Error(`Unidade Operacional não encontrada: ${unidadeId}`);
}

/**
 * Gera o Hash SHA-256 real de integridade da ocorrência
 */
export function computeIntegrityHash(ocorrenciaPayload) {
  const canonical = JSON.stringify({
    unidadeId: ocorrenciaPayload.unidadeId,
    setorId: ocorrenciaPayload.setorId,
    localNome: ocorrenciaPayload.localNome,
    categoriaId: ocorrenciaPayload.categoriaId,
    opcaoEspecifica: ocorrenciaPayload.opcaoEspecifica,
    descricao: ocorrenciaPayload.descricao,
    acoesTomadas: ocorrenciaPayload.acoesTomadas ?? ocorrenciaPayload.acoes_tomadas ?? "",
    conclusaoAgente: ocorrenciaPayload.conclusaoAgente ?? ocorrenciaPayload.conclusao_agente ?? "",
    dataHoraFato: ocorrenciaPayload.dataHoraFato
  });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Trava de Imutabilidade do Relato Original do Agente (espelha `fn_lock_initial_occurrence_report` da Migração 003).
 * Garante que os 3 campos de texto livre do vigilante (`descricao`, `acoes_tomadas`, `conclusao_agente`),
 * além de `hash_integridade`, `agente_id` e `data_hora_fato`, sejam estritamente imutáveis após o registro.
 */
export function validateInitialReportImmutability(original, proposedUpdate = {}) {
  const pairs = [
    ["descricao", original.descricao, proposedUpdate.descricao],
    [
      "acoes_tomadas",
      original.acoes_tomadas ?? original.acoesTomadas,
      proposedUpdate.acoes_tomadas !== undefined ? proposedUpdate.acoes_tomadas : proposedUpdate.acoesTomadas
    ],
    [
      "conclusao_agente",
      original.conclusao_agente ?? original.conclusaoAgente,
      proposedUpdate.conclusao_agente !== undefined ? proposedUpdate.conclusao_agente : proposedUpdate.conclusaoAgente
    ],
    [
      "hash_integridade",
      original.hash_integridade ?? original.hashIntegridade,
      proposedUpdate.hash_integridade !== undefined ? proposedUpdate.hash_integridade : proposedUpdate.hashIntegridade
    ],
    [
      "agente_id",
      original.agente_id ?? original.agenteId,
      proposedUpdate.agente_id !== undefined ? proposedUpdate.agente_id : proposedUpdate.agenteId
    ],
    [
      "data_hora_fato",
      original.data_hora_fato ?? original.dataHoraFato,
      proposedUpdate.data_hora_fato !== undefined ? proposedUpdate.data_hora_fato : proposedUpdate.dataHoraFato
    ]
  ];

  for (const [campo, valorOriginal, valorNovo] of pairs) {
    if (valorNovo !== undefined && valorNovo !== valorOriginal) {
      return {
        valid: false,
        violatedField: campo,
        error:
          "CADEIA DE CUSTÓDIA FIIO: O relato inicial do agente (descricao, acoes_tomadas, conclusao_agente) e seu hash criptográfico são imutáveis após o registro."
      };
    }
  }

  return { valid: true };
}

/**
 * Valida a regra de negócio da equipe de Apuração:
 * - O status deve ser um dos 4 oficiais ('Não Iniciada', 'Em Apuração', 'Interrompida', 'Concluída')
 * - Quando 'Concluída', o preenchimento de 'conclusaoFinal' é obrigatório.
 */
export function validateApuracaoUpdate({ status, conclusaoFinal }) {
  if (!STATUS_APURACAO_OFICIAIS.includes(status)) {
    return { valid: false, error: `Status inválido: ${status}` };
  }
  if (status === "Concluída") {
    if (!conclusaoFinal || !CONCLUSOES_FINAIS_OFICIAIS.includes(conclusaoFinal)) {
      return {
        valid: false,
        error: "Para encerrar a apuração como 'Concluída', é obrigatório informar a Conclusão de Apuração válida."
      };
    }
  }
  return { valid: true };
}

