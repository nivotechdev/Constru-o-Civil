import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { Dialog } from '../../components/Modal';
import { useUI } from '../../hooks/useStore';
import { exportMyData } from '../../services/account';
import { goBack, navigate } from '../../services/router';

interface PrivacyUI {
  exporting: boolean;
  exported: boolean;
  confirmDelete: boolean;
}

export default function Privacy() {
  const [ui, setUi] = useUI<PrivacyUI>('privacy', { exporting: false, exported: false, confirmDelete: false });

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 gap-5 pb-8 lg:bg-transparent lg:min-h-0">
      <BackBar title="Privacidade e dados" onBack={() => goBack('/configuracoes')} />
      <div className="flex flex-col gap-5 px-4 sm:px-0">
        <p className="text-sm text-concrete-600">
          De acordo com a LGPD, você pode baixar uma cópia de tudo o que a Bicos guarda sobre você, ou excluir sua conta
          e seus dados por completo.
        </p>

        <Card padding="md">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <Icon name="download" size={20} color="var(--text-subtle)" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-concrete-900">Exportar meus dados</span>
                <span className="text-sm text-concrete-600">
                  Perfil, candidaturas, avaliações e mensagens em um arquivo único.
                </span>
              </div>
            </div>
            {ui.exported ? (
              <span className="flex items-center gap-2 text-sm text-success-500 font-semibold">
                <Icon name="circle-check" size={16} color="var(--green-500)" />
                Arquivo enviado para o seu e-mail.
              </span>
            ) : (
              <Button
                label="Exportar meus dados"
                variant="secondary"
                loading={ui.exporting}
                onClick={() => {
                  setUi({ exporting: true });
                  exportMyData().then(() => setUi({ exporting: false, exported: true }));
                }}
              />
            )}
          </div>
        </Card>

        <Card padding="md" className="border-danger-100">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <Icon name="triangle-alert" size={20} color="var(--red-500)" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-danger-500">Excluir minha conta</span>
                <span className="text-sm text-concrete-600">
                  Remove seu perfil, candidaturas e histórico. Essa ação não pode ser desfeita.
                </span>
              </div>
            </div>
            <Button label="Excluir minha conta" variant="danger" onClick={() => setUi({ confirmDelete: true })} />
          </div>
        </Card>
      </div>
      <Dialog
        open={ui.confirmDelete}
        tone="danger"
        title="Excluir sua conta?"
        description="Isso apaga seu perfil, candidaturas e histórico da Bicos para sempre. Não dá para desfazer."
        confirmLabel="Sim, excluir conta"
        onConfirm={() => navigate('/login')}
        cancelLabel="Cancelar"
        onCancel={() => setUi({ confirmDelete: false })}
      />
    </div>
  );
}
