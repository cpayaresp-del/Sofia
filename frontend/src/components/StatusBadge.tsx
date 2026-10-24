type Props = {
  state: 'online' | 'offline' | 'connecting';
  label: string;
};

export function StatusBadge({ state, label }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
      state === 'online' ? 'bg-emerald-50 text-emerald-600' :
      state === 'connecting' ? 'bg-amber-50 text-amber-600' :
      'bg-red-50 text-red-600'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        state === 'online' ? 'bg-emerald-500' :
        state === 'connecting' ? 'bg-amber-500 animate-pulse' :
        'bg-red-500'
      }`} />
      {label}
    </span>
  );
}
