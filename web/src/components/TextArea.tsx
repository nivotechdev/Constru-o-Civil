import { useTextField } from '../hooks/useTextField';

interface TextAreaProps {
  id: string;
  rows?: number;
  placeholder?: string;
  value: string;
  className: string;
  onInput: (value: string) => void;
  /** What the person typed or pasted is cut at this many characters. */
  maxLength?: number;
  'aria-describedby'?: string;
  'aria-invalid'?: 'true';
}

/** Plain controlled <textarea> (the legacy app styled each one inline, so styling stays with the caller). */
export function TextArea({ id, rows = 3, placeholder, value, className, onInput, maxLength, ...aria }: TextAreaProps) {
  const [fieldRef, handleChange] = useTextField<HTMLTextAreaElement>(onInput);
  return (
    <textarea
      ref={fieldRef}
      id={id}

      rows={rows}
      placeholder={placeholder}
      value={value}
      className={className}
      maxLength={maxLength}
      {...aria}
      onChange={handleChange}
    />
  );
}
