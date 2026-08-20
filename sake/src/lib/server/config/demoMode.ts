export function isDemoMode(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.SAKE_DEMO_MODE?.trim() ?? "");
}
