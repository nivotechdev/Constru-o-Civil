// U51: the address — CEP, city, street and neighbourhood — the same in the sign-up, "Editar perfil" and the job form.
// The CEP fills the rest; without it, the city comes from the IBGE list and the street from the Correios' list (each
// with its CEP), so the CEP fills itself when a street is chosen. Typing freely still works: the address is checked
// and placed on the map when it is saved (address.resolveAddress).
import { useRef, useState } from 'react';
import {
  knownCityLabel,
  lookupCep,
  maskCEP,
  onlyDigits,
  suggestCities,
  suggestNeighborhoods,
  suggestStreets,
  type AddressDraft,
  type AddressErrors,
  type AddressField,
  type StreetOption
} from '../services/address';
import { errorMessage } from '../services/errors';
import { cx } from '../utils/cx';
import { AutocompleteField } from './AutocompleteField';
import { FieldError } from './FieldError';
import { Input } from './Input';

type CepStatus = 'idle' | 'loading' | 'found' | 'notfound' | 'error' | 'fromStreet';

interface AddressFieldsProps {
  /** Prefix of the fields' ids ("cadastro-endereco" → "cadastro-endereco-cep"…). */
  idPrefix: string;
  value: AddressDraft;
  errors: AddressErrors;
  /** New values, and the fields whose message they answer. */
  onChange: (patch: Partial<AddressDraft>, clear: AddressField[]) => void;
  /** What the street placeholder suggests ("Ex.: Rua Sinimbu"). */
  streetExample?: string;
}

export function AddressFields({ idPrefix, value, errors, onChange, streetExample }: AddressFieldsProps) {
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle');
  const [cepProblem, setCepProblem] = useState<string | null>(null);
  const cepSeq = useRef(0);
  const city = knownCityLabel(value.city);
  const waitCity = city ? null : 'Escolha a cidade primeiro.';

  // The CEP fills street, neighbourhood and city as soon as its 8 digits are typed (a newer CEP makes an older
  // answer stale).
  function onCep(typed: string) {
    const cep = maskCEP(typed);
    onChange({ cep }, ['cep']);
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      cepSeq.current++;
      setCepStatus('idle');
      return;
    }
    if (digits === onlyDigits(value.cep)) return;
    const seq = ++cepSeq.current;
    setCepStatus('loading');
    setCepProblem(null);
    lookupCep(cep)
      .then((found) => {
        if (seq !== cepSeq.current) return;
        if (!found) {
          setCepStatus('notfound');
          return;
        }
        setCepStatus('found');
        onChange(
          {
            city: found.city,
            ...(found.street ? { street: found.street } : {}),
            ...(found.neighborhood ? { neighborhood: found.neighborhood } : {})
          },
          ['cep', 'city', 'street', 'neighborhood']
        );
      })
      .catch((e: unknown) => {
        if (seq !== cepSeq.current) return;
        setCepStatus('error');
        setCepProblem(errorMessage(e));
      });
  }

  function chooseStreet(o: StreetOption) {
    if (o.cep) {
      cepSeq.current++;
      setCepStatus('fromStreet');
    }
    onChange(
      {
        street: o.street,
        ...(o.neighborhood ? { neighborhood: o.neighborhood } : {}),
        ...(o.cep ? { cep: o.cep } : {})
      },
      ['street', 'neighborhood', ...(o.cep ? (['cep'] as const) : [])]
    );
  }

  const showsProblem = Boolean(errors.city || errors.street || errors.neighborhood);
  const cepHint =
    cepStatus === 'loading'
      ? 'Buscando o endereço…'
      : cepStatus === 'found'
        ? 'Endereço encontrado. Confira a rua e o bairro.'
        : cepStatus === 'fromStreet'
          ? 'CEP da rua escolhida.'
          : cepStatus === 'notfound'
            ? 'Não achamos esse CEP. Confira ou deixe em branco.'
            : cepStatus === 'error'
              ? (cepProblem ?? 'Não deu para buscar o CEP agora.')
              : 'Não sabe? Deixe em branco: achamos pela rua.';

  return (
    <div className="flex flex-col gap-3 short:gap-2">
      <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 items-start">
        <Input
          id={idPrefix + '-cep'}
          label="CEP"
          placeholder="00000-000"
          inputMode="numeric"
          mono
          autoComplete="postal-code"
          value={value.cep}
          invalid={Boolean(errors.cep)}
          describedBy={idPrefix + '-cep-msg'}
          onInput={onCep}
        />
        <AutocompleteField<string>
          id={idPrefix + '-cidade'}
          label="Cidade"
          placeholder="Ex.: Caxias do Sul"
          value={value.city}
          minChars={1}
          load={(typed) => ({ items: suggestCities(typed) })}
          optionKey={(c) => c}
          optionLabel={(c) => c}
          emptyText="Nenhuma cidade com esse nome."
          error={errors.city}
          onInput={(v) => onChange({ city: v }, ['city'])}
          onChoose={(label) => onChange({ city: label }, ['city', 'cep'])}
        />
      </div>
      {/* Under the row, full width: the CEP's column is narrow. */}
      {errors.cep ? (
        <div className="-mt-1.5">
          <FieldError id={idPrefix + '-cep-msg'} message={errors.cep} />
        </div>
      ) : showsProblem && cepStatus === 'idle' ? null : (
        // With problems on the screen the tip makes room for them (the sign-up step fits a small phone).
        <span
          id={idPrefix + '-cep-msg'}
          className={cx(
            '-mt-1.5 text-sm',
            cepStatus === 'found' || cepStatus === 'fromStreet'
              ? 'text-success-500'
              : cepStatus === 'error' || cepStatus === 'notfound'
                ? 'text-danger-500'
                : 'text-concrete-500'
          )}
          aria-live="polite"
        >
          {cepHint}
        </span>
      )}
      <AutocompleteField<StreetOption>
        id={idPrefix + '-rua'}
        label="Rua"
        placeholder={streetExample ?? 'Ex.: Rua Sinimbu'}
        value={value.street}
        minChars={3}
        waitingText={waitCity}
        load={(typed, signal) => (city ? suggestStreets(city, typed, signal) : { items: [] })}
        optionKey={(o) => `${o.street}|${o.neighborhood}|${o.cep}|${o.detail}`}
        optionLabel={(o) => o.street}
        optionDetail={(o) => [o.neighborhood, o.cep, o.detail].filter(Boolean).join(' · ') || null}
        emptyText="Nenhuma rua com esse nome nessa cidade. Confira o nome."
        error={errors.street}
        onInput={(v) => onChange({ street: v }, ['street'])}
        onChoose={chooseStreet}
      />
      <AutocompleteField<string>
        id={idPrefix + '-bairro'}
        label="Bairro"
        placeholder="Ex.: Centro"
        value={value.neighborhood}
        minChars={2}
        waitingText={waitCity}
        load={(typed, signal) => (city ? suggestNeighborhoods(city, typed, signal) : { items: [] })}
        optionKey={(n) => n}
        optionLabel={(n) => n}
        emptyText="Nenhum bairro com esse nome. Pode continuar digitando."
        error={errors.neighborhood}
        onInput={(v) => onChange({ neighborhood: v }, ['neighborhood'])}
        onChoose={(n) => onChange({ neighborhood: n }, ['neighborhood'])}
      />
    </div>
  );
}
