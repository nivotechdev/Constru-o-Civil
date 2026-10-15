// F07: "Verificar identidade" — a selfie and a photo of the document (front, with the photo), to the team.
import { useEffect, useRef, useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { QueryView } from '../../components/QueryView';
import { PageSkeleton } from '../../components/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { demoApproveIdentity, identityOf, loadMyIdentity, submitIdentity } from '../../services/identity';
import { IDENTITY_CONSENT } from '../../services/legal';
import { IS_DEMO } from '../../services/mode';
import { goBack } from '../../services/router';
import { currentWorker } from '../../services/selectors';
import { showToast } from '../../services/toast';
import { resetFileInput } from '../../utils/fileInput';

function PhotoInput({
  label,
  hint,
  capture,
  value,
  onChange
}: {
  label: string;
  hint: string;
  capture: 'user' | 'environment';
  value: string | null;
  onChange: (url: string) => void;
}) {
  return (
    <label className="relative flex flex-col items-center justify-center gap-1.5 h-44 rounded-card overflow-hidden cursor-pointer bg-concrete-100 border-2 border-dashed border-concrete-300 hover:border-brand-400 text-concrete-500 text-center px-3">
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          resetFileInput(e.target);
          onChange(URL.createObjectURL(file));
        }}
      />
      {value ? (
        <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <>
          <Icon name="camera" size={24} />
          <span className="text-sm font-semibold text-concrete-700">{label}</span>
          <span className="text-xs">{hint}</span>
        </>
      )}
    </label>
  );
}

export default function VerifyIdentity() {
  const db = useDb();
  const worker = currentWorker(db);
  const query = useQuery('my-identity', loadMyIdentity);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const picked = useRef<(string | null)[]>([]);
  useEffect(() => {
    picked.current = [selfie, doc];
  }, [selfie, doc]);
  useEffect(() => () => picked.current.forEach((u) => u && URL.revokeObjectURL(u)), []);
  const send = useAction(submitIdentity, () => showToast('Fotos enviadas. Avisamos quando terminarmos.'));
  const approve = useAction(demoApproveIdentity);
  const status = identityOf(worker);

  return (
    <div className="flex flex-col">
      <BackBar title="Verificar identidade" onBack={() => goBack('/perfil')} />
      <div className="flex flex-col gap-4 px-4 sm:px-0 py-4">
        <QueryView query={query} skeleton={<PageSkeleton />}>
          {() =>
            status === 'verificado' ? (
              <Card padding="md">
                <div className="flex flex-col gap-2">
                  <Badge label="Verificado" tone="success" icon="shield-check" />
                  <span className="text-concrete-700">Sua identidade foi conferida. O selo aparece no seu perfil.</span>
                </div>
              </Card>
            ) : status === 'em_analise' ? (
              <Card padding="md">
                <div className="flex flex-col gap-3">
                  <Badge label="Em análise" tone="warning" icon="clock" />
                  <span className="text-concrete-700">
                    Recebemos suas fotos. Nossa equipe confere e avisa por aqui quando terminar.
                  </span>
                  {IS_DEMO ? (
                    <Button
                      label="Aprovar (demonstração)"
                      variant="secondary"
                      loading={approve.loading}
                      onClick={() => void approve.run()}
                    />
                  ) : null}
                </div>
              </Card>
            ) : (
              <>
                {status === 'recusado' ? (
                  <Card tone="sunken" padding="sm">
                    <div className="flex gap-2.5 items-start">
                      <Icon name="circle-alert" size={20} color="var(--red-500)" />
                      <span className="text-sm text-concrete-700">
                        {`Não conseguimos verificar. ${worker.identityReason ? `Motivo: ${worker.identityReason}. ` : ''}Envie as fotos de novo.`}
                      </span>
                    </div>
                  </Card>
                ) : null}
                <p className="text-concrete-700">
                  Com o selo <strong>Verificado</strong>, as construtoras sabem que você é quem diz ser. As fotos vão só
                  para a nossa equipe e não aparecem para ninguém.
                </p>
                <PhotoInput
                  label="Tirar uma selfie"
                  hint="Rosto inteiro, sem boné nem óculos escuros"
                  capture="user"
                  value={selfie}
                  onChange={setSelfie}
                />
                <PhotoInput
                  label="Foto do documento"
                  hint="RG ou CNH, o lado com a foto, sem reflexo"
                  capture="environment"
                  value={doc}
                  onChange={setDoc}
                />
                {/* L07: consent of its own, highlighted, apart from the terms (LGPD art. 11 — biometric data). */}
                <Card tone="sunken" padding="md">
                  <div className="flex flex-col gap-2" role="group" aria-labelledby="identity-consent-title">
                    <h2 id="identity-consent-title" className="font-bold text-concrete-900">
                      {IDENTITY_CONSENT.title}
                    </h2>
                    <ul className="flex flex-col gap-1 text-sm text-concrete-700 list-disc pl-5">
                      {IDENTITY_CONSENT.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <Checkbox label={IDENTITY_CONSENT.checkbox} checked={consent} onChange={setConsent} />
                  </div>
                </Card>
                {send.error ? <FieldError message={send.error} /> : null}
                <Button
                  label="Enviar para verificação"
                  size="lg"
                  fullWidth
                  disabled={!selfie || !doc || !consent}
                  loading={send.loading}
                  onClick={() => void send.run(selfie ?? '', doc ?? '', consent ? IDENTITY_CONSENT.version : null)}
                />
              </>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
