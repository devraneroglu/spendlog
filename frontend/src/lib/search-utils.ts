/**
 * SpendLog V2 — Profesyonel Arama & Normalizasyon Motoru
 * 
 * Türkçe karakter duyarlılığı (İ/i, I/ı, Ş/s, Ğ/g, Ü/u, Ö/o, Ç/c),
 * Unicode NFD ayrıştırması, çoklu terim (tokenized multi-word) ve
 * çok alanlı finansal arama desteği sunar.
 */

/**
 * Verilen metni arama için normalize eder:
 * 1. Türkçe kurallarıyla küçük harfe çevirir (toLocaleLowerCase('tr-TR')).
 * 2. Unicode NFD birleştirme işaretlerini (combining marks / üst noktalar) ayrıştırıp temizler.
 * 3. Türkçe özel harfleri evrensel Latin eşleniklerine indirger (ı->i, ğ->g, ü->u, ş->s, ö->o, ç->c).
 * 4. Fazla boşlukları budar (trim).
 */
export function normalizeForSearch(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str) return '';

  return str
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Combining diacritical marks temizleme
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

/**
 * Verilen hedef alanların (targets), arama sorgusundaki (query) tüm kelimeleri
 * içerip içermediğini (AND mantığı) kontrol eder.
 * 
 * @param targets Taranacak alanlar (Açıklama, Etiketler, Hesap Adı, Kategori, Tutar vb.)
 * @param query Kullanıcının arama kutusuna girdiği metin (örn: "iş", "issizlik 5/5", "enpara maaş")
 * @returns boolean Eşleşme durumu
 */
export function matchesSearch(
  targets: (string | number | null | undefined)[],
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;

  // Sorguyu boşluklardan parçalayarak token'lara ayıralım
  const tokens = query
    .trim()
    .split(/\s+/)
    .map(normalizeForSearch)
    .filter(Boolean);

  if (tokens.length === 0) return true;

  // Hedef alanları normalize edip boş olmayanları alalım
  const normalizedTargets = targets
    .filter((t) => t !== null && t !== undefined)
    .map((t) => normalizeForSearch(t))
    .filter(Boolean);

  if (normalizedTargets.length === 0) return false;

  // Her bir arama token'ı, hedef alanların EN AZ BİRİNDE geçmelidir (AND mantığı)
  return tokens.every((token) =>
    normalizedTargets.some((target) => target.includes(token))
  );
}
