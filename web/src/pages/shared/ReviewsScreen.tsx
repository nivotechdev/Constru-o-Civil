import { useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { NotFound } from '../../components/NotFound';
import { ScreenLoading } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { loadCompanyProfile, loadWorkerProfile } from '../../services/profiles';
import { Rating } from '../../components/Rating';
import { useDb, useRole, useSession } from '../../hooks/useStore';
import type { ScreenProps } from '../../types/screen';
import { goBack } from '../../services/router';
import { dayLabel, toISODate } from '../../utils/dates';
import { getCompany, getWorker } from '../../services/selectors';
import { ReportSheet } from '../../components/SafetyMenu';

export default function ReviewsScreen({ params }: ScreenProps) {
  const db = useDb();
  const role = useRole();
  const session = useSession();
  const [reporting, setReporting] = useState<string | null>(null);
  const type = params.type === 'construtora' ? 'construtora' : 'trabalhador';
  const mine = type === 'trabalhador' ? session?.workerId === params.id : session?.companyId === params.id;
  const backTarget = mine
    ? type === 'trabalhador'
      ? '/perfil'
      : '/empresa'
    : type === 'trabalhador'
      ? '/trabalhador/' + params.id
      : '/construtora/' + params.id;
  const query = useQuery(type === 'trabalhador' ? 'worker:' + params.id : 'company:' + params.id, () =>
    type === 'trabalhador' ? loadWorkerProfile(params.id) : loadCompanyProfile(params.id)
  );
  if (query.status !== 'ready')
    return (
      <ScreenLoading title="Avaliações" onBack={() => goBack(backTarget)} query={query} skeleton={<ListSkeleton />} />
    );
  const worker = type === 'trabalhador' ? getWorker(db, params.id) : undefined;
  const company = type === 'construtora' ? getCompany(db, params.id) : undefined;
  const subject = worker || company;
  if (!subject) return <NotFound message="Não encontrado." />;

  // Each one sees their own reviews; besides that, only companies see a worker's and only workers see a
  // company's (L09).
  const allowed = mine || (type === 'trabalhador' ? role === 'recrutador' : role === 'trabalhador');

  if (!allowed) {
    return (
      <div className="flex flex-col">
        <BackBar title="Avaliações" onBack={() => goBack(backTarget)} />
        <EmptyState
          icon="lock"
          title="Essas avaliações não são suas para ver"
          description={
            type === 'trabalhador'
              ? 'Só empresas podem ver as avaliações de um trabalhador.'
              : 'Só trabalhadores podem ver as avaliações de uma empresa.'
          }
        />
      </div>
    );
  }

  const reviews = subject.reviews || [];
  const count = subject.reviewCount;

  return (
    <div className="flex flex-col">
      <BackBar title="Avaliações" onBack={() => goBack(backTarget)} />
      <div className="flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-display font-bold text-2xl text-concrete-900">{subject.name}</span>
          <Rating value={subject.rating} count={count} />
        </div>
        {reviews.length === 0 ? (
          <EmptyState
            icon="star"
            title="Ainda não há avaliações"
            description={`${subject.name} ainda não recebeu nenhuma avaliação na plataforma.`}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <Card key={r.id} padding="md">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-concrete-900">{r.authorLabel}</span>
                    <Rating value={r.value} showValue={false} size={13} />
                  </div>
                  {r.tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center h-7 px-2.5 rounded-full bg-concrete-100 text-xs font-semibold text-concrete-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {r.comment ? <span className="text-sm text-concrete-700">{r.comment}</span> : null}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-concrete-500">{dayLabel(toISODate(new Date(r.createdAt)))}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-concrete-500 hover:text-danger-500"
                      onClick={() => setReporting(r.id)}
                    >
                      Denunciar
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <ReportSheet
        open={reporting !== null}
        onClose={() => setReporting(null)}
        target="avaliacao"
        targetId={reporting ?? ''}
        what="a avaliação"
      />
    </div>
  );
}
