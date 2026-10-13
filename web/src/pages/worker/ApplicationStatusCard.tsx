// X06: on the job's page the worker sees where their candidacy stands — the status, since when, and the
// reason the company (or the system) gave, when there is one — plus the next step.
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { navigate } from '../../services/router';
import type { Application } from '../../types/models';
import { statusInfo } from '../../utils/applicationStatus';
import { dateTimeLabel } from '../../utils/dates';

/** "hoje, 9h10", "sex, 25 set, 9h10" (inside a sentence). */
function when(iso: string): string {
  const t = dateTimeLabel(iso);
  return t.charAt(0).toLowerCase() + t.slice(1);
}

export function ApplicationStatusCard({ app }: { app: Application }) {
  const info = statusInfo(app);
  const last = app.events[app.events.length - 1];
  const since = last?.at ?? app.statusChangedAt;
  const reason = last && last.status === app.status ? last.reason : null;
  const sentAt = app.events[0]?.at ?? app.createdAt;
  const leadsElsewhere = !info.to.startsWith('/vaga/');
  return (
    <Card padding="md">
      <div className="flex flex-col gap-3" role="status">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Sua candidatura</span>
          <Badge label={info.label} tone={info.tone} icon={info.icon} />
        </div>
        <div className="flex flex-col gap-1 text-sm text-concrete-700">
          <span>{`Enviada ${when(sentAt)}`}</span>
          {since !== sentAt ? <span>{`${info.label} desde ${when(since)}`}</span> : null}
          {reason ? (
            <span className="text-concrete-900">
              <strong>Motivo:</strong> {reason}
            </span>
          ) : null}
        </div>
        {leadsElsewhere ? (
          <Button label={info.hint} variant="secondary" size="sm" onClick={() => navigate(info.to)} />
        ) : null}
      </div>
    </Card>
  );
}
