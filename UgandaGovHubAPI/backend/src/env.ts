export function positiveIntegerEnv(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env) {
  const rawValue = env[name];
  if (!rawValue) return fallback;
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
