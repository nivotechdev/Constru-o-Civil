import { Icon } from './icons/Icon';

/** Validation message under a field (or a group of fields): alert icon + red text, read out when it appears. */
export function FieldError({ message, id }: { message: string; id?: string }) {
  return (
    <span id={id} role="alert" className="flex items-center gap-1.5 text-sm text-danger-500">
      <Icon name="circle-alert" size={14} />
      {message}
    </span>
  );
}
