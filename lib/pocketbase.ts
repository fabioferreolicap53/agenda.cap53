import PocketBase, { RecordService } from 'pocketbase';
import { CollectionResponses } from './pocketbase-types';

// URL fixa para garantir que sempre aponte para o servidor correto
const PB_URL = 'https://centraldedados.dev.br';

console.log('--- POCKETBASE INIT ---');
console.log('Target URL:', PB_URL);
console.log('Lib Version: 2026-02-23 v2 (Clean URL)');

// Instância tipada do PocketBase
export interface TypedPocketBase extends PocketBase {
    collection<K extends keyof CollectionResponses>(idOrName: K): RecordService<CollectionResponses[K]>;
    collection(idOrName: string): RecordService; // Fallback para coleções desconhecidas
}

export const pb = new PocketBase(PB_URL) as TypedPocketBase;

/**
 * Helper para obter a URL completa do avatar do usuário.
 * Retorna uma URL padrão da UI Avatars se não houver avatar definido.
 */
export const getAvatarUrl = (record: any) => {
    if (!record) return '';
    
    // Se já tiver um avatar definido
    if (record.avatar) {
        return pb.files.getUrl(record, record.avatar);
    }
    
    // Fallback para UI Avatars
    const name = record.name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
};

// Desabilitar cancelamento automático para evitar aborts em re-renders rápidos do React
pb.autoCancellation(false);

// Lógica de sincronização de auth em múltiplas abas/janelas
const globalKey = '__pb_realtime_auth_sync__';
const g = globalThis as any;

if (!g[globalKey]) {
    g[globalKey] = true;
    let lastToken = pb.authStore.token;
    
    pb.authStore.onChange(() => {
        const nextToken = pb.authStore.token;
        if (nextToken !== lastToken) {
            lastToken = nextToken;
            try {
                // Tenta desconectar realtime ao mudar token para evitar conflitos
                (pb as any).realtime?.disconnect?.();
            } catch (e) { 
                console.warn('Erro ao desconectar realtime:', e);
            }
        }
    });
}

// Log extra em desenvolvimento
if (import.meta.env.DEV) {
    (window as any).pb = pb;
    console.log('PocketBase instance attached to window.pb for debugging');
}
