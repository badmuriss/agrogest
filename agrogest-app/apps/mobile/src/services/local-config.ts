import { backendLocation } from './backend-location';
/** Hosted web uses its own origin. Metro/native default to the existing local backend. */
export const BACKEND = backendLocation(process.env.EXPO_PUBLIC_API_URL, typeof window !== 'undefined' ? window.location?.origin : undefined);
export const API_URL = BACKEND.url;
