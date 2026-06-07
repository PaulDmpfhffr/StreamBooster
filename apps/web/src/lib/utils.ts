export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(Math.floor(Math.log(abs) / Math.log(1024)), units.length - 1);
  return `${sign}${(abs / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
