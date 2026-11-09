/** Compatibility facade for the existing domain/outbox. No Supabase runtime or remote calls. */
export { backend as supabase, requireBackend as requireSupabase, cloudEnabled, cloudToken, authError } from './backend';
