export type SupportedPlatform = 'twitch' | 'youtube' | 'kick' | 'tiktok';

export function detectPlatform(url: string): SupportedPlatform {
  if (url.includes('twitch.tv')) return 'twitch';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('kick.com')) return 'kick';
  if (url.includes('tiktok.com')) return 'tiktok';
  return 'twitch';
}
