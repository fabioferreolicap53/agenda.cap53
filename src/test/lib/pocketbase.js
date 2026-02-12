import PocketBase from 'pocketbase';

// O TRAE/Vite vai ler automaticamente do seu arquivo .env
const url = import.meta.env.VITE_POCKETBASE_URL;
export const pb = new PocketBase(url);