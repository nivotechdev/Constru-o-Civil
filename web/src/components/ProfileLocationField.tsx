// U22: the place saved in the profile, in "Editar perfil" — the same button and the same city list as the mural's
// filters: any Brazilian city, typed or picked, or "Usar minha localização". It doesn't have to be where the person is
// now. A city from the list keeps its centre as the point; from the GPS, the point rounded to ~1 km (as at sign-up).
// Saved with the profile, it is where the mural opens and where a company's new job starts, every time the app opens.
import { useState } from 'react';
import { CityPicker, LocationButton } from './CityPicker';
import { FieldError } from './FieldError';
import { errorMessage } from '../services/errors';
import { locationFromCity, locationFromPoint, type SavedLocation } from '../services/location';
import type { GeoPoint } from '../types/models';

interface ProfileLocationFieldProps {
  /** Title over the button ("Sua cidade"). */
  title: string;
  /** What the place is used for, under the button. */
  help: string;
  /** The city saved now ("Name, UF"); empty when there is none. */
  city: string;
  onChange: (location: SavedLocation) => void;
  error?: string | null;
  /** Key of the city list's own state. */
  stateKey: string;
}

export function ProfileLocationField({ title, help, city, onChange, error, stateKey }: ProfileLocationFieldProps) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(label: string, point?: GeoPoint) {
    setOpen(false);
    setProblem(null);
    try {
      const location = point ? await locationFromPoint(point.lat, point.lon) : await locationFromCity(label);
      if (location) onChange(location);
    } catch (e: unknown) {
      setProblem(errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <LocationButton title={title} location={city || 'Escolha a cidade'} onClick={() => setOpen(true)} />
      <span className="text-sm text-concrete-500">{help}</span>
      {problem || error ? <FieldError message={problem ?? error ?? ''} /> : null}
      {/* Inside a profile form: Enter in the list's search box must not save the form. */}
      <div
        className="contents"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
      >
        <CityPicker
          open={open}
          title={title}
          value={city}
          stateKey={stateKey}
          onChoose={(label, point) => void choose(label, point)}
          onClose={() => setOpen(false)}
        />
      </div>
    </div>
  );
}
