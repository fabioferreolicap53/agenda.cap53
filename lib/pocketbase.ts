import PocketBase, { RecordService } from 'pocketbase';
import { CollectionResponses } from './pocketbase-types';

const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL;
if (!pocketbaseUrl) {
  throw new Error('VITE_POCKETBASE_URL não definida');
}

export interface TypedPocketBase extends PocketBase {
    collection<K extends keyof CollectionResponses>(idOrName: K): RecordService<CollectionResponses[K]>;
    collection(idOrName: string): RecordService; // Fallback for unknown collections
}

export const pb = new PocketBase(pocketbaseUrl) as TypedPocketBase;

// Disable auto-cancellation to prevent request aborts when React re-renders quickly
pb.autoCancellation(false);

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
        (pb as any).realtime?.disconnect?.();
      } catch { }
    }
  });
}

if (import.meta.env.DEV) {
  console.log(`PocketBase client initialized for: ${pocketbaseUrl}`);
}

/**
 * Helper to get the full avatar URL for a user
 */
export const getAvatarUrl = (user: any) => {
    if (user?.avatar) {
        if (user.avatar.startsWith('http')) {
            return user.avatar;
        }
        return pb.files.getUrl(user, user.avatar);
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=random&color=fff&size=200`;
};
