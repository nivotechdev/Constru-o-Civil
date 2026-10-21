// The gear on one's own profile (phones only: below 1024 px there is no top bar with the account menu). U44: it
// opens Configurações straight away — no sheet in between. What the sheet also had is reachable on its own: the
// bell is on top of the mural, the saved jobs in Minhas candidaturas, the closed bicos in Minhas vagas, and Ajuda
// and "Sair da conta" in Configurações.
import { navigate } from '../services/router';
import { IconButton } from './IconButton';

export function SettingsButton() {
  return (
    <div className="lg:hidden">
      <IconButton icon="settings" label="Configurações" variant="solid" onClick={() => navigate('/configuracoes')} />
    </div>
  );
}
