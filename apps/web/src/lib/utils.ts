export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
