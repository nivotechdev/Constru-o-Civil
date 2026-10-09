// The account's WhatsApp in "Editar perfil" / "Editar empresa" (Y25): the number, whether it is
// confirmed, and "Trocar", which opens its own screen (with the code when it is set up).
import { useDb, useSession } from '../hooks/useStore';
import { navigate } from '../services/router';
import { maskPhone } from '../utils/format';
import { Icon } from './icons/Icon';

export function WhatsAppRow({ label }: { label: string }) {
  const session = useSession();
  const db = useDb();
  const account = session ? db.accounts[session.accountId] : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-concrete-900">{label}</span>
      <div className="flex items-center gap-3 min-h-12 px-3.5 py-2 rounded-control bg-white border border-concrete-300">
        <Icon name="phone" size={20} color="var(--text-subtle)" />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="font-mono text-concrete-900 truncate">
            {account?.whatsapp ? maskPhone(account.whatsapp) : 'Nenhum número'}
          </span>
          <span className="text-xs text-concrete-500">
            {account?.whatsappVerifiedAt ? 'Confirmado' : 'Sem confirmação'}
          </span>
        </span>
        <button
          type="button"
          className="inline-flex items-center h-9 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 shrink-0"
          onClick={() => navigate('/whatsapp')}
        >
          Trocar
        </button>
      </div>
    </div>
  );
}
