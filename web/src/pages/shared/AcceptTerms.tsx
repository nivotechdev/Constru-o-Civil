// L07 (lançamento): the terms or the privacy policy changed since this account accepted them — it accepts the
// new version before going on (services/guards.ts › homeFor). Both texts open from here, and leaving is always
// possible.
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { useAction } from '../../hooks/useAction';
import { acceptTerms } from '../../services/auth';
import { TERMS } from '../../services/legal';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { formatPostDate } from '../../utils/format';

export default function AcceptTerms() {
  const [checked, setChecked] = useState(false);
  const accept = useAction(acceptTerms, () => navigate('/mural', { replace: true }));
  return (
    <div className="min-h-screen flex flex-col bg-concrete-0 lg:max-w-app lg:mx-auto">
      <div className="flex-1 flex flex-col gap-6 px-5 sm:px-8 pt-12 pb-6">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-50">
          <Icon name="file-check" size={28} color="var(--brand-500)" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-3xl text-concrete-900">Atualizamos nossos termos</h1>
          <p className="text-base text-concrete-700">
            {`Os Termos de uso e a Política de privacidade mudaram (versão ${TERMS.version}, de ${formatPostDate(TERMS.updatedAt)}). Leia e aceite para continuar usando a Bicos.`}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            label="Ler os Termos de uso"
            variant="secondary"
            iconRight="chevron-right"
            onClick={() => navigate('/termos')}
          />
          <Button
            label="Ler a Política de privacidade"
            variant="secondary"
            iconRight="chevron-right"
            onClick={() => navigate('/privacidade')}
          />
        </div>
        <Checkbox
          label="Li e aceito os Termos de uso e a Política de privacidade"
          checked={checked}
          onChange={setChecked}
        />
        {accept.error ? <FieldError message={accept.error} /> : null}
      </div>
      <div className="flex flex-col gap-2 px-5 sm:px-8 py-3">
        <Button
          label="Aceitar e continuar"
          size="lg"
          fullWidth
          disabled={!checked}
          loading={accept.loading}
          onClick={() => void accept.run()}
        />
        <Button label="Sair da conta" variant="ghost" fullWidth onClick={() => askSignOut()} />
      </div>
    </div>
  );
}
