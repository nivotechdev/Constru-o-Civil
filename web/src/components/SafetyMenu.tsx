// F04: "Denunciar" and "Bloquear" — the flag button on a job, a profile; and the report sheet alone for a
// review or a post.
import { useState } from 'react';
import { useAction } from '../hooks/useAction';
import { blockAccount, REPORT_REASONS, reportContent } from '../services/safety';
import { showToast } from '../services/toast';
import type { ReportReason, ReportTarget } from '../types/models';
import { Button } from './Button';
import { FieldError } from './FieldError';
import { IconButton } from './IconButton';
import { Sheet } from './Modal';
import { Tag } from './Tag';
import { TextArea } from './TextArea';

interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
  targetId: string;
  /** "a vaga", "o perfil", "a avaliação", "o post". */
  what: string;
}

export function ReportSheet({ open, onClose, target, targetId, what }: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const send = useAction(
    () => reportContent(target, targetId, reason ?? ('' as ReportReason), details),
    () => {
      showToast('Denúncia enviada. Nossa equipe vai olhar.');
      setReason(null);
      setDetails('');
      onClose();
    }
  );
  return (
    <Sheet open={open} title={`Denunciar ${what}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo">
          {REPORT_REASONS.map((r) => (
            <Tag key={r.id} label={r.label} selected={reason === r.id} onClick={() => setReason(r.id)} />
          ))}
        </div>
        <TextArea
          id="denuncia-detalhes"
          rows={3}
          placeholder="Conte o que aconteceu (opcional)"
          value={details}
          className="w-full px-3 py-2.5 bg-white rounded-control border border-concrete-300 outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          onInput={(v) => setDetails(v.slice(0, 500))}
        />
        {send.error ? <FieldError message={send.error} /> : null}
        <Button
          label="Enviar denúncia"
          fullWidth
          disabled={!reason}
          loading={send.loading}
          onClick={() => void send.run()}
        />
        <span className="text-xs text-concrete-500">
          A denúncia é anônima para o outro lado. Se for urgente ou envolver risco, fale também com a polícia.
        </span>
      </div>
    </Sheet>
  );
}

interface SafetyMenuProps {
  target: ReportTarget;
  targetId: string;
  what: string;
  /** Who can be blocked from here (profile id) and their name; absent = report only. */
  block?: { id: string; name: string; onBlocked?: () => void };
  /** Over a photo (profile cover): the white round button. */
  solid?: boolean;
}

/** The flag in a header: report, and block when there is someone to block. */
export function SafetyMenu({ target, targetId, what, block, solid = false }: SafetyMenuProps) {
  const [menu, setMenu] = useState<'menu' | 'denunciar' | 'bloquear' | null>(null);
  const blockIt = useAction(
    () => blockAccount(block?.id ?? ''),
    () => {
      showToast(`${block?.name ?? 'Conta'} bloqueado. Você não vai mais ver nem ser visto por essa conta.`);
      setMenu(null);
      block?.onBlocked?.();
    }
  );
  return (
    <>
      <IconButton
        icon="flag"
        label="Denunciar ou bloquear"
        variant={solid ? 'solid' : undefined}
        onClick={() => setMenu('menu')}
      />
      <Sheet open={menu === 'menu'} title="O que você quer fazer?" onClose={() => setMenu(null)}>
        <div className="flex flex-col gap-2">
          <Button
            label={`Denunciar ${what}`}
            variant="secondary"
            fullWidth
            iconLeft="flag"
            onClick={() => setMenu('denunciar')}
          />
          {block ? (
            <Button
              label={`Bloquear ${block.name}`}
              variant="secondary"
              fullWidth
              iconLeft="ban"
              onClick={() => setMenu('bloquear')}
            />
          ) : null}
        </div>
      </Sheet>
      <ReportSheet
        open={menu === 'denunciar'}
        onClose={() => setMenu(null)}
        target={target}
        targetId={targetId}
        what={what}
      />
      {block ? (
        <Sheet open={menu === 'bloquear'} title={`Bloquear ${block.name}?`} onClose={() => setMenu(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-concrete-700">
              As vagas e o perfil somem para você, candidaturas e convites entre vocês que estavam esperando saem, e
              ninguém de vocês dois se candidata ou convida o outro. Dá para desbloquear em Configurações.
            </p>
            {blockIt.error ? <FieldError message={blockIt.error} /> : null}
            <Button label="Bloquear" fullWidth loading={blockIt.loading} onClick={() => void blockIt.run()} />
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
