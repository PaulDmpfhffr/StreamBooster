interface Props {
  screenshots: Record<number, string>;
  instanceCount: number;
}

export function ScreenshotGrid({ screenshots, instanceCount }: Props) {
  const cols = instanceCount <= 2 ? 2 : instanceCount <= 4 ? 2 : 3;

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: instanceCount }, (_, i) => i + 1).map((idx) => (
        <div
          key={idx}
          className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
        >
          {screenshots[idx] ? (
            <img
              src={screenshots[idx]}
              alt={`Instance ${idx}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            #{idx}
          </div>
        </div>
      ))}
    </div>
  );
}
