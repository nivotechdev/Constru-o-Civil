import { navigate } from '../services/router';
import { Button } from './Button';

/** Full-screen "not found" for a profile or job opened from a stale link, with the way back to the mural. */
export function NotFound({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-concrete-500">{message}</p>
      <Button label="Voltar ao mural" variant="secondary" onClick={() => navigate('/mural')} />
    </div>
  );
}

/** What the screens of a job's flow (confirm, sent, manage, boost…) show for an unknown job id. */
export function JobNotFound() {
  return <div className="p-6 text-concrete-500">Vaga não encontrada.</div>;
}
