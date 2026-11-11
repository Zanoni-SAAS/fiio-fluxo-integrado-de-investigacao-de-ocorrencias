import { computeIntegrityHash } from "../domain/taxonomy.mjs";

/**
 * Gerenciador de Fila Offline-First (compatível com IndexedDB / Dexie.js no navegador
 * e em memória para testes automatizados).
 */
export class OfflineSyncQueue {
  constructor() {
    this.pendingQueue = [];
    this.syncedDatabase = [];
    this.isOnline = true;
  }

  setOnlineStatus(online) {
    this.isOnline = Boolean(online);
    if (this.isOnline && this.pendingQueue.length > 0) {
      return this.syncAll();
    }
    return { syncedCount: 0 };
  }

  registerOcorrencia(payload) {
    const hashIntegridade = computeIntegrityHash(payload);
    const registro = {
      ...payload,
      id: payload.id || `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      criadoOffline: !this.isOnline,
      hashIntegridade,
      apuracao: {
        status: "Não Iniciada",
        conclusaoFinal: null,
        analiseTexto: ""
      }
    };

    if (this.isOnline) {
      this.syncedDatabase.unshift(registro);
      return { status: "SYNCED", registro };
    } else {
      this.pendingQueue.push(registro);
      return { status: "QUEUED_OFFLINE", registro };
    }
  }

  syncAll() {
    let syncedCount = 0;
    while (this.pendingQueue.length > 0) {
      const item = this.pendingQueue.shift();
      this.syncedDatabase.unshift(item);
      syncedCount++;
    }
    return { syncedCount };
  }
}
