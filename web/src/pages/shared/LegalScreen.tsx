import { BackBar } from '../../components/BackBar';
import { Icon } from '../../components/icons/Icon';
import { LEGAL_REVIEWED, PRIVACY, TERMS, type LegalDocument } from '../../services/legal';
import { goBack } from '../../services/router';
import { formatPostDate } from '../../utils/format';

/** Terms of use or privacy policy, readable with or without an account. */
function LegalScreen({ doc }: { doc: LegalDocument }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[44rem] mx-auto flex flex-col">
        <BackBar title={doc.title} onBack={() => goBack('/splash')} />
        <article className="flex flex-col gap-6 px-5 sm:px-8 py-6 pb-12">
          {/* L07: the notice goes away only after the lawyer's review (services/legal.ts › LEGAL_REVIEWED). */}
          {LEGAL_REVIEWED ? null : (
            <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-warning-50 border border-warning-100 text-sm text-concrete-800">
              <Icon name="triangle-alert" size={18} color="var(--amber-500)" />
              <span>
                <strong>Rascunho para revisão jurídica.</strong> Este texto é um modelo e ainda vai ser revisado antes
                do lançamento.
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h1 className="font-display font-bold text-3xl text-concrete-900">{doc.title}</h1>
            <span className="text-sm text-concrete-500">{`Versão ${doc.version} · atualizada em ${formatPostDate(doc.updatedAt)}`}</span>
          </div>
          {doc.sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-2">
              <h2 className="font-semibold text-lg text-concrete-900">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="text-concrete-700 leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

export function TermsScreen() {
  return <LegalScreen doc={TERMS} />;
}

export function PrivacyPolicyScreen() {
  return <LegalScreen doc={PRIVACY} />;
}
