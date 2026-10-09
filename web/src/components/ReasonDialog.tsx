import { useState } from 'react';
import { Input } from './Input';
import { Dialog } from './Modal';
import { Radio } from './Radio';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** The usual reasons; "Outro motivo" (typed) is always offered last. */
  reasons: string[];
  confirmLabel: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const OTHER = 'Outro motivo';

/** A confirmation that asks why (desistência, cancelamento…). The button waits for a reason. */
export function ReasonDialog(props: ReasonDialogProps) {
  // A fresh choice every time it opens.
  return props.open ? <ReasonDialogBody {...props} /> : null;
}

function ReasonDialogBody({
  title,
  description,
  reasons,
  confirmLabel,
  loading = false,
  error = null,
  onConfirm,
  onCancel
}: ReasonDialogProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const reason = choice === OTHER ? other.trim() : choice;
  return (
    <Dialog
      open
      tone="danger"
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel="Voltar"
      loading={loading}
      error={error}
      confirmDisabled={!reason}
      onConfirm={() => reason && onConfirm(reason)}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Motivo">
        {[...reasons, OTHER].map((r) => (
          <Radio key={r} name="motivo" label={r} checked={choice === r} onChange={() => setChoice(r)} />
        ))}
        {choice === OTHER ? (
          <Input
            id="reason-other"
            placeholder="Conte em poucas palavras"
            value={other}
            maxLength={120}
            onInput={setOther}
          />
        ) : null}
      </div>
    </Dialog>
  );
}
