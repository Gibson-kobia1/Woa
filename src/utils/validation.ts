export const isValidDigitCode = (value: string, expectedLength: number) => {
  const normalized = value.trim();
  return normalized.length === expectedLength && /^\d+$/.test(normalized);
};
