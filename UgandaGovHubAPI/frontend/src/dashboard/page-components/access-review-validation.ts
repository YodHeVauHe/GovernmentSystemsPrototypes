const maxReviewTextLength = 2000;

function hasUnsupportedControlCharacters(value: string) {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13);
  });
}

export function sanitizeAccessReviewText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > maxReviewTextLength || hasUnsupportedControlCharacters(trimmed)) return null;
  return trimmed;
}
