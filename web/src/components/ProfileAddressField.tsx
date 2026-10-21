// U51: the address in "Editar perfil" — a title, what it is for, and the address fields (no "use my location": the
// address is typed, with real suggestions). Replaces the city picker of U22.
import type { AddressEditor } from '../hooks/useAddressEditor';
import { AddressFields } from './AddressFields';

export function ProfileAddressField({
  title,
  help,
  idPrefix,
  editor
}: {
  title: string;
  help: string;
  idPrefix: string;
  editor: AddressEditor;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex flex-col gap-0.5 pb-3">
        <span className="text-sm font-semibold text-concrete-900">{title}</span>
        <span className="text-sm text-concrete-500">{help}</span>
      </legend>
      <AddressFields idPrefix={idPrefix} value={editor.draft} errors={editor.errors} onChange={editor.onChange} />
    </fieldset>
  );
}
