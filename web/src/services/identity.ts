// F07: the worker's identity check — a selfie and a photo of the document, to the team. States: não
// enviado, em análise, verificado, recusado (with the reason). Backend: private bucket `identidade`, RPCs
// submit_identity / my_identity; the team decides with set_identity_status (migration 20261013000700).
import type { IdentityStatus } from '../types/models';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { IS_DEMO } from './mode';
import * as store from './store';
import { db, request } from './remote/client';

function workerId(): string {
  const id = store.getSession()?.workerId;
  if (!id) throw serviceError('nao_autorizado', 'Só a conta de trabalhador verifica a identidade.');
  return id;
}

export function identityOf(worker: { identity?: IdentityStatus; verified: boolean } | undefined): IdentityStatus {
  return worker?.identity ?? (worker?.verified ? 'verificado' : 'nao_enviado');
}

/** The worker's own status and the refusal reason. */
export async function loadMyIdentity(): Promise<void> {
  const id = workerId();
  if (IS_DEMO) return mockLatency(150);
  const client = await db();
  const rows = (await request(() => client.rpc('my_identity'))) ?? [];
  const row = rows[0];
  if (row)
    store.updateWorker(id, {
      identity: row.status,
      verified: row.status === 'verificado',
      ...(row.reason ? { identityReason: row.reason } : { identityReason: undefined })
    });
}

/**
 * Sends the two photos (local URLs) for the team to check, with the version of the consent the worker
 * ticked (L07: LGPD art. 11 — specific and highlighted; stored with the submission).
 */
export async function submitIdentity(
  selfieUrl: string,
  documentUrl: string,
  consentVersion: string | null
): Promise<void> {
  const id = workerId();
  if (!selfieUrl || !documentUrl) throw serviceError('validacao', 'Tire a selfie e a foto do documento.');
  if (!consentVersion)
    throw serviceError('validacao', 'Marque que você concorda com o uso das fotos para a verificação.');
  if (!IS_DEMO) {
    const { uploadPrivatePhoto } = await import('./remote/storage');
    const [selfie, doc] = await Promise.all([uploadPrivatePhoto(selfieUrl), uploadPrivatePhoto(documentUrl)]);
    const client = await db();
    await request(() =>
      client.rpc('submit_identity', { p_selfie_path: selfie, p_document_path: doc, p_consent_version: consentVersion })
    );
  } else await mockLatency(900);
  store.updateWorker(id, { identity: 'em_analise', identityReason: undefined });
}

/** Demo only: plays the team's part. Never exists with the real backend. */
export async function demoApproveIdentity(): Promise<void> {
  if (!IS_DEMO) throw serviceError('nao_autorizado');
  await mockLatency(300);
  store.updateWorker(workerId(), { identity: 'verificado', verified: true });
}
