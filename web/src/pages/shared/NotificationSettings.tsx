// F06: Configurações › Avisos — what reaches the bell and (with push set up, X03) the phone.
import { BackBar } from '../../components/BackBar';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { Switch } from '../../components/Switch';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb, useSession } from '../../hooks/useStore';
import { FEATURES } from '../../services/features';
import { loadNotificationPrefs, myPrefs, saveNotificationPrefs } from '../../services/notifications';
import { goBack } from '../../services/router';
import type { NotificationGroup } from '../../types/models';

const GROUPS: { id: NotificationGroup; label: string; description: string }[] = [
  { id: 'candidaturas', label: 'Candidaturas e contratações', description: 'Aprovado, contratado, desistências…' },
  { id: 'lembretes', label: 'Lembretes', description: 'Confirmar presença, avaliar a diária' },
  { id: 'bicos_novos', label: 'Bicos novos e convites', description: 'Avisos de bico novo e convites de construtoras' },
  { id: 'conta', label: 'Sua conta', description: 'Verificação da empresa, impulsionamentos' }
];

export default function NotificationSettings() {
  const db = useDb();
  const session = useSession();
  const query = useQuery('notification-prefs', loadNotificationPrefs);
  const prefs = myPrefs(db, session);
  const save = useAction(saveNotificationPrefs);
  const toggle = (list: NotificationGroup[], g: NotificationGroup, on: boolean) =>
    on ? [...new Set([...list, g])] : list.filter((x) => x !== g);

  return (
    <div className="flex flex-col">
      <BackBar title="Avisos" onBack={() => goBack('/configuracoes')} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <QueryView query={query} skeleton={<ListSkeleton />}>
          {() => (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">No app</span>
                <Card padding="md">
                  <Switch
                    label="Bicos novos e convites"
                    description="Os avisos do andamento do seu bico sempre chegam."
                    checked={!prefs.muted.includes('bicos_novos')}
                    onChange={(on) => void save.run({ ...prefs, muted: on ? [] : ['bicos_novos'] })}
                  />
                </Card>
              </div>
              {FEATURES.push ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">No celular</span>
                  <Card padding="md">
                    <div className="flex flex-col gap-4">
                      {GROUPS.map((g) => (
                        <Switch
                          key={g.id}
                          label={g.label}
                          description={g.description}
                          checked={prefs.push.includes(g.id)}
                          onChange={(on) => void save.run({ ...prefs, push: toggle(prefs.push, g.id, on) })}
                        />
                      ))}
                    </div>
                  </Card>
                </div>
              ) : null}
              {save.error ? <FieldError message={save.error} /> : null}
            </>
          )}
        </QueryView>
      </div>
    </div>
  );
}
