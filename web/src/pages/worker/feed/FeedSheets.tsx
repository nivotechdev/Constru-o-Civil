// The mural's filters sheet (the city picker that opens over it is components/CityPicker).
import { Button } from '../../../components/Button';
import { LocationButton } from '../../../components/CityPicker';
import { Sheet } from '../../../components/Modal';
import { Switch } from '../../../components/Switch';
import { Tag } from '../../../components/Tag';
import { TIPOS_SERVICO } from '../../../services/catalog';
import { NO_FILTERS, setFeed, SORTS, type FeedUI } from './feedUI';

function FilterGroup({
  title,
  options,
  active,
  onSelect
}: {
  title: string;
  options: string[];
  active: string | null;
  onSelect: (o: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Tag key={o} label={o} selected={active === o} onClick={() => onSelect(o)} />
        ))}
      </div>
    </div>
  );
}

/** One filter panel for both layouts: a bottom sheet on phones, a dialog on desktop. */
export function FiltersSheet({ ui, count }: { ui: FeedUI; count: number }) {
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
      <FilterGroup
        title="Tipo de serviço"
        options={TIPOS_SERVICO}
        active={ui.tipo}
        onSelect={(v) => setFeed({ tipo: ui.tipo === v ? null : v })}
      />
      <FilterGroup
        title={'Distância do centro de ' + ui.location.split(',')[0]}
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
      <div className="flex flex-col gap-1 pt-1 border-t border-concrete-200">
        <Switch
          label="Avisar quando aparecer bico novo"
          description="Chega uma notificação quando surgir vaga com esses filtros perto de você."
          checked={ui.notifyUrgent}
          onChange={(v) => setFeed({ notifyUrgent: v })}
        />
      </div>
      <div className="flex gap-3 pt-1">
        <Button label="Limpar" variant="secondary" className="flex-1" onClick={() => setFeed(NO_FILTERS)} />
        <Button
          label={`Ver ${count === 1 ? '1 vaga' : count + ' vagas'}`}
          className="flex-[1.4]"
          onClick={() => setFeed({ filtersOpen: false })}
        />
      </div>
    </Sheet>
  );
}
