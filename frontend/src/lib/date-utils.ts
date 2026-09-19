/**
 * Tarih ve Saat Dilimi Güvenli Yardımcı Fonksiyonlar (Timezone-safe date utils)
 * UTC kaymalarını (1 gün önceki tarihe düşme vb.) engeller.
 */

/**
 * Bir tarihi veya ISO string'i <input type="date" /> için güvenli YYYY-MM-DD formatına dönüştürür.
 * Asla UTC saat farkından dolayı 1 gün geriye kaymaz.
 */
export function formatLocalDateToInput(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Eğer string formatında ve ISO ise doğrudan tarih kısmını al
  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      const datePart = dateInput.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Yerel saat bileşenlerini kullanarak YYYY-MM-DD üret
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * <input type="date" /> değerini (YYYY-MM-DD) API'ye gönderilmek üzere güvenli ISO string formatına dönüştürür.
 * Saat dilimi farklarından dolayı gün kaymasını önlemek için öğle saatine (12:00:00) ayarlar.
 */
export function toSafeApiDateString(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  // YYYY-MM-DD formatındaysa öğle saati ile birleştir
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return `${dateStr}T12:00:00`;
  }
  return new Date(dateStr).toISOString();
}

/**
 * FinTech standartlarında kısa tarih ve saat üretir (Örn: "20 Eyl • 01:42").
 */
export function formatShortDateTime(dateInput?: string | Date | null): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} • ${hh}:${mm}`;
}

