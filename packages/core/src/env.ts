/** Reads the setting `SUMS_<name>` (server side and config files only). */
export function env(name: string): string | undefined {
  return process.env[`SUMS_${name}`];
}
