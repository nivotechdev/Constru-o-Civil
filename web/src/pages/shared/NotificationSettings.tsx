// F06: Configurações › Avisos — what reaches the bell and (with push set up, X03) the phone.
import { useEffect, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Icon } from '../../components/icons/Icon';
import { Sheet } from '../../components/Modal';
import { disablePush, enablePush, pushState, type PushState } from '../../services/push';
import { showToast } from '../../services/toast';
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
  { id: 'bicos_novos', label: 'Bicos novos e convites', description: 'Avisos de bico novo e convites de empresas' },
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
                  <PushDevice />
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

const PUSH_TEXT: Record<PushState, string> = {
  ligado: 'Este aparelho recebe as notificações.',
  desligado: 'Receba no celular, mesmo com o app fechado, quando a empresa responder ou um bico aparecer.',
  bloqueado:
    'As notificações estão bloqueadas no navegador. Libere em Configurações do site (cadeado ao lado do endereço).',
  indisponivel: 'Este navegador não recebe notificações. No iPhone, adicione a Bicos à tela de início primeiro.'
};

/** X03: this device on or off; the browser's permission is asked only after the explanation. */
function PushDevice() {
  const [state, setState] = useState<PushState | null>(null);
  const [explaining, setExplaining] = useState(false);
  const refresh = () => void pushState().then(setState, () => setState('indisponivel'));
  useEffect(refresh, []);
  const enable = useAction(enablePush, () => {
    setExplaining(false);
    refresh();
    showToast('Notificações ligadas neste aparelho');
  });
  const disable = useAction(disablePush, () => {
    refresh();
    showToast('Notificações desligadas neste aparelho');
  });
  if (!state) return null;
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <Icon name="bell" size={20} color="var(--text-subtle)" />
        <div className="flex-1 flex flex-col gap-3">
          <span className="text-sm text-concrete-700">{PUSH_TEXT[state]}</span>
          {state === 'desligado' ? (
            <Button label="Ativar neste aparelho" size="sm" onClick={() => setExplaining(true)} />
          ) : state === 'ligado' ? (
            <Button
              label="Desligar neste aparelho"
              size="sm"
              variant="secondary"
              loading={disable.loading}
              onClick={() => void disable.run()}
            />
          ) : null}
          {disable.error ? <FieldError message={disable.error} /> : null}
        </div>
      </div>
      <Sheet open={explaining} title="Notificações no celular" onClose={() => setExplaining(false)}>
        <div className="flex flex-col gap-3 text-sm text-concrete-700">
          <p>Avisamos no celular, mesmo com o app fechado:</p>
          <ul className="flex flex-col gap-2 pl-1">
            <li>• quando a empresa aprovar, contratar ou cancelar;</li>
            <li>• lembretes de confirmar presença e de avaliar a diária;</li>
            <li>• bicos novos e convites, se você quiser (escolha abaixo).</li>
          </ul>
          <p>
            O navegador vai perguntar se pode mostrar notificações: toque em “Permitir”. Dá para desligar aqui a
            qualquer hora.
          </p>
        </div>
        {enable.error ? <FieldError message={enable.error} /> : null}
        <Button label="Continuar" size="lg" fullWidth loading={enable.loading} onClick={() => void enable.run()} />
      </Sheet>
    </Card>
  );
}
