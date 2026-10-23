/** Names are presentation only; settings remain existing typed child refs. */
export const SETTING_LABELS: Record<string, string> = {
  history: 'Version history', name: 'Device name', theme: 'Device theme', microphone: 'Voice / audio', camera: 'Video', geolocation: 'Location',
  server: 'Account server', direct: 'Direct Connect', invite: 'Invite device (QR)', virtual: 'New virtual peer', phone: 'Connect phone (SMS)', share: 'Share by URL',
  view: 'Last viewed', resetHome: 'Reset Home content', resetAccount: 'Reset entire account content', sessions: 'Saved data session', export: 'Export YAML', import: 'Import'
}
/** The key of a setting row (a named value a device holds, shared/sync `settingOf`), else null. */
export function settingKeyOf(row?: { construction?: { name?: string; holder?: string } } | null): string | null { return row?.construction?.holder ? row.construction.name ?? null : null }
