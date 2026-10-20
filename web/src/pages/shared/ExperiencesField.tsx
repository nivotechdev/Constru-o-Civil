// U34/U38: the worker's experiences as pills — up to 10, one short line each (no pasted CV). One field adds them
// (Enter or the "+" button); a tap on a pill brings it back to the field to fix it; the "×" on each pill removes it,
// with "Desfazer" in the message, so nothing is lost by a wrong tap. Takes two or three lines of the screen, not ten.
import { useRef, useState } from 'react';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { showToast } from '../../services/toast';
import { cx } from '../../utils/cx';
import {
  cleanExperience,
  MAX_EXPERIENCE_LENGTH,
  MAX_EXPERIENCES,
  MIN_EXPERIENCE_LENGTH
} from '../../utils/profileText';

interface ExperiencesFieldProps {
  value: string[];
  error?: string;
  onChange: (value: string[]) => void;
}

const INPUT_ID = 'edit-worker-exp';

export function ExperiencesField({ value, error, onChange }: ExperiencesFieldProps) {
  const [text, setText] = useState('');
  // The pill being fixed (its position), while its text is in the field.
  const [editing, setEditing] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const full = value.length >= MAX_EXPERIENCES && editing === null;
  const clean = cleanExperience(text);

  /** Adds (or saves the pill being fixed). Leaving the field keeps what was typed too — quietly, if it is valid. */
  function commit(fromBlur = false) {
    if (!clean) {
      setEditing(null);
      return;
    }
    const repeated = value.some(
      (e, i) => i !== editing && e.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR')
    );
    if (fromBlur && (clean.length < MIN_EXPERIENCE_LENGTH || repeated)) return;
    if (clean.length < MIN_EXPERIENCE_LENGTH) return setProblem('Escreva um pouco mais.');
    if (repeated) return setProblem('Essa experiência já está na lista.');
    if (editing !== null) onChange(value.map((e, i) => (i === editing ? clean : e)));
    else if (value.length < MAX_EXPERIENCES) onChange([...value, clean]);
    setText('');
    setEditing(null);
    setProblem(null);
    if (!fromBlur) field.current?.focus();
  }

  function edit(i: number) {
    setEditing(i);
    setText(value[i] ?? '');
    setProblem(null);
    requestAnimationFrame(() => field.current?.focus());
  }

  function remove(i: number) {
    const before = value;
    onChange(value.filter((_, j) => j !== i));
    if (editing === i) {
      setEditing(null);
      setText('');
    }
    showToast('Experiência removida', { action: { label: 'Desfazer', onClick: () => onChange(before) } });
  }

  const counter = text.length > MAX_EXPERIENCE_LENGTH - 25;

  return (
    <div role="group" aria-labelledby={INPUT_ID + '-title'} className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span id={INPUT_ID + '-title'} className="text-sm font-semibold text-concrete-900">
          Suas experiências
        </span>
        <span className="text-xs text-concrete-500 shrink-0" aria-live="polite">
          {`${value.length} de ${MAX_EXPERIENCES}`}
        </span>
      </div>

      {value.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Experiências adicionadas">
          {value.map((e, i) => (
            <li
              key={e}
              className={cx(
                'inline-flex items-center max-w-full min-h-8 rounded-full border text-[0.8125rem] leading-snug font-medium transition-colors duration-150',
                editing === i
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-brand-50 border-brand-100 text-brand-700'
              )}
            >
              <button
                type="button"
                onClick={() => edit(i)}
                aria-label={`Editar: ${e}`}
                className="min-w-0 pl-3 pr-0.5 py-1 text-left break-words rounded-l-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                {e}
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remover: ${e}`}
                className={cx(
                  'shrink-0 inline-flex items-center justify-center w-7 h-7 mr-0.5 rounded-full transition-colors duration-150',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500',
                  editing === i ? 'hover:bg-white/20' : 'hover:bg-brand-100'
                )}
              >
                <Icon name="x" size={14} color="currentColor" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? (
        <span className="text-sm text-concrete-500">
          {`Você chegou a ${MAX_EXPERIENCES} experiências. Remova uma para colocar outra.`}
        </span>
      ) : (
        <div
          className={cx(
            'flex items-center gap-1 min-h-12 pl-3 pr-1.5 bg-concrete-0 rounded-control border transition-colors duration-150',
            problem || error
              ? 'border-danger-500'
              : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
          )}
        >
          <label htmlFor={INPUT_ID} className="sr-only">
            {editing !== null ? 'Corrigir experiência' : 'Nova experiência'}
          </label>
          <input
            ref={field}
            id={INPUT_ID}
            value={text}
            maxLength={MAX_EXPERIENCE_LENGTH}
            enterKeyHint={editing !== null ? 'done' : 'enter'}
            placeholder={value.length ? 'Adicionar outra' : 'Ex.: Reboco de fachada'}
            aria-invalid={problem || error ? 'true' : undefined}
            aria-describedby={INPUT_ID + '-msg'}
            className="flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400"
            onBlur={(e) => {
              // Not when the tap went to the "+" (it adds by itself).
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) commit(true);
            }}
            onChange={(e) => {
              setText(e.target.value.replace(/[\r\n]+/g, ' ').slice(0, MAX_EXPERIENCE_LENGTH));
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape' && editing !== null) {
                setEditing(null);
                setText('');
              }
            }}
          />
          {counter ? (
            <span className="text-xs font-semibold text-concrete-500 shrink-0">{`${text.length}/${MAX_EXPERIENCE_LENGTH}`}</span>
          ) : null}
          <button
            type="button"
            onClick={() => commit()}
            disabled={!clean}
            aria-label={editing !== null ? 'Salvar experiência' : 'Adicionar experiência'}
            className={cx(
              'tap-target shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              clean ? 'bg-brand-500 text-white hover:bg-brand-hover' : 'bg-concrete-100 text-concrete-400'
            )}
          >
            <Icon name={editing !== null ? 'check' : 'plus'} size={18} color="currentColor" />
          </button>
        </div>
      )}

      {problem || error ? (
        <FieldError id={INPUT_ID + '-msg'} message={(problem || error) as string} />
      ) : (
        <span id={INPUT_ID + '-msg'} className="text-sm text-concrete-500">
          {editing !== null
            ? 'Corrija e toque no ✓ (ou Enter).'
            : value.length
              ? 'Toque numa experiência para corrigir, ou no × para tirar.'
              : 'Uma por vez, em poucas palavras. As construtoras veem no seu perfil.'}
        </span>
      )}
    </div>
  );
}
