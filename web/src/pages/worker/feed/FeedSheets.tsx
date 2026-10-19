// The mural's filters sheet (the city picker that opens over it is components/CityPicker).
import { Button } from '../../../components/Button';
import { LocationButton } from '../../../components/CityPicker';
import { Sheet } from '../../../components/Modal';
import { Switch } from '../../../components/Switch';
import { Tag } from '../../../components/Tag';
import { noFilters, radiusOf, setFeed, SORTS, type FeedUI } from './feedUI';
import type { GeoPoint, Role } from '../../../types/models';
import { FieldError } from '../../../components/FieldError';
import { useAction } from '../../../hooks/useAction';
import { useQuery } from '../../../hooks/useQuery';
import { useDb, useSession } from '../../../hooks/useStore';
import {
  alertSummary,
  deleteJobAlert,
  loadMyJobAlert,
  myJobAlert,
  saveJobAlert,
  type JobAlertInput
} from '../../../services/alerts';
import { showToast } from '../../../services/toast';

function FilterGroup({
  title,
  options,
  active,
  onSelect
}: {
  title: string;
  /** A plain string is both the value and the label. */
  options: (string | { value: string; label: string })[];
  active: string | null;
  onSelect: (o: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const { value, label } = typeof o === 'string' ? { value: o, label: o } : o;
          return <Tag key={value} label={label} selected={active === value} onClick={() => onSelect(value)} />;
        })}
      </div>
    </div>
  );
}

/** One filter panel for both layouts: a bottom sheet on phones, a dialog on desktop. */
export function FiltersSheet({
  ui,
  count,
  home,
  role,
  from
}: {
  ui: FeedUI;
  count: number;
  home: string;
  role: Role;
  /** Where distances are measured from (the alert keeps it). */
  from: GeoPoint;
}) {
  return (
    <Sheet open={ui.filtersOpen} title="Filtros" onClose={() => setFeed({ filtersOpen: false })}>
      <LocationButton
        title="Onde você quer trabalhar"
        location={ui.location}
        onClick={() => setFeed({ pickerOpen: true })}
      />
      {/* The phone has these as a segmented control on the mural itself. */}
      <div className="hidden lg:flex flex-col gap-2.5">
        <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Ordenar por</div>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((o) => (
            <Tag key={o.id} label={o.label} selected={ui.sort === o.id} onClick={() => setFeed({ sort: o.id })} />
          ))}
        </div>
      </div>
      {/* U01: no trade filter — the company no longer picks one, the title says what the job is. */}
      <FilterGroup
        title={ui.origin ? 'Distância de onde você está' : 'Distância'}
        options={['5', '10', '20', 'Toda a cidade'].map((d) => (d === 'Toda a cidade' ? d : `Até ${d} km`))}
        active={ui.dist}
        onSelect={(v) => setFeed({ dist: v })}
      />
      <FilterGroup
        title="Quando"
        options={['Hoje', 'Amanhã', 'Durante a semana', 'Fim de semana']}
        active={ui.quando}
        onSelect={(v) => setFeed({ quando: ui.quando === v ? null : v })}
      />
      {role === 'trabalhador' && ui.filtersOpen ? <JobAlertSwitch ui={ui} from={from} /> : null}
      <div className="flex gap-3 pt-1">
        <Button label="Limpar" variant="secondary" className="flex-1" onClick={() => setFeed(noFilters(home))} />
        <Button
          label={`Ver ${count === 1 ? '1 vaga' : count + ' vagas'}`}
          className="flex-[1.4]"
          onClick={() => setFeed({ filtersOpen: false })}
        />
      </div>
    </Sheet>
  );
}

// Y28: the alert lives on the server — on with these filters, off, or brought up to date with them.
function JobAlertSwitch({ ui, from }: { ui: FeedUI; from: GeoPoint }) {
  const db = useDb();
  const session = useSession();
  const query = useQuery('job-alert', loadMyJobAlert);
  const alert = myJobAlert(db, session);
  const current: JobAlertInput = {
    city: ui.location,
    lat: from.lat,
    lon: from.lon,
    radiusKm: radiusOf(ui.dist),
    oficioId: ui.oficio
  };
  const differs =
    alert !== null &&
    (alert.city !== current.city || alert.radiusKm !== current.radiusKm || alert.oficioId !== current.oficioId);
  const toggle = useAction(
    (on: boolean) => (on ? saveJobAlert(current) : deleteJobAlert()).then(() => on),
    (on) => showToast(on ? 'Aviso ligado' : 'Aviso desligado')
  );
  const update = useAction(
    () => saveJobAlert(current),
    () => showToast('Aviso atualizado')
  );
  const error = toggle.error ?? update.error ?? (query.status === 'error' ? query.error : null);
  return (
    <div className="flex flex-col gap-1.5 pt-1 border-t border-concrete-200">
      <Switch
        label="Avisar quando aparecer bico novo"
        description={
          alert
            ? `Ligado: ${alertSummary(alert)}.`
            : `Chega uma notificação quando surgir vaga assim: ${alertSummary(current)}.`
        }
        checked={alert !== null}
        onChange={(on) => {
          if (query.status === 'ready') void toggle.run(on);
        }}
      />
      {differs ? (
        <Button
          label="Usar estes filtros no aviso"
          variant="ghost"
          size="sm"
          loading={update.loading}
          onClick={() => void update.run()}
        />
      ) : null}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
