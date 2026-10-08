/** A label on the left and a monospaced value on the right ("Diária combinada   R$ 180"). */
export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-concrete-500">{label}</span>
      <span className="font-mono font-bold text-concrete-900">{value}</span>
    </div>
  );
}
