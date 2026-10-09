import { navigate } from '../services/router';
import { Button } from './Button';
import { Icon } from './icons/Icon';

interface ErrorStateProps {
  /** What failed, already in plain words (from the service). */
  message?: string | null;
  /** No connection: the copy says so instead of blaming the app. */
  offline?: boolean;
  onRetry: () => void;
  /** Also offer the way back to the mural (full-screen errors). */
  showHome?: boolean;
}

/** A screen (or block) whose data didn't load: what happened and "Tentar de novo". */
export function ErrorState({ message, offline = false, onRetry, showHome = false }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center text-center gap-4 px-6 py-12">
      <span
        className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${offline ? 'bg-concrete-100' : 'bg-danger-50'}`}
      >
        <Icon
          name={offline ? 'wifi-off' : 'circle-alert'}
          size={30}
          color={offline ? 'var(--gray-500)' : 'var(--red-500)'}
        />
      </span>
      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-base font-bold text-concrete-900">
          {offline ? 'Sem internet' : 'Não conseguimos carregar'}
        </h3>
        <p className="text-sm text-concrete-500">
          {offline
            ? 'Confira sua conexão. Quando o sinal voltar, toque em "Tentar de novo".'
            : message || 'Alguma coisa falhou do nosso lado. Toque para tentar de novo.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button label="Tentar de novo" variant="secondary" size="sm" iconLeft="refresh-cw" onClick={onRetry} />
        {showHome ? (
          <Button label="Voltar ao início" variant="ghost" size="sm" onClick={() => navigate('/mural')} />
        ) : null}
      </div>
    </div>
  );
}
