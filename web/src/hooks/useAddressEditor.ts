// U51: the address in "Editar perfil" (worker and company) — what is being typed, its problems, and checking it on
// "Salvar" (only when it changed).
import { useState } from 'react';
import {
  resolveAddress,
  sameDraft,
  type AddressDraft,
  type AddressErrors,
  type AddressField,
  type ResolvedAddress
} from '../services/address';

export interface AddressEditor {
  draft: AddressDraft;
  errors: AddressErrors;
  changed: boolean;
  onChange: (patch: Partial<AddressDraft>, clear: AddressField[]) => void;
  /**
   * Checks the address and finds it on the map, without saving: `null` when it didn't change, `false` when a field
   * needs fixing (the message shows under it). Throws when the lookups can't be reached.
   */
  check: () => Promise<ResolvedAddress | null | false>;
}

export function useAddressEditor(initial: AddressDraft): AddressEditor {
  const [start] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<AddressErrors>({});
  const changed = !sameDraft(draft, start);
  return {
    draft,
    errors,
    changed,
    onChange: (patch, clear) => {
      setDraft((d) => ({ ...d, ...patch }));
      setErrors((e) => ({ ...e, ...Object.fromEntries(clear.map((k) => [k, null])) }));
    },
    check: async () => {
      if (!changed) return null;
      const r = await resolveAddress(draft);
      if (!r.ok) {
        setErrors(r.errors);
        return false;
      }
      setDraft(r.draft);
      return r.address;
    }
  };
}
