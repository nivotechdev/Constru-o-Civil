// U32/U34: a titled block of a profile ("Sobre", "Experiências"), and the call to fill it on one's own profile.
import type { ReactNode } from 'react';
import { Card } from './Card';
import { Icon } from './icons/Icon';

export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{title}</h2>
      {children}
    </section>
  );
}

/** The presentation text, as written (line breaks kept). */
export function AboutText({ text }: { text: string }) {
  return (
    <Card padding="md">
      <p className="text-base text-concrete-700 whitespace-pre-line break-words">{text}</p>
    </Card>
  );
}

/** On one's own profile, while a part is empty: what to write, one tap from the edit screen. */
export function FillProfileCard({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <Card tone="sunken" padding="sm" onClick={onClick}>
      <div className="flex items-center gap-2.5">
        <Icon name="pencil" size={18} color="var(--text-subtle)" />
        <span className="flex-1 text-sm text-concrete-700">{text}</span>
        <Icon name="chevron-right" size={16} color="var(--text-subtle)" />
      </div>
    </Card>
  );
}

/** U38: the worker's experiences, as the same pills the edit screen uses (read only). */
export function ExperiencePills({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((e) => (
        <li
          key={e}
          className="inline-flex items-center max-w-full min-h-8 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-[0.8125rem] leading-snug font-medium text-brand-700 break-words"
        >
          {e}
        </li>
      ))}
    </ul>
  );
}
