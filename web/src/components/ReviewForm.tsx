import { useState } from 'react';
import { cx } from '../utils/cx';
import { Button } from './Button';
import { Card } from './Card';
import { FieldError } from './FieldError';
import { Icon } from './icons/Icon';
import { Tag } from './Tag';
import { TextArea } from './TextArea';

const LABELS = ['', 'Muito ruim', 'Ruim', 'Ok', 'Bom', 'Excelente'];

/** Five big star buttons (keyboard and screen-reader friendly); nothing is picked until the person taps. */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i ? 'true' : 'false'}
            aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}: ${LABELS[i]}`}
            className="inline-flex items-center justify-center w-12 h-12 rounded-full hover:bg-concrete-100"
            onClick={() => onChange(i)}
          >
            <Icon name="star" size={30} color={i <= value ? 'var(--amber-500)' : 'var(--gray-300)'} />
          </button>
        ))}
      </div>
      <span className={cx('text-sm font-semibold', value ? 'text-concrete-900' : 'text-concrete-500')}>
        {value ? LABELS[value] : 'Toque nas estrelas para dar a nota'}
      </span>
    </div>
  );
}

export interface ReviewFormValues {
  value: number;
  tags: string[];
  comment: string;
}

interface ReviewFormProps {
  /** "Sua nota para a construtora". */
  question: string;
  tags: string[];
  commentHint: string;
  maxComment: number;
  loading: boolean;
  error: string | null;
  onSubmit: (values: ReviewFormValues) => void;
}

/** The review form both sides use: stars (required), ready-made points and a short comment. */
export function ReviewForm({ question, tags, commentHint, maxComment, loading, error, onSubmit }: ReviewFormProps) {
  const [value, setValue] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  return (
    <div className="flex flex-col gap-5">
      <Card padding="md">
        <div className="flex flex-col items-center gap-3">
          <span className="font-semibold text-concrete-900">{question}</span>
          <StarPicker value={value} onChange={setValue} />
        </div>
      </Card>
      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">O que aconteceu</div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Tag
              key={t}
              label={t}
              selected={picked.includes(t)}
              onClick={() => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        <label htmlFor="review-comment" className="text-sm font-semibold text-concrete-900">
          Quer escrever algo? (opcional)
        </label>
        <TextArea
          id="review-comment"
          rows={4}
          placeholder="Conte em poucas palavras como foi."
          value={comment}
          className="w-full px-3 py-2.5 bg-concrete-0 rounded-control border border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none text-base text-concrete-900 placeholder:text-concrete-500 resize-none transition-colors duration-150"
          onInput={(v) => setComment(v.slice(0, maxComment))}
        />
        <div className="flex justify-between gap-3 text-sm text-concrete-500">
          <span>{commentHint}</span>
          <span className="shrink-0 font-mono">{`${comment.length}/${maxComment}`}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {error ? <FieldError message={error} /> : null}
        <Button
          label="Enviar avaliação"
          size="lg"
          fullWidth
          disabled={!value}
          loading={loading}
          onClick={() => onSubmit({ value, tags: picked, comment })}
        />
        {!value ? <span className="text-center text-xs text-concrete-500">Escolha a nota para enviar.</span> : null}
      </div>
    </div>
  );
}

/** "Essa avaliação não está disponível" (not concluded yet, already reviewed, or not yours). */
export function ReviewUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 px-6 py-12">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-concrete-100">
        <Icon name="star" size={30} color="var(--text-subtle)" />
      </span>
      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-base font-bold text-concrete-900">Essa avaliação não está disponível</h3>
        <p className="text-sm text-concrete-500">
          A avaliação abre depois que a diária é concluída, e cada lado avalia uma vez só.
        </p>
      </div>
      <Button label="Voltar" variant="secondary" size="sm" onClick={onBack} />
    </div>
  );
}
