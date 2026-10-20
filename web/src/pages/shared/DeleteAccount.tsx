// "Excluir minha conta": prove it is the owner (the password, or — U16 — a 6-number code sent to the account's
// e-mail, the only way for an account made with Google, which has no password), see what happens to the bicos
// in progress (and confirm it), confirm once more, then the account is deleted and the session ends. Only the
// logged-in account: the backend takes it from the session, never from the screen.
import { useEffect, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { useCaptcha } from '../../components/Captcha';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { CodeInput } from '../../components/CodeInput';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { PasswordInput } from '../../components/Input';
import { Dialog } from '../../components/Modal';
import { useAction } from '../../hooks/useAction';
import { useDb, useRole, useSession } from '../../hooks/useStore';
import {
  accountHasPassword,
  deleteAccount,
  deletionImpact,
  loadDeletionImpact,
  sendSecurityCode
} from '../../services/account';
import { errorMessage } from '../../services/errors';
import { CODE_LENGTH } from '../../utils/code';
import { ScreenLoading } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { jobTitle } from '../../services/catalog';
import { goBack, navigate } from '../../services/router';
import { dateText } from '../../utils/jobInfo';

export default function DeleteAccount() {
  const db = useDb();
  const role = useRole();
  const email = useSession()?.email ?? '';
  // null while asking whether the account has a password.
  const [method, setMethod] = useState<'senha' | 'codigo' | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const captcha = useCaptcha();
  const query = useQuery('deletion-impact', loadDeletionImpact);
  const remove = useAction(deleteAccount, () => navigate('/conta-excluida', { replace: true }));
  const back = () => goBack('/configuracoes');
  useEffect(() => {
    let live = true;
    accountHasPassword()
      .catch(() => true)
      .then((has) => {
        if (!live) return;
        setHasPassword(has);
        setMethod(has ? 'senha' : 'codigo');
      });
    return () => {
      live = false;
    };
  }, []);
  if (query.status !== 'ready' || !method)
    return <ScreenLoading title="Excluir minha conta" onBack={back} query={query} skeleton={<PageSkeleton />} />;
  const impact = deletionImpact(db);
  const worker = role === 'trabalhador';

  const proven = method === 'senha' ? Boolean(password) : code.length === CODE_LENGTH;

  function sendCode() {
    if (sending) return;
    setSending(true);
    setFieldError(null);
    sendSecurityCode(captcha.getToken)
      .then(() => {
        setCodeSent(true);
        setCode('');
      })
      .catch((e: unknown) => setFieldError(errorMessage(e)))
      .finally(() => setSending(false));
  }

  function switchMethod(next: 'senha' | 'codigo') {
    setMethod(next);
    setFieldError(null);
  }

  function start() {
    if (method === 'senha' && !password) {
      setFieldError('Digite sua senha para confirmar que é você.');
      return;
    }
    if (method === 'codigo' && !codeSent) {
      setFieldError('Toque em "Enviar código" para receber o código no seu e-mail.');
      return;
    }
    if (method === 'codigo' && code.length !== CODE_LENGTH) {
      setFieldError('Digite os 6 números do código que chegou no seu e-mail.');
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
                Tudo o que é seu na Bicos é apagado de vez: perfil, fotos, contatos, notificações e as avaliações que
                você fez e recebeu.{' '}
                {worker
                  ? 'Você sai de todos os bicos e candidaturas, e suas vagas salvas e publicações somem.'
                  : 'Todas as vagas que você publicou somem, com os candidatos e os impulsionamentos.'}
              </span>
            </div>
          </div>
        </Card>

        {impact.commitments.length || impact.jobs.length ? (
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
                {impact.jobs.length ? (
                  <div className="flex gap-2.5 items-start">
                    <Icon name="circle-x" size={18} color="var(--gray-500)" />
                    <span className="text-sm text-concrete-700">
                      {impact.jobs.length === 1
                        ? 'Sua vaga é apagada, com os candidatos dela.'
                        : `Suas ${impact.jobs.length} vagas são apagadas, com os candidatos delas.`}
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

        {method === 'senha' ? (
          <div className="flex flex-col gap-1.5">
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
            <button
              type="button"
              className="self-start h-10 -ml-3 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50"
              onClick={() => switchMethod('codigo')}
            >
              Não lembra a senha? Confirmar com um código no e-mail
            </button>
          </div>
        ) : (
          <Card padding="md">
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 items-start">
                <Icon name="mail" size={20} color="var(--brand)" />
                <span className="text-sm text-concrete-700">
                  {codeSent
                    ? `Enviamos um código de 6 números para ${email}. Digite ou cole aqui.`
                    : `Para confirmar que é você, vamos enviar um código de 6 números para ${email}.`}
                </span>
              </div>
              {codeSent ? (
                <CodeInput
                  id="delete-code"
                  label="Código do e-mail"
                  code={code}
                  error={fieldError}
                  pasteButton
                  autoFocus
                  onCode={(v) => {
                    setCode(v);
                    setFieldError(null);
                  }}
                  onEnter={start}
                />
              ) : fieldError ? (
                <FieldError message={fieldError} />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  label={codeSent ? 'Reenviar código' : 'Enviar código'}
                  variant={codeSent ? 'ghost' : 'secondary'}
                  size="sm"
                  iconLeft="mail"
                  loading={sending}
                  onClick={sendCode}
                />
                {hasPassword ? (
                  <Button label="Usar minha senha" variant="ghost" size="sm" onClick={() => switchMethod('senha')} />
                ) : null}
              </div>
            </div>
          </Card>
        )}
        {impact.commitments.length && !agreed && proven ? (
          <FieldError message="Confirme o que acontece com os bicos em andamento." />
        ) : null}
        {captcha.widget}
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
        onConfirm={() => void remove.run(method === 'senha' ? { password } : { code }, agreed, captcha.getToken)}
        cancelLabel="Cancelar"
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
