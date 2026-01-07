export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set.`);
  }
  return value;
}

export function getOptionalEnv(key: string, fallback?: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }
  return value;
}
