// Y23: the one way to choose specialties, in "Completar perfil" and in "Editar perfil": the catalog's
// suggestions to tap, plus free text; any of them can be removed.
import { useState } from 'react';
import { Button } from './Button';
import { FieldError } from './FieldError';
import { Input } from './Input';
import { Tag } from './Tag';
import { ESPECIALIDADES } from '../services/catalog';
import { addSpecialty, MAX_SPECIALTIES, sameSpecialty } from '../utils/specialties';

interface SpecialtiesFieldProps {
  id: string;
  value: string[];
  onChange: (list: string[]) => void;
  error?: string | null;
}

export function SpecialtiesField({ id, value, onChange, error }: SpecialtiesFieldProps) {
  const [typed, setTyped] = useState('');
  const full = value.length >= MAX_SPECIALTIES;
  const add = (text: string) => {
    onChange(addSpecialty(value, text));
    setTyped('');
  };
  const suggestions = ESPECIALIDADES.filter((s) => !value.some((v) => sameSpecialty(v, s)));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Input
            id={id}
            label="Especialidades"
            placeholder="Ex.: Reboco, pintura, elétrica"
            icon="hammer"
            value={typed}
            invalid={Boolean(error)}
            onInput={setTyped}
            onEnter={() => add(typed)}
          />
        </div>
        <div className="shrink-0">
          <Button label="Adicionar" variant="secondary" iconLeft="plus" disabled={full} onClick={() => add(typed)} />
        </div>
      </div>
      {error ? (
        <FieldError message={error} />
      ) : (
        <span className="text-sm text-concrete-500">
          {full
            ? `Até ${MAX_SPECIALTIES} especialidades. Remova uma para trocar.`
            : 'Toque numa sugestão ou escreva a sua e toque em Adicionar.'}
        </span>
      )}
      {value.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Suas especialidades">
          {value.map((s) => (
            <Tag key={s} label={s} selected onRemove={() => onChange(value.filter((x) => x !== s))} />
          ))}
        </div>
      ) : null}
      {suggestions.length && !full ? (
        <div className="flex flex-wrap gap-2" aria-label="Sugestões">
          {suggestions.map((s) => (
            <Tag key={s} label={s} icon="plus" onClick={() => add(s)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
