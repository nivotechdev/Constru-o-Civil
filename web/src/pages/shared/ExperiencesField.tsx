// U34: the worker's experiences — up to 10, one short line each (no pasted CV). Typed or pasted text is cut at the
// limit and line breaks become spaces; empty lines and repeats are dropped when saving (utils/profileText).
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { MAX_EXPERIENCE_LENGTH, MAX_EXPERIENCES } from '../../utils/profileText';

export interface ExperienceDraft {
  key: number;
  text: string;
}

interface ExperiencesFieldProps {
  value: ExperienceDraft[];
  error?: string;
  onChange: (value: ExperienceDraft[]) => void;
}

const EXAMPLES = ['Reboco de fachada em prédio', 'Assentamento de porcelanato', 'Instalação elétrica de casa'];

export function ExperiencesField({ value, error, onChange }: ExperiencesFieldProps) {
  // The line just added (or the empty one already there) gets the cursor. Done here: the fields' own autofocus
  // works only once per page (hooks/useTextField).
  const [focus, setFocus] = useState<{ key: number } | null>(null);
  useEffect(() => {
    if (focus) document.getElementById(`edit-worker-exp-${focus.key}`)?.focus();
  }, [focus]);
  const full = value.length >= MAX_EXPERIENCES;
  const set = (key: number, text: string) =>
    onChange(
      value.map((e) =>
        e.key === key ? { ...e, text: text.replace(/[\r\n]+/g, ' ').slice(0, MAX_EXPERIENCE_LENGTH) } : e
      )
    );
  const add = () => {
    const empty = value.find((e) => !e.text.trim());
    if (empty) return setFocus({ key: empty.key });
    if (full) return;
    const key = value.reduce((max, e) => Math.max(max, e.key), 0) + 1;
    onChange([...value, { key, text: '' }]);
    setFocus({ key });
  };

  return (
    <div role="group" aria-labelledby="edit-worker-exp-title" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span id="edit-worker-exp-title" className="text-sm font-semibold text-concrete-900">
          Suas experiências
        </span>
        <span className="text-xs text-concrete-500 shrink-0">{`${value.length} de ${MAX_EXPERIENCES}`}</span>
      </div>
      <span className="text-sm text-concrete-500 -mt-1.5">
        Uma por linha, em poucas palavras (até 80 letras cada). As construtoras veem no seu perfil.
      </span>
      {value.map((e, i) => (
        <div key={e.key} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <Input
              id={`edit-worker-exp-${e.key}`}
              placeholder={`Ex.: ${EXAMPLES[i % EXAMPLES.length]}`}
              value={e.text}
              maxLength={MAX_EXPERIENCE_LENGTH}
              suffix={
                e.text.length > MAX_EXPERIENCE_LENGTH - 30 ? `${e.text.length}/${MAX_EXPERIENCE_LENGTH}` : undefined
              }
              invalid={Boolean(error) && e.text.trim().length > 0 && e.text.trim().length < 2}
              onInput={(v) => set(e.key, v)}
              onEnter={add}
            />
          </div>
          <div className="pt-1">
            <IconButton
              icon="trash-2"
              label={`Remover a experiência ${i + 1}`}
              onClick={() => onChange(value.filter((x) => x.key !== e.key))}
            />
          </div>
        </div>
      ))}
      {full ? (
        <span className="text-sm text-concrete-500">{`Você chegou ao limite de ${MAX_EXPERIENCES} experiências.`}</span>
      ) : (
        <div>
          <Button label="Adicionar experiência" variant="secondary" size="sm" iconLeft="plus" onClick={add} />
        </div>
      )}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
