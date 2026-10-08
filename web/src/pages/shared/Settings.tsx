import type { ReactNode } from 'react';
import { BackBar } from '../../components/BackBar';
import { Icon, type IconName } from '../../components/icons/Icon';
import { useRole } from '../../hooks/useStore';
import { goBack, navigate } from '../../services/router';

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
          <Row icon="lock" label="Trocar senha" onClick={() => navigate('/esqueci-senha')} />
        </Section>
        <Section title="Preferências">
          <Row
            icon="bell"
            label="Notificações"
            description="Bicos urgentes, candidaturas e mensagens"
            onClick={() => navigate('/notificacoes')}
          />
          <Row
            icon="shield-check"
            label="Privacidade e dados"
            description="Exportar ou excluir sua conta"
            onClick={() => navigate('/configuracoes/privacidade')}
          />
        </Section>
        <Section title="Sobre">
          <Row icon="file-check" label="Termos de uso" onClick={() => {}} />
          <Row icon="shield-check" label="Política de privacidade" onClick={() => {}} />
        </Section>
        <Section title="">
          <Row icon="log-out" label="Sair da conta" danger onClick={() => navigate('/login')} />
        </Section>
      </div>
    </div>
  );
}
