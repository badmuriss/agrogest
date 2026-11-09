/** WhatsApp do atendimento (só dígitos, com DDI e DDD). Vazio: o app não oferece o contato. */
export const SUPPORT_WHATSAPP = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
