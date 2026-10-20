// "Copiar código" (U17): where the button of the code e-mails lands. An e-mail can't run anything, so its
// "Copiar código" opens this page with the code after the `#` (the part of the address that never goes to the
// server): the page copies it on its own when the browser lets it, and a big button copies it again. Then the
// person goes back to the Bicos and pastes ("Colar código"). Open to anyone: it only shows what came in the link,
// and the code is taken out of the address right away, so it doesn't stay in the history.
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FlowHeading, FlowLayout } from '../../components/FlowLayout';
import { Icon } from '../../components/icons/Icon';
import { navigate } from '../../services/router';
import { CODE_LENGTH, codeFrom } from '../../utils/code';

/** The code in the link (`/copiar-codigo#123456`), read once; the address keeps only the page. */
function takeCodeFromLink(): string {
  const code = codeFrom(decodeURIComponent(window.location.hash.slice(1)));
  if (window.location.hash) history.replaceState(history.state, '', window.location.pathname + window.location.search);
  return code.length === CODE_LENGTH ? code : '';
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function CopyCode() {
  const [code] = useState(takeCodeFromLink);
  const [copied, setCopied] = useState<boolean | null>(null);

  useEffect(() => {
    // Chrome (most of the public) copies without a tap; where the browser asks for one, the button does it.
    if (code) void copy(code).then((ok) => ok && setCopied(true));
  }, [code]);

  const back = () => navigate('/', { replace: true });

  if (!code)
    return (
      <FlowLayout>
        <EmptyState
          icon="mail"
          title="Esse link não tem o código"
          description="Abra de novo o e-mail da Bicos e toque em Copiar código, ou digite os 6 números no app."
          actionLabel="Voltar para a Bicos"
          onAction={back}
        />
      </FlowLayout>
    );

  return (
    <FlowLayout
      footer={
        <>
          <Button
            label={copied ? 'Copiar de novo' : 'Copiar código'}
            size="lg"
            fullWidth
            iconLeft="copy"
            onClick={() => void copy(code).then(setCopied)}
          />
          <Button label="Voltar para a Bicos" variant="ghost" fullWidth onClick={back} />
        </>
      }
    >
      <FlowHeading
        overline="Bicos"
        title="Seu código"
        help="Copie o código, volte para a Bicos e toque em Colar código."
      />
      <div className="flex flex-col items-center gap-4 p-6 rounded-card bg-white border border-concrete-200">
        <span
          className="font-mono font-bold text-5xl tracking-[0.2em] pl-[0.2em] text-concrete-900 select-all"
          aria-label={`Código ${code.split('').join(' ')}`}
        >
          {code}
        </span>
        {copied === true ? (
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-success-500" role="status">
            <Icon name="circle-check" size={20} />
            Código copiado
          </span>
        ) : copied === false ? (
          <span className="text-sm text-concrete-600 text-center" role="status">
            Não deu para copiar sozinho. Toque e segure nos números para copiar.
          </span>
        ) : null}
      </div>
      <p className="text-sm text-concrete-500 text-center">
        Ninguém da Bicos vai pedir esse código por telefone ou WhatsApp. Não passe para ninguém.
      </p>
    </FlowLayout>
  );
}
