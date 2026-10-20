// F16: a portfolio post in full screen — swipe (or the arrows) to the next one; the owner edits the caption.
import { useModal } from '../../hooks/useModal';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { IconButton } from '../../components/IconButton';
import { Icon } from '../../components/icons/Icon';
import { TextArea } from '../../components/TextArea';
import { useAction } from '../../hooks/useAction';
import { updatePostCaption } from '../../services/profiles';
import { showToast } from '../../services/toast';
import type { WorkerPost } from '../../types/models';
import { formatPostDate } from '../../utils/format';
import { MAX_CAPTION } from '../../utils/media';

interface PostViewerProps {
  posts: WorkerPost[];
  index: number | null;
  isOwn: boolean;
  onIndex: (i: number | null) => void;
}

export function PostViewer({ posts, index, isOwn, onIndex }: PostViewerProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const open = index !== null && Boolean(posts[index]);
  const modalRef = useModal(open, () => onIndex(null));
  const save = useAction(updatePostCaption, () => {
    setEditing(null);
    showToast('Legenda salva');
  });
  if (index === null || !posts[index]) return null;
  const post = posts[index];
  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < posts.length) {
      setEditing(null);
      onIndex(next);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col text-white"
      style={{ background: 'rgba(10, 12, 16, 0.97)' }}
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Trabalho"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="flex items-center justify-between px-2 min-h-14">
        <span className="px-2 text-sm text-white/70">{`${index + 1} de ${posts.length}`}</span>
        <IconButton icon="x" label="Fechar" variant="solid" onClick={() => onIndex(null)} />
      </div>
      <div
        className="relative flex-1 flex items-center justify-center min-h-0"
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || Math.abs(end - start) < 50) return;
          go(end < start ? 1 : -1);
        }}
      >
        {post.mediaUrl ? (
          post.mediaType === 'video' ? (
            <video key={post.id} src={post.mediaUrl} controls autoPlay className="max-w-full max-h-full" />
          ) : (
            <img
              key={post.id}
              src={post.mediaUrl}
              alt={post.caption || 'Trabalho'}
              className="max-w-full max-h-full object-contain"
            />
          )
        ) : (
          <div className="w-64 h-64 rounded-card bg-white/10 flex items-center justify-center">
            <Icon name="camera" size={40} color="rgba(255,255,255,0.6)" />
          </div>
        )}
        {index > 0 ? (
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <IconButton icon="chevron-left" label="Anterior" variant="solid" onClick={() => go(-1)} />
          </div>
        ) : null}
        {index < posts.length - 1 ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <IconButton icon="chevron-right" label="Próximo" variant="solid" onClick={() => go(1)} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 px-4 py-4 max-w-app w-full mx-auto">
        {editing !== null ? (
          <>
            <TextArea
              id="post-legenda"
              rows={3}
              value={editing}
              className="w-full px-3 py-2.5 bg-concrete-0 rounded-control border outline-none text-base text-concrete-900 resize-none"
              onInput={(v) => setEditing(v.slice(0, MAX_CAPTION))}
            />
            <span className="text-xs text-white/60 self-end">{`${editing.length}/${MAX_CAPTION}`}</span>
            {save.error ? <FieldError message={save.error} /> : null}
            <div className="flex gap-2">
              <Button label="Cancelar" variant="secondary" className="flex-1" onClick={() => setEditing(null)} />
              <Button
                label="Salvar"
                className="flex-1"
                loading={save.loading}
                onClick={() => void save.run(post.id, editing)}
              />
            </div>
          </>
        ) : (
          <>
            {post.caption ? <p className="text-sm leading-relaxed">{post.caption}</p> : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/60">{formatPostDate(post.date)}</span>
              {isOwn ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-white underline"
                  onClick={() => setEditing(post.caption)}
                >
                  Editar legenda
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
