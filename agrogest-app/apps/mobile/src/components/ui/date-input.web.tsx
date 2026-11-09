import { useId, useState } from 'react';

import { parseISODate } from '@/domain/dates';
import { radius, space, useIsDark, usePalette } from '@/theme';

import type { DateInputProps } from './date-input.types';

/** O navegador fornece um calendário acessível sem importar o módulo nativo. */
export function DateInput({ label, value, onChange }: DateInputProps) {
  const p = usePalette();
  const isDark = useIsDark();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !parseISODate(draft);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      <input
        id={id}
        type="date"
        lang="pt-BR"
        required
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        value={draft ?? value}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          setFocused(false);
          // Permite editar os segmentos, mas restaura a seleção se a edição ficar incompleta.
          event.currentTarget.value = value;
          setDraft(null);
        }}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          if (parseISODate(next)) onChange(next);
        }}
        style={{
          display: 'block',
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          minHeight: 54,
          borderRadius: radius.md,
          border: `1.5px solid ${invalid ? p.danger : focused ? p.accent : 'transparent'}`,
          outline: 'none',
          backgroundColor: p.fill,
          color: p.text,
          colorScheme: isDark ? 'dark' : 'light',
          fontFamily: 'inherit',
          fontSize: 16,
          padding: `${space.md}px ${space.md + 2}px`,
          cursor: 'pointer',
        }}
      />
      {invalid ? (
        <span id={`${id}-error`} role="alert" style={{ color: p.danger, fontSize: 14 }}>
          Escolha uma data válida. Ao sair, a data anterior será mantida.
        </span>
      ) : null}
    </div>
  );
}
