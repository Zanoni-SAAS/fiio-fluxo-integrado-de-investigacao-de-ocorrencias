/**
 * Módulo de Autenticação Rápida (PIN/Matrícula) e Controle de Acesso (RBAC) do FIIO
 * Perfis:
 * - AGENTE: Vigilante em campo (registra ocorrências e sincroniza fila offline)
 * - INVESTIGADOR: Equipe de Apuração (triagem, investigação, mudança dos 4 status e emissão de laudo)
 * - ADMIN: Gestor do Contrato (gerencia Contratos, Unidades Multi-Setor, Locais Fixos e Painel Situacional)
 */

export const PERFIS_FIIO = {
  AGENTE: "AGENTE",
  INVESTIGADOR: "INVESTIGADOR",
  ADMIN: "ADMIN"
};

export const USUARIOS_PADRAO = [
  {
    id: "usr-agente-4829",
    nome: "Carlos Eduardo (Vigilante)",
    matricula: "4829",
    pin: "4829",
    perfil: PERFIS_FIIO.AGENTE,
    unidadePadraoId: "uni-sabesp-eta"
  },
  {
    id: "usr-agente-1055",
    nome: "Roberto Almeida (Vigilante Líder)",
    matricula: "1055",
    pin: "1055",
    perfil: PERFIS_FIIO.AGENTE,
    unidadePadraoId: "uni-datacenter"
  },
  {
    id: "usr-inv-9001",
    nome: "Marcos Vinicius (Auditor CFTV / Investigador)",
    matricula: "9001",
    pin: "9001",
    perfil: PERFIS_FIIO.INVESTIGADOR,
    unidadePadraoId: null
  },
  {
    id: "usr-adm-0001",
    nome: "Diretoria de Segurança Corporativa (Admin)",
    matricula: "0001",
    pin: "0001",
    perfil: PERFIS_FIIO.ADMIN,
    unidadePadraoId: null
  }
];

export const PERMISSOES_POR_PERFIL = {
  [PERFIS_FIIO.AGENTE]: [
    "REGISTRAR_OCORRENCIA",
    "SINCRONIZAR_OFFLINE"
  ],
  [PERFIS_FIIO.INVESTIGADOR]: [
    "REGISTRAR_OCORRENCIA",
    "SINCRONIZAR_OFFLINE",
    "VISUALIZAR_APURACAO",
    "ATUALIZAR_STATUS_APURACAO",
    "EMITIR_DOSSIE",
    "VISUALIZAR_PAINEL_SITUACIONAL",
    "EXPORTAR_CSV"
  ],
  [PERFIS_FIIO.ADMIN]: [
    "REGISTRAR_OCORRENCIA",
    "SINCRONIZAR_OFFLINE",
    "VISUALIZAR_APURACAO",
    "ATUALIZAR_STATUS_APURACAO",
    "EMITIR_DOSSIE",
    "VISUALIZAR_PAINEL_SITUACIONAL",
    "EXPORTAR_CSV",
    "GERENCIAR_LOCAIS",
    "GERENCIAR_UNIDADES_CONTRATOS"
  ]
};

/**
 * Autentica um usuário por PIN (4 dígitos)
 */
export function authenticateByPin(pin, usuarios = USUARIOS_PADRAO) {
  const cleanPin = String(pin ?? "").trim();
  const user = usuarios.find(u => u.pin === cleanPin);
  if (!user) {
    return { authenticated: false, error: "PIN inválido ou matrícula não localizada." };
  }
  return {
    authenticated: true,
    usuario: {
      id: user.id,
      nome: user.nome,
      matricula: user.matricula,
      perfil: user.perfil,
      unidadePadraoId: user.unidadePadraoId,
      permissoes: PERMISSOES_POR_PERFIL[user.perfil] || []
    }
  };
}

/**
 * Verifica se um perfil possui determinada permissão de negócio
 */
export function hasPermission(perfil, acao) {
  const lista = PERMISSOES_POR_PERFIL[perfil] || [];
  return lista.includes(acao);
}
