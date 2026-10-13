import { useState } from 'react';
// The worker's portfolio on their profile: photo/video posts (Instagram-style, no likes or comments),
// with the composer and the delete confirmation for their own profile.
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons/Icon';
import { IconButton } from '../../components/IconButton';
import { Dialog, Sheet } from '../../components/Modal';
import { FieldError } from '../../components/FieldError';
import { TextArea } from '../../components/TextArea';
import { useAction } from '../../hooks/useAction';
import { addPortfolioPost, deletePortfolioPost } from '../../services/profiles';
import { showToast } from '../../services/toast';
import { useDb, useScreenUI } from '../../hooks/useStore';
import { mediaUrl } from '../../services/media';
import { postsForWorker } from '../../services/selectors';
import type { Worker, WorkerPost } from '../../types/models';
import { resetFileInput } from '../../utils/fileInput';
import { formatPostDate } from '../../utils/format';
import { ReportSheet } from '../../components/SafetyMenu';
import { PostViewer } from './PostViewer';
import { MAX_CAPTION, portfolioFileProblem } from '../../utils/media';

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
  const [ui, setUi] = useScreenUI<PostsUI>(POSTS_KEY + ':' + worker.id, POSTS_DEFAULTS);
  const posts = postsForWorker(db, worker.id);
  const [viewing, setViewing] = useState<number | null>(null);
  const remove = useAction(deletePortfolioPost, () => {
    setUi({ deleteId: null });
    showToast('Post excluído');
  });
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
          {posts.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              isOwn={isOwn}
              onOpen={() => setViewing(i)}
              onDelete={() => setUi({ deleteId: p.id })}
            />
          ))}
        </div>
      )}
      <PostViewer posts={posts} index={viewing} isOwn={isOwn} onIndex={setViewing} />
      {isOwn ? <Composer ui={ui} setUi={setUi} /> : null}
      {isOwn ? (
        <Dialog
          open={Boolean(ui.deleteId)}
          tone="danger"
          title="Excluir esse post?"
          description="A publicação some do seu perfil imediatamente."
          confirmLabel="Excluir post"
          onConfirm={() => {
            if (ui.deleteId) void remove.run(ui.deleteId);
          }}
          loading={remove.loading}
          error={remove.error}
          cancelLabel="Cancelar"
          onCancel={() => {
            remove.reset();
            setUi({ deleteId: null });
          }}
        />
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  isOwn,
  onOpen,
  onDelete
}: {
  post: WorkerPost;
  isOwn: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [reporting, setReporting] = useState(false);
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
            <button type="button" className="block w-full" aria-label="Ver em tela cheia" onClick={onOpen}>
              <img src={post.mediaUrl} alt="" className="w-full h-72 lg:h-auto lg:aspect-square object-cover" />
            </button>
          )
        ) : (
          <button
            type="button"
            aria-label="Ver em tela cheia"
            onClick={onOpen}
            className="w-full h-72 lg:h-auto lg:aspect-square bg-concrete-200 flex items-center justify-center"
          >
            <Icon name="camera" size={32} color="var(--text-subtle)" />
          </button>
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-concrete-500">{formatPostDate(post.date)}</span>
          {!isOwn ? (
            <button
              type="button"
              className="text-xs font-semibold text-concrete-500 hover:text-danger-500"
              onClick={() => setReporting(true)}
            >
              Denunciar
            </button>
          ) : null}
        </div>
      </div>
      {!isOwn ? (
        <ReportSheet
          open={reporting}
          onClose={() => setReporting(false)}
          target="post"
          targetId={post.id}
          what="o post"
        />
      ) : null}
    </div>
  );
}

interface ComposerProps {
  ui: PostsUI;
  setUi: (patch: Partial<PostsUI>) => void;
}

function Composer({ ui, setUi }: ComposerProps) {
  const closeAndReset = () => setUi({ composing: false, mediaUrl: null, mediaType: 'image', caption: '' });
  const [progress, setProgress] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const publish = useAction(
    async (post: Parameters<typeof addPortfolioPost>[0]) => {
      setProgress(0);
      try {
        await addPortfolioPost(post, setProgress);
      } finally {
        setProgress(null);
      }
    },
    () => {
      closeAndReset();
      showToast('Post publicado');
    }
  );

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
            // F16: photo up to 10 MB, video up to 60 s / 50 MB.
            void portfolioFileProblem(file).then((problem) => {
              setFileError(problem);
              if (problem) return;
              setUi({
                mediaUrl: mediaUrl(file),
                mediaType: file.type.indexOf('video') === 0 ? 'video' : 'image'
              });
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
            <span className="text-xs">Foto até 10 MB · vídeo até 60 segundos</span>
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
          className="w-full px-3 py-2.5 bg-white rounded-control border border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none text-base text-concrete-900 placeholder:text-concrete-500 resize-none transition-colors duration-150"
          onInput={(v) => setUi({ caption: v.slice(0, MAX_CAPTION) })}
        />
        <span className="text-xs text-concrete-500 self-end">{`${ui.caption.length}/${MAX_CAPTION}`}</span>
      </div>
      {fileError ? <FieldError message={fileError} /> : null}
      {publish.error ? <FieldError message={publish.error} /> : null}
      <Button
        label={progress !== null && progress < 1 ? `Enviando… ${Math.round(progress * 100)}%` : 'Publicar'}
        size="lg"
        fullWidth
        disabled={!ui.mediaUrl}
        loading={publish.loading}
        onClick={() => void publish.run({ mediaUrl: ui.mediaUrl, mediaType: ui.mediaType, caption: ui.caption.trim() })}
      />
    </Sheet>
  );
}
