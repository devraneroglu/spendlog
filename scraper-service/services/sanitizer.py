import re
from typing import Optional, Union
from decimal import Decimal, InvalidOperation

class DataSanitizer:
    """
    SpendLog V2 — Merkezi Veri Temizleme, Karakter Düzeltme ve Sayı Dönüştürme Katmanı.
    Türkçe/İngilizce para birimi formatları, bozuk karakterler (encoding) ve regex temizliğini yönetir.
    """

    # Türkçe Karakter Bozulmaları (Mojibake Fix Map)
    MOJIBAKE_MAP = {
        "Ã§": "ç", "Ã‡": "Ç",
        "ÄŸ": "ğ", "Äž": "Ğ",
        "Ä±": "ı", "Ä°": "İ",
        "Ã¶": "ö", "Ã–": "Ö",
        "ÅŸ": "ş", "Åž": "Ş",
        "Ã¼": "ü", "Ãœ": "Ü",
        "â‚º": "₺",
        "&nbsp;": " ",
        "&amp;": "&",
        "&quot;": "\"",
    }

    @classmethod
    def clean_text(cls, text: Optional[str]) -> str:
        """Metinlerdeki bozuk karakterleri (mojibake) ve gereksiz boşlukları temizler."""
        if not text:
            return ""
        cleaned = str(text)
        for bad, good in cls.MOJIBAKE_MAP.items():
            cleaned = cleaned.replace(bad, good)
        # Çoklu boşlukları teke indir
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    @classmethod
    def to_float(cls, value: Union[str, int, float, None], default: float = 0.0) -> float:
        """
        Her türlü formatlanmış sayı/para birimi metnini güvenli float tipine dönüştürür.
        Örnekler:
          - "1.250,50 TL" -> 1250.50
          - "$ 4,477.20"  -> 4477.20
          - "14.012,42"   -> 14012.42
          - "37,00 %"     -> 37.00
          - "-0,15%"      -> -0.15
        """
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return float(value)

        val_str = cls.clean_text(str(value))
        if not val_str:
            return default

        # Eksi işaretini koru
        is_negative = "-" in val_str

        # Sayı ve nokta/virgül dışındaki tüm karakterleri (₺, $, €, %, TL, harfler) temizle
        val_clean = re.sub(r'[^\d.,]', '', val_str)
        if not val_clean:
            return default

        # Nokta ve virgül ayrımı (TR: 1.250,50 vs US: 1,250.50)
        if "," in val_clean and "." in val_clean:
            last_comma = val_clean.rfind(",")
            last_dot = val_clean.rfind(".")
            if last_comma > last_dot:
                # TR Format: 1.250,50 -> noktayı kaldır, virgülü nokta yap
                val_clean = val_clean.replace(".", "").replace(",", ".")
            else:
                # US Format: 1,250.50 -> virgülü kaldır
                val_clean = val_clean.replace(",", "")
        elif "," in val_clean:
            # Sadece virgül var: "1250,50" veya "37,00"
            val_clean = val_clean.replace(",", ".")
        elif "." in val_clean:
            # Sadece nokta var: "1250.50" veya "14.012"
            parts = val_clean.split(".")
            if len(parts) > 2:
                # Örn: "1.250.000" -> binlik ayracı
                val_clean = val_clean.replace(".", "")
            elif len(parts) == 2 and len(parts[1]) == 3 and int(parts[0]) > 0:
                # Örn: "14.012" -> muhtemelen binlik ayracı (BIST 100 vb.)
                # Ancak 3 basamaklı ondalık da olabilir; genel kural 3 basamak ve >100 ise binlik
                pass

        try:
            res = float(val_clean)
            return -res if is_negative else res
        except ValueError:
            return default

    @classmethod
    def to_decimal(cls, value: Union[str, int, float, None], default: str = "0.0") -> Decimal:
        """Finansal kesinlik gerektiren durumlar için Decimal dönüşümü."""
        f_val = cls.to_float(value, default=float(default))
        try:
            return Decimal(str(f_val))
        except InvalidOperation:
            return Decimal(default)

    @classmethod
    def extract_change_percent(cls, text: Optional[str]) -> float:
        """Değişim oranı metninden (+%1.45, -0,09%) işaretli float çıkarır."""
        if not text:
            return 0.0
        val = cls.to_float(text)
        return round(val, 2)
