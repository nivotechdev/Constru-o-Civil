import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { IconName } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { JobNotFound } from '../../components/NotFound';
import { Rating } from '../../components/Rating';
import { Tag } from '../../components/Tag';
import { useDb, useUI } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack, navigate } from '../../services/router';
import { companyOf, currentWorkerId, getJob } from '../../services/selectors';
import { markReviewed } from '../../services/store';
import { dateText } from '../../utils/jobInfo';
import { toggleItem } from '../../utils/list';

const OPTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'pagou', label: 'Pagou no dia', icon: 'hand-coins' },
  { id: 'epi', label: 'EPI no local', icon: 'hard-hat' },
  { id: 'horario', label: 'Horário combinado', icon: 'clock' },
  { id: 'equipe', label: 'Equipe respeitosa', icon: 'users' }
];

interface RateUI {
  rating: number;
  selected: string[];
  comment: string;
}

export default function RateJob({ params }: ScreenProps) {
  const db = useDb();
  const [ui, setUi] = useUI<RateUI>('rate-job', { rating: 5, selected: ['pagou'], comment: '' });
  const job = getJob(db, params.id);
  if (!job) return <JobNotFound />;
  const company = companyOf(db, job);

  return (
    <div className="flex flex-col">
      <BackBar title="Avaliar a diária" onBack={() => goBack('/minhas-candidaturas')} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Como foi a diária?</h1>
          <span className="text-sm text-concrete-500">{`${job.role} · ${company.name} · ${dateText(job)}`}</span>
        </div>
        <Card padding="md">
          <div className="flex flex-col items-center gap-3">
            <span className="font-semibold text-concrete-900">Sua nota para a construtora</span>
            <Rating value={ui.rating} editable onChange={(v) => setUi({ rating: v })} />
          </div>
        </Card>
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">O que aconteceu</div>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((o) => (
              <Tag
                key={o.id}
                label={o.label}
                icon={o.icon}
                selected={ui.selected.includes(o.id)}
                onClick={() =>
                  setUi({
                    selected: toggleItem(ui.selected, o.id)
                  })
                }
              />
            ))}
          </div>
        </div>
        <Input
          id="rate-comment"
          label="Quer escrever algo? (opcional)"
          placeholder="Ex.: obra organizada, pagamento em PIX no fim do dia"
          hint="Sua avaliação aparece no perfil da construtora."
          value={ui.comment}
          onInput={(v) => setUi({ comment: v })}
        />
        <div className="pt-1">
          <Button
            label="Enviar avaliação"
            size="lg"
            fullWidth
            onClick={() => {
              markReviewed(job.id, currentWorkerId());
              navigate('/minhas-candidaturas');
            }}
          />
        </div>
      </div>
    </div>
  );
}
