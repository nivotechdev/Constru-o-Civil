import { Icon } from './icons/Icon';

/** Validation message under a field (or a group of fields): alert icon + red text. */
export function FieldError({ message }: { message: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-danger-500">
      <Icon name="circle-alert" size={14} />
      {message}
    </span>
  );
}
