import { formatBytes } from '../lib/utils';

interface Props {
  remaining: number;
  total?: number;
}

export function BandwidthBar({ remaining, total }: Props) {
  const pct = total ? Math.min(100, (remaining / total) * 100) : 100;
  const color = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 whitespace-nowrap">BP restante</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-white whitespace-nowrap">{formatBytes(remaining)}</span>
    </div>
  );
}
