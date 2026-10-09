// "Excluir minha conta": confirm the password, see what happens to the bicos in progress (and confirm
// it), confirm once more, then the account is deleted and the session ends.
import { useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { PasswordInput } from '../../components/Input';
import { Dialog } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';
import { useDb, useRole } from '../../hooks/useStore';
import { deleteAccount, deletionImpact, loadDeletionImpact } from '../../services/account';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { jobTitle } from '../../services/catalog';
import { goBack, navigate } from '../../services/router';
import { dateText } from '../../utils/jobInfo';

export default function DeleteAccount() {
  const db = useDb();
  const role = useRole();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const query = useQuery('deletion-impact', loadDeletionImpact);
  const remove = useAction(deleteAccount, () => navigate('/conta-excluida', { replace: true }));
  const back = () => goBack('/configuracoes/privacidade');
  if (query.status !== 'ready')
    return <ScreenLoading title="Excluir minha conta" onBack={back} query={query} skeleton={<PageSkeleton />} />;
  const impact = deletionImpact(db);
  const worker = role === 'trabalhador';

  function start() {
    if (!password) {
      setFieldError('Digite sua senha para confirmar que é você.');
      return;
    }
    if (impact.commitments.length && !agreed) {
      setFieldError(null);
      return;
    }
    remove.reset();
    setAsking(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Excluir minha conta" onBack={back} />
      <div className="flex flex-col gap-5 px-4 sm:px-0 py-4">
        <Card padding="md" className="border-danger-100">
          <div className="flex gap-3 items-start">
            <Icon name="triangle-alert" size={20} color="var(--red-500)" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-danger-500">Essa ação não pode ser desfeita</span>
              <span className="text-sm text-concrete-600">
                Seu perfil, fotos, contatos, candidaturas, posts e notificações são apagados. Avaliações e o histórico
                dos bicos continuam para o outro lado, sem o seu nome.
              </span>
            </div>
          </div>
        </Card>

        {impact.commitments.length || impact.openJobs.length ? (
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">
              O que acontece com seus bicos
            </div>
            <Card padding="md">
              <div className="flex flex-col gap-3">
                {impact.commitments.map(({ app, job }) => (
                  <div key={app.id} className="flex gap-2.5 items-start">
                    <Icon name="user-x" size={18} color="var(--red-500)" />
                    <span className="text-sm text-concrete-700">
                      {worker
                        ? `Você desiste de ${jobTitle(job)} (${dateText(job)}). A construtora é avisada.`
                        : `A contratação de ${db.workers[app.workerId]?.name ?? 'um trabalhador'} em ${jobTitle(job)} é cancelada, e ele é avisado.`}
                    </span>
                  </div>
                ))}
                {impact.openJobs.length ? (
                  <div className="flex gap-2.5 items-start">
                    <Icon name="circle-x" size={18} color="var(--gray-500)" />
                    <span className="text-sm text-concrete-700">
                      {impact.openJobs.length === 1
                        ? 'Sua vaga aberta é encerrada, e os candidatos são avisados.'
                        : `Suas ${impact.openJobs.length} vagas abertas são encerradas, e os candidatos são avisados.`}
                    </span>
                  </div>
                ) : null}
              </div>
            </Card>
            {impact.commitments.length ? (
              <div className="flex flex-col gap-1">
                <Checkbox
                  label={worker ? 'Entendo e confirmo a desistência desses bicos' : 'Entendo e confirmo o cancelamento'}
                  checked={agreed}
                  onChange={setAgreed}
                />
                <span className="pl-9 text-sm text-concrete-500">
                  Prefere resolver antes?{' '}
                  <button
                    type="button"
                    className="text-brand-600 underline"
                    onClick={() => navigate(worker ? '/minhas-candidaturas' : '/historico')}
                  >
                    {worker ? 'Ver minhas candidaturas' : 'Ver seus bicos'}
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <PasswordInput
          id="delete-password"
          label="Sua senha"
          value={password}
          error={fieldError}
          visible={visible}
          onToggleVisible={() => setVisible(!visible)}
          onInput={(v) => {
            setPassword(v);
            setFieldError(null);
          }}
          onEnter={start}
        />
        {impact.commitments.length && !agreed && password ? (
          <FieldError message="Confirme o que acontece com os bicos em andamento." />
        ) : null}
        <Button label="Excluir minha conta" variant="danger" size="lg" fullWidth onClick={start} />
      </div>
      <Dialog
        open={asking}
        tone="danger"
        title="Excluir sua conta de vez?"
        description="Depois disso, para usar a Bicos de novo você vai precisar criar outra conta."
        confirmLabel="Sim, excluir conta"
        loading={remove.loading}
        error={remove.error}
        onConfirm={() => void remove.run(password, agreed)}
        cancelLabel="Cancelar"
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
