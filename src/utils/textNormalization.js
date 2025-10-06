export const normalizeArabicText = (text) => {
  if (!text) return '';
  
  return text
    .replace(/[أإآا]/g, 'ا')
    .replace(/[يی]/g, 'ي')
    .replace(/[كک]/g, 'ك')
    .replace(/[ةه]/g, 'ه')
    .replace(/[\u064B-\u065F]/g, '')
    .toLowerCase()
    .trim();
};

export const searchMatches = (text, searchTerm) => {
  if (!searchTerm) return true;
  const normalizedText = normalizeArabicText(text);
  const normalizedSearch = normalizeArabicText(searchTerm);
  return normalizedText.includes(normalizedSearch);
};