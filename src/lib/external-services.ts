export function serviceLoginUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const defaultMoodleUrl = "https://merlinhr.gnomio.com/my/";
export function moodleLoginUrl(value: string | undefined) {
  return serviceLoginUrl(value?.trim() || defaultMoodleUrl);
}
