import PocketBase from 'pocketbase';

const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL;
if (!pocketbaseUrl) {
  throw new Error('VITE_POCKETBASE_URL não definida');
}

export const pb = new PocketBase(pocketbaseUrl);

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
