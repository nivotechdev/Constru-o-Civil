// The account menu on phones (Z05): below 770 px there is no top bar, so the profile's gear opens this
// sheet — the same entries as the desktop dropdown (Configurações, salvas/histórico, notificações, ajuda)
// and "Sair da conta".
import { useState } from 'react';
import { ACCOUNT_MENU } from '../layouts/accountMenu';
import { navigate } from '../services/router';
import { askSignOut } from '../services/sharedUI';
import type { Role } from '../types/models';
import { Icon } from './icons/Icon';
import { IconButton } from './IconButton';
import { Sheet } from './Modal';

/** The gear (phones only) and its sheet. */
export function AccountMenuButton({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };
  const entries = ACCOUNT_MENU[role].filter((e) => e.path !== '/perfil' && e.path !== '/empresa');
  return (
    <>
      <div className="lg:hidden">
        <IconButton
          icon="settings"
          label="Menu da conta e configurações"
          variant="solid"
          onClick={() => setOpen(true)}
        />
      </div>
      <Sheet open={open} title="Sua conta" onClose={() => setOpen(false)}>
        <nav aria-label="Menu da conta" className="flex flex-col -mx-1">
          {entries.map((e) => (
            <button
              key={e.path}
              type="button"
              className="flex items-center gap-3 min-h-12 px-3 rounded-control text-left text-base text-concrete-800 hover:bg-concrete-50"
              onClick={() => go(e.path)}
            >
              <Icon name={e.icon} size={20} color="var(--gray-500)" />
              <span className="flex-1">{e.label}</span>
              <Icon name="chevron-right" size={18} color="var(--gray-400)" />
            </button>
          ))}
          <div className="h-px bg-concrete-200 my-2" />
          <button
            type="button"
            className="flex items-center gap-3 min-h-12 px-3 rounded-control text-left text-base font-semibold text-danger-500 hover:bg-danger-50"
            onClick={() => {
              setOpen(false);
              askSignOut();
            }}
          >
            <Icon name="log-out" size={20} color="var(--red-500)" />
            Sair da conta
          </button>
        </nav>
      </Sheet>
    </>
  );
}
