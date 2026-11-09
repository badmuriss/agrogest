/** Validações da conta. O login ainda é local; as regras já seguem o que o Supabase Auth vai exigir. */

export const PASSWORD_MIN = 8;

export function emailError(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Informe seu e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Confira o e-mail: falta algo como "@" ou ".com".';
  return null;
}

export function passwordError(password: string): string | null {
  if (!password) return 'Informe a senha.';
  if (password.length < PASSWORD_MIN) return `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`;
  return null;
}

export function nameError(name: string): string | null {
  return name.trim().length < 2 ? 'Informe seu nome.' : null;
}
