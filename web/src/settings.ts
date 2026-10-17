/** Names are presentation only; settings remain existing typed child refs. */
export const SETTING_LABELS: Record<string, string> = {
  history: 'Version history', name: 'Device name', theme: 'Device theme', microphone: 'Voice / audio', camera: 'Video', geolocation: 'Location',
  server: 'Account server', direct: 'Direct Connect', peer: 'Add peer', invite: 'Invite device (QR)', virtual: 'New virtual peer', phone: 'Connect phone (SMS)', share: 'Share by URL',
  resetHome: 'Reset Home content', resetAccount: 'Reset entire account content', sessions: 'Saved data session', export: 'Export YAML', import: 'Import'
}
export function settingKeyFromName(name?: string): string | null { return name?.startsWith('fos:setting:') ? name.slice(name.lastIndexOf(':') + 1) : null }
