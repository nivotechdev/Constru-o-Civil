// F04: Configurações › Contas bloqueadas — who the account blocked, with "Desbloquear".
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { QueryView } from '../../components/QueryView';
import { ListSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { goBack } from '../../services/router';
import { blockedIds, loadMyBlocks, unblockAccount } from '../../services/safety';
import { showToast } from '../../services/toast';
import { FieldError } from '../../components/FieldError';

export default function BlockedAccounts() {
  const db = useDb();
  const query = useQuery('blocks', loadMyBlocks);
  const unblock = useAction(unblockAccount, () => showToast('Desbloqueado'));
  const list = blockedIds(db).map((id) => ({
    id,
    name: db.companies[id]?.name ?? db.workers[id]?.name ?? 'Conta da Bicos'
  }));

  return (
    <div className="flex flex-col">
      <BackBar title="Contas bloqueadas" onBack={() => goBack('/configuracoes')} />
      <div className="flex flex-col gap-3 px-4 sm:px-0 py-4">
        <QueryView query={query} skeleton={<ListSkeleton />}>
          {() =>
            list.length === 0 ? (
              <EmptyState
                icon="ban"
                title="Ninguém bloqueado"
                description="Quando você bloquear uma conta pelo botão de denunciar, ela aparece aqui."
              />
            ) : (
              <Card padding="none">
                <div className="flex flex-col divide-y divide-concrete-200">
                  {list.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex-1 min-w-0 font-semibold text-concrete-900 truncate">{b.name}</span>
                      <Button
                        label="Desbloquear"
                        size="sm"
                        variant="secondary"
                        loading={unblock.loading}
                        onClick={() => void unblock.run(b.id)}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )
          }
        </QueryView>
        {unblock.error ? <FieldError message={unblock.error} /> : null}
      </div>
    </div>
  );
}
