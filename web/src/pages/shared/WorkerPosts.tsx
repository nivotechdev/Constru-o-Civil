// The worker's portfolio on their profile: photo/video posts (Instagram-style, no likes or comments),
// with the composer and the delete confirmation for their own profile.
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/IconButton';
import { Dialog, Sheet } from '../../components/Modal';
import { TextArea } from '../../components/TextArea';
import { useDb, useUI } from '../../hooks/useStore';
import { mediaUrl } from '../../services/media';
import { postsForWorker } from '../../services/selectors';
import { addWorkerPost, deleteWorkerPost } from '../../services/store';
import type { Worker, WorkerPost } from '../../types/models';
import { resetFileInput } from '../../utils/fileInput';
import { formatPostDate } from '../../utils/format';

const POSTS_KEY = 'worker-posts';

interface PostsUI {
  composing: boolean;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  caption: string;
  deleteId: string | null;
}
const POSTS_DEFAULTS: PostsUI = { composing: false, mediaUrl: null, mediaType: 'image', caption: '', deleteId: null };

export function WorkerPosts({ worker, isOwn }: { worker: Worker; isOwn: boolean }) {
  const db = useDb();
  const [ui, setUi] = useUI<PostsUI>(POSTS_KEY, POSTS_DEFAULTS);
  const posts = postsForWorker(db, worker.id);
  const firstName = worker.name.split(' ')[0];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">
          {isOwn ? 'Seus trabalhos' : `Trabalhos de ${firstName}`}
        </span>
        {isOwn ? (
          <Button
            label="Publicar"
            variant="ghost"
            size="sm"
            iconLeft="plus"
            onClick={() => setUi({ composing: true })}
          />
        ) : null}
      </div>
      {posts.length === 0 ? (
        <EmptyState
          icon="camera"
          title={isOwn ? 'Mostre o seu trabalho' : 'Nenhum post ainda'}
          description={
            isOwn
              ? 'Publique fotos ou vídeos dos seus bicos para as construtoras verem a qualidade do seu serviço.'
              : `${firstName} ainda não publicou fotos ou vídeos do trabalho.`
          }
          actionLabel={isOwn ? 'Publicar primeiro post' : null}
          onAction={isOwn ? () => setUi({ composing: true }) : null}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} isOwn={isOwn} onDelete={() => setUi({ deleteId: p.id })} />
          ))}
        </div>
      )}
      {isOwn ? <Composer worker={worker} ui={ui} setUi={setUi} /> : null}
      {isOwn ? (
        <Dialog
          open={Boolean(ui.deleteId)}
          tone="danger"
          title="Excluir esse post?"
          description="A publicação some do seu perfil imediatamente."
          confirmLabel="Excluir post"
          onConfirm={() => {
            if (ui.deleteId) deleteWorkerPost(ui.deleteId);
            setUi({ deleteId: null });
          }}
          cancelLabel="Cancelar"
          onCancel={() => setUi({ deleteId: null })}
        />
      ) : null}
    </div>
  );
}

function PostCard({ post, isOwn, onDelete }: { post: WorkerPost; isOwn: boolean; onDelete: () => void }) {
  return (
    <div className="flex flex-col rounded-card overflow-hidden border border-concrete-200 bg-white">
      <div className="relative">
        {post.mediaUrl ? (
          post.mediaType === 'video' ? (
            <video
              src={post.mediaUrl}
              controls
              className="w-full h-72 lg:h-auto lg:aspect-square object-cover bg-concrete-900"
            />
          ) : (
            <img src={post.mediaUrl} alt="" className="w-full h-72 lg:h-auto lg:aspect-square object-cover" />
          )
        ) : (
          <div className="w-full h-72 lg:h-auto lg:aspect-square bg-concrete-200 flex items-center justify-center">
            <Icon name="camera" size={32} color="var(--text-subtle)" />
          </div>
        )}
        {post.mediaType === 'video' ? (
          <span className="absolute top-2.5 left-2.5">
            <Badge label="Vídeo" tone="neutral" />
          </span>
        ) : null}
        {isOwn ? (
          <span className="absolute top-2.5 right-2.5">
            <IconButton icon="trash-2" label="Excluir post" variant="solid" size="sm" onClick={onDelete} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        {post.caption ? <p className="text-sm text-concrete-800 leading-relaxed">{post.caption}</p> : null}
        <span className="text-xs text-concrete-400">{formatPostDate(post.date)}</span>
      </div>
    </div>
  );
}

interface ComposerProps {
  worker: Worker;
  ui: PostsUI;
  setUi: (patch: Partial<PostsUI>) => void;
}

function Composer({ worker, ui, setUi }: ComposerProps) {
  const closeAndReset = () => setUi({ composing: false, mediaUrl: null, mediaType: 'image', caption: '' });

  return (
    <Sheet open={ui.composing} title="Publicar trabalho" onClose={closeAndReset}>
      <label
        className="relative flex items-center justify-center overflow-hidden cursor-pointer bg-concrete-100 border-2 border-dashed border-concrete-300 hover:border-brand-400 rounded-card w-full transition-colors"
        style={{ height: '12rem' }}
      >
        <input
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            resetFileInput(e.target);
            setUi({
              mediaUrl: mediaUrl(file),
              mediaType: file.type.indexOf('video') === 0 ? 'video' : 'image'
            });
          }}
        />
        {ui.mediaUrl ? (
          ui.mediaType === 'video' ? (
            <video src={ui.mediaUrl} controls className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <img src={ui.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-concrete-500 px-3 text-center">
            <Icon name="camera" size={24} />
            <span className="text-xs font-semibold">Toque para escolher uma foto ou vídeo</span>
          </span>
        )}
      </label>
      <div className="flex flex-col gap-1.5 w-full">
        <label htmlFor="worker-post-caption" className="text-sm font-semibold text-concrete-900">
          Descrição
        </label>
        <TextArea
          id="worker-post-caption"
          rows={3}
          placeholder="Conte o que foi feito nesse bico..."
          value={ui.caption}
          className="w-full px-3 py-2.5 bg-white rounded-control border border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150"
          onInput={(v) => setUi({ caption: v })}
        />
      </div>
      <Button
        label="Publicar"
        size="lg"
        fullWidth
        disabled={!ui.mediaUrl}
        onClick={() => {
          addWorkerPost(worker.id, { mediaUrl: ui.mediaUrl, mediaType: ui.mediaType, caption: ui.caption.trim() });
          closeAndReset();
        }}
      />
    </Sheet>
  );
}
