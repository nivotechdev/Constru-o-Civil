// "Onde você quer trabalhar": the button that shows the chosen city, and the sheet that picks one — by
// GPS or by typing any Brazilian municipality. Used by the mural's filters and by "Completar perfil".
import { useUI } from '../hooks/useStore';
import { nearestCity, searchCities } from '../services/cities';
import { cx } from '../utils/cx';
import { Button } from './Button';
import { Icon } from './icons/Icon';
import { Input } from './Input';
import { Sheet } from './Modal';

type Geo = null | 'loading' | 'denied' | 'error';

interface PickerUI {
  query: string;
  geo: Geo;
}

const PICKER_DEFAULTS: PickerUI = { query: '', geo: null };

/** The field-like button with the current city; opens the picker. */
export function LocationButton({ title, location, onClick }: { title: string; location: string; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</div>
      <button
        type="button"
        aria-haspopup="dialog"
        className="flex items-center gap-3 w-full p-3 rounded-card border border-concrete-300 bg-white text-left transition-colors hover:bg-concrete-50 hover:border-concrete-400"
        onClick={onClick}
      >
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0">
          <Icon name="map-pin" size={20} color="var(--brand)" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-xs text-concrete-500">Cidade</span>
          <span className="font-semibold text-concrete-900 truncate">{location}</span>
        </span>
        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600 shrink-0">
          Escolher
          <Icon name="chevron-right" size={16} color="var(--text-brand)" />
        </span>
      </button>
    </div>
  );
}

interface CityPickerProps {
  open: boolean;
  title: string;
  /** The city chosen now ("Name, UF"), checked in the list. */
  value: string;
  onChoose: (label: string) => void;
  onClose: () => void;
  /** Key of the picker's own state (typed search, GPS status), one per place that uses it. */
  stateKey: string;
}

export function CityPicker({ open, title, value, onChoose, onClose, stateKey }: CityPickerProps) {
  const [ui, setUi] = useUI<PickerUI>(stateKey, PICKER_DEFAULTS);
  const close = () => {
    setUi(PICKER_DEFAULTS);
    onClose();
  };
  const choose = (label: string) => {
    setUi(PICKER_DEFAULTS);
    onChoose(label);
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setUi({ geo: 'error' });
      return;
    }
    setUi({ geo: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = nearestCity(pos.coords.latitude, pos.coords.longitude);
        if (c) choose(c.label);
        else setUi({ geo: 'error' });
      },
      (err) => setUi({ geo: err && err.code === 1 ? 'denied' : 'error' }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };
  const q = ui.query.trim();
  const results = open ? searchCities(q, 8) : [];
  const geoMsg =
    ui.geo === 'denied'
      ? 'Seu navegador não liberou a localização. Digite a cidade abaixo.'
      : ui.geo === 'error'
        ? 'Não conseguimos achar sua localização agora. Digite a cidade abaixo.'
        : null;

  return (
    <Sheet open={open} title={title} onClose={close}>
      <Button
        label={ui.geo === 'loading' ? 'Buscando sua localização…' : 'Usar minha localização'}
        variant="secondary"
        fullWidth
        iconLeft="locate-fixed"
        loading={ui.geo === 'loading'}
        onClick={useMyLocation}
      />
      {geoMsg ? (
        <span className="flex items-start gap-2 text-sm text-concrete-700 -mt-1">
          <Icon name="circle-alert" size={16} color="var(--amber-500)" />
          {geoMsg}
        </span>
      ) : null}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-concrete-400">
        <span className="flex-1 h-px bg-concrete-200" />
        ou
        <span className="flex-1 h-px bg-concrete-200" />
      </div>
      <Input
        id={stateKey + '-search'}
        placeholder="Digite o nome da cidade"
        icon="search"
        value={ui.query}
        autoFocus
        onInput={(v) => setUi({ query: v })}
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500 pb-1">
          {q ? 'Cidades encontradas' : 'Cidades mais procuradas'}
        </span>
        {results.length ? (
          <div className="flex flex-col" role="listbox" aria-label="Cidades">
            {results.map((c) => {
              const active = c.label === value;
              return (
                <button
                  key={c.label}
                  type="button"
                  role="option"
                  aria-selected={active ? 'true' : 'false'}
                  className={cx(
                    'flex items-center gap-3 min-h-12 px-2 -mx-2 rounded-control text-left transition-colors hover:bg-concrete-50',
                    active ? 'text-brand-600' : 'text-concrete-900'
                  )}
                  onClick={() => choose(c.label)}
                >
                  <Icon name="map-pin" size={18} color={active ? 'var(--brand)' : 'var(--text-subtle)'} />
                  <span className="flex-1 min-w-0 truncate">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-concrete-500">{' · ' + c.uf}</span>
                  </span>
                  {active ? <Icon name="check" size={18} color="var(--brand)" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="py-3 text-sm text-concrete-500">{`Nenhuma cidade com “${q}”. Confira a grafia.`}</span>
        )}
      </div>
    </Sheet>
  );
}
