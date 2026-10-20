// U12/U13: the place saved in the profile, set with one button — "Usar minha localização atual". The city it
// found shows above the button. Only if the phone can't give the location (not allowed, GPS off, a computer
// without it) a way to pick the city in the list appears, so nobody gets stuck.
import { useState } from 'react';
import { errorMessage } from '../services/errors';
import { currentLocation, locationFromCity, type SavedLocation } from '../services/location';
import { Button } from './Button';
import { CityPicker } from './CityPicker';
import { FieldError } from './FieldError';
import { Icon } from './icons/Icon';

interface CurrentLocationFieldProps {
  /** Short title over the field ("Sua localização"). */
  title: string;
  /** What the location is used for, under the title. */
  help: string;
  /** The place saved now (only its city is shown). */
  value: Pick<SavedLocation, 'city'> | null;
  onChange: (location: SavedLocation) => void;
  /** A problem from the screen (e.g. "use the button to continue"). */
  error?: string | null;
  /** Key of the city picker's own state. */
  stateKey: string;
}

export function CurrentLocationField({ title, help, value, onChange, error, stateKey }: CurrentLocationFieldProps) {
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function locate() {
    if (locating) return;
    setLocating(true);
    setProblem(null);
    currentLocation()
      .then((location) => onChange(location))
      .catch((e: unknown) => setProblem(errorMessage(e)))
      .finally(() => setLocating(false));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-concrete-900">{title}</span>
        <span className="text-sm text-concrete-500">{help}</span>
      </div>
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-card border border-concrete-200 bg-white" role="status">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-success-50 shrink-0">
            <Icon name="map-pin" size={20} color="var(--green-500)" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-xs text-concrete-500">Localização salva</span>
            <span className="font-semibold text-concrete-900 truncate">{value.city}</span>
          </span>
          <Icon name="circle-check" size={20} color="var(--green-500)" />
        </div>
      ) : null}
      <Button
        label={
          locating
            ? 'Buscando sua localização…'
            : value
              ? 'Atualizar com a localização atual'
              : 'Usar minha localização atual'
        }
        variant={value ? 'secondary' : 'primary'}
        fullWidth
        iconLeft="locate-fixed"
        loading={locating}
        onClick={locate}
      />
      {problem ? (
        <div className="flex flex-col gap-1.5">
          <FieldError message={problem} />
          <button
            type="button"
            className="self-start inline-flex items-center gap-1 h-9 px-3 -ml-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50"
            onClick={() => setPickerOpen(true)}
          >
            Escolher a cidade na lista
            <Icon name="chevron-right" size={16} color="var(--text-brand)" />
          </button>
        </div>
      ) : error ? (
        <FieldError message={error} />
      ) : null}
      {/* Inside a profile form: Enter in the list's search box must not save the form. */}
      <div
        className="contents"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
      >
        <CityPicker
          open={pickerOpen}
          title="Escolha a cidade"
          value={value?.city ?? ''}
          stateKey={stateKey}
          onChoose={(label) => {
            setPickerOpen(false);
            void locationFromCity(label).then((location) => {
              if (location) {
                setProblem(null);
                onChange(location);
              }
            });
          }}
          onClose={() => setPickerOpen(false)}
        />
      </div>
    </div>
  );
}
