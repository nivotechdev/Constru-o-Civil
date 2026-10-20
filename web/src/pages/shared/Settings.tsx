import { useSyncExternalStore, type ReactNode } from 'react';
import { BackBar } from '../../components/BackBar';
import { Icon, type IconName } from '../../components/icons/Icon';
import { Switch } from '../../components/Switch';
import { useQuery } from '../../hooks/useQuery';
import { useRole, useUI } from '../../hooks/useStore';
import { ADMIN_DEFAULTS, ADMIN_KEY, checkStaff } from '../../services/admin';
import { isFailureMode, setFailureMode, subscribeFailureMode } from '../../services/demo';
import { IS_DEMO } from '../../services/mode';
import { goBack, navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { FEATURES } from '../../services/features';

interface RowProps {
  icon: IconName;
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
}

function Row({ icon, label, description, onClick, danger = false }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 w-full min-h-14 px-4 py-3 bg-white text-left hover:bg-concrete-50 transition-colors"
    >
      <span
        className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${danger ? 'bg-danger-50' : 'bg-concrete-100'}`}
      >
        <Icon name={icon} size={18} color={danger ? 'var(--red-500)' : 'var(--gray-600)'} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className={`font-semibold ${danger ? 'text-danger-500' : 'text-concrete-900'}`}>{label}</span>
        {description ? <span className="text-sm text-concrete-500">{description}</span> : null}
      </span>
      <Icon name="chevron-right" size={18} color="var(--gray-400)" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <div className="px-4 text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</div>
      ) : null}
      <div className="flex flex-col divide-y divide-concrete-200 bg-white border border-concrete-200 rounded-card overflow-hidden mx-4 sm:mx-0">
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  const role = useRole();
  // L06: the team's area shows up only for staff accounts (the server answers; demo: never).
  useQuery('admin-staff', checkStaff);
  const [admin] = useUI(ADMIN_KEY, ADMIN_DEFAULTS);
  const failing = useSyncExternalStore(subscribeFailureMode, isFailureMode);
  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 gap-6 pb-8 lg:bg-transparent lg:min-h-0">
      <BackBar title="Configurações" onBack={() => goBack(role === 'recrutador' ? '/empresa' : '/perfil')} />
      <div className="flex flex-col gap-6 sm:px-0">
        <Section title="Conta">
          <Row
            icon="user"
            label="Editar perfil"
            onClick={() => navigate(role === 'recrutador' ? '/empresa/editar' : '/perfil/editar')}
          />
          <Row icon="mail" label="Trocar e-mail" onClick={() => navigate('/configuracoes/email')} />
          <Row icon="phone" label="Trocar WhatsApp" onClick={() => navigate('/whatsapp')} />
          <Row icon="lock" label="Trocar senha" onClick={() => navigate('/configuracoes/senha')} />
        </Section>
        <Section title="Preferências">
          <Row
            icon="bell"
            label="Notificações"
            description="O que chega no app e no celular"
            onClick={() => navigate('/configuracoes/avisos')}
          />
          {role === 'recrutador' && FEATURES.payments ? (
            <Row
              icon="receipt"
              label="Pagamentos"
              description="Impulsionamentos, recibos e reembolsos"
              onClick={() => navigate('/pagamentos')}
            />
          ) : null}
          <Row
            icon="ban"
            label="Contas bloqueadas"
            description="Quem você bloqueou"
            onClick={() => navigate('/configuracoes/bloqueados')}
          />
          <Row
            icon="shield-check"
            label="Privacidade e dados"
            description="Exportar ou excluir sua conta"
            onClick={() => navigate('/configuracoes/privacidade')}
          />
        </Section>
        <Section title="Sobre">
          <Row
            icon="circle-help"
            label="Ajuda"
            description="Perguntas frequentes e suporte"
            onClick={() => navigate('/ajuda')}
          />
          <Row icon="file-check" label="Termos de uso" onClick={() => navigate('/termos')} />
          <Row icon="shield-check" label="Política de privacidade" onClick={() => navigate('/privacidade')} />
        </Section>
        {admin.isStaff ? (
          <Section title="Equipe">
            <Row
              icon="shield-check"
              label="Área da equipe"
              description="Identidades, construtoras e denúncias"
              onClick={() => navigate('/admin')}
            />
          </Section>
        ) : null}
        <Section title="">
          <Row icon="log-out" label="Sair da conta" danger onClick={() => askSignOut()} />
          {/* U16: deleting is one tap away from here (it was only inside "Privacidade e dados"). It deletes the
              logged-in account only: the screen asks for its password or an e-mail code. */}
          <Row
            icon="trash-2"
            label="Excluir minha conta"
            description="Apaga sua conta e seus dados da Bicos"
            danger
            onClick={() => navigate('/configuracoes/excluir-conta')}
          />
        </Section>
        {IS_DEMO ? (
          <Section title="Demonstração">
            <div className="px-4 py-1 bg-white">
              <Switch
                label="Simular falhas de conexão"
                description="Para testar: toda ação e carregamento passa a dar erro, com a opção de tentar de novo."
                checked={failing}
                onChange={setFailureMode}
              />
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
