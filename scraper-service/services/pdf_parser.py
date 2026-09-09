import io
import re
import tempfile
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from markitdown import MarkItDown
import pdfplumber

class PdfParserService:
    def __init__(self):
        self.md = MarkItDown()

    def parse_credit_card_pdf(self, file_bytes: bytes, filename: str, bank_type: str = "auto") -> Dict[str, Any]:
        """
        PDF dosyasını MarkItDown ve pdfplumber ile kombine ederek 
        ekstre özetini, kart numaralarını, harcamaları, taksitleri ve kategorileri ayrıştırır.
        """
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(file_bytes)
            tmp_path = tmp_file.name

        try:
            # 1. MarkItDown ile Markdown içeriğe dönüştür
            conversion_result = self.md.convert(tmp_path)
            raw_markdown = conversion_result.text_content

            # 2. Özet Bilgileri Çıkar
            summary = self._extract_summary(raw_markdown)

            # 3. Harcama Satırlarını Parse Et
            expenses = self._parse_transactions(raw_markdown)

            return {
                "success": True,
                "total_records": len(expenses),
                "statement_date": summary.get("statement_date"),
                "due_date": summary.get("due_date"),
                "period_debt": summary.get("period_debt"),
                "minimum_payment": summary.get("minimum_payment"),
                "card_limit": summary.get("card_limit"),
                "available_limit": summary.get("available_limit"),
                "card_number": summary.get("card_number"),
                "expenses": expenses,
                "raw_markdown_snippet": raw_markdown[:1500]
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def _extract_summary(self, text: str) -> Dict[str, Any]:
        summary: Dict[str, Any] = {}

        # Kart Numarası
        card_match = re.search(r'(\d{4}[-\s#*]+\d{4}[-\s#*]+\d{4}[-\s#*]+\d{4}|\d{4}[-\s#*]+\d{4})', text)
        if card_match:
            summary["card_number"] = card_match.group(1).strip()

        # Hesap Kesim Tarihi
        stmt_match = re.search(r'(?:Hesap\s*Kesim\s*Tarihi|HESAP\s*KES[İI]M\s*TAR[İI]H[İI]|Ekstre\s*Tarihi)[\s|:]+(\d{2}[./]\d{2}[./]\d{4})', text, re.IGNORECASE)
        if stmt_match:
            summary["statement_date"] = stmt_match.group(1).replace('/', '.')

        # Son Ödeme Tarihi
        due_match = re.search(r'(?:Son\s*[ÖO]deme\s*Tarihi|SON\s*[ÖO]DEME\s*TAR[İI]H[İI])[\s|:]+(\d{2}[./]\d{2}[./]\d{4})', text, re.IGNORECASE)
        if due_match:
            summary["due_date"] = due_match.group(1).replace('/', '.')

        # Dönem Borcu TL
        debt_match = re.search(r'(?:D[öo]nem\s*Borcu\s*(?:TL)?|TOPLAM\s*BOR[CÇ])[\s|:]+([\d.,]+)\s*(?:TL)?', text, re.IGNORECASE)
        if debt_match:
            summary["period_debt"] = self._parse_decimal(debt_match.group(1))

        # Asgari Ödeme
        min_match = re.search(r'(?:Asgari\s*[ÖO]deme\s*Tutar[ıi]\s*(?:TL)?|ASGAR[İI]\s*[ÖO]DEME)[\s|:]+([\d.,]+)\s*(?:TL)?', text, re.IGNORECASE)
        if min_match:
            summary["minimum_payment"] = self._parse_decimal(min_match.group(1))

        # Kart Limiti
        limit_match = re.search(r'(?:Kart\s*Limiti|KART\s*L[İI]M[İI]T[İI])[\s|:]+([\d.,]+)\s*(?:TL)?', text, re.IGNORECASE)
        if limit_match:
            summary["card_limit"] = self._parse_decimal(limit_match.group(1))

        # Kullanılabilir Kart Limiti
        avail_match = re.search(r'(?:Kullan[ıi]labilir\s*Kart\s*Limiti)[\s|:]+([\d.,]+)\s*(?:TL)?', text, re.IGNORECASE)
        if avail_match:
            summary["available_limit"] = self._parse_decimal(avail_match.group(1))

        return summary

    def _parse_transactions(self, text: str) -> List[Dict[str, Any]]:
        expenses: List[Dict[str, Any]] = []
        lines = text.split('\n')

        current_card_no = "5423-####-####-0915"
        seen_items = set()

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue

            # Kart Numarası Başlığı Tespiti (Örn: KART NO : 5423-####-####-0915 / D***** E*****)
            card_no_match = re.search(r'KART\s*NO\s*:\s*([\d#*-]+)', line, re.IGNORECASE)
            if card_no_match:
                current_card_no = card_no_match.group(1).strip()
                continue

            # 1. MARKDOWN TABLO SATIRI İNCELEMESİ (Örn: | 09/08/2026 | ÖZGÜ GLOBAL ANKARA | | | | 2.380,00 | | 2,38 |)
            if line.startswith('|') and '|' in line[1:]:
                parts = [p.strip() for p in line.split('|')]
                non_empty = [p for p in parts if p and not re.match(r'^-+$', p)]
                if len(non_empty) >= 2:
                    date_cand = non_empty[0]
                    if re.match(r'^\d{2}[./]\d{2}[./]\d{4}$', date_cand):
                        date_str = date_cand.replace('/', '.')
                        desc_cand = non_empty[1]

                        # Sayısal kolonları topla
                        num_cols = []
                        for p in non_empty[2:]:
                            if re.match(r'^[\+\-]?\d+(?:\.\d{3})*,\d{2}[\+\-]?$', p) or re.match(r'^[\+\-]?\d+,\d{2}[\+\-]?$', p):
                                num_cols.append(p)

                        if num_cols:
                            # İlk sayısal kolon TL İşlem Tutarıdır (Sonraki kolonlar USD veya Bankkart Lira / Puan)
                            amount_cand = num_cols[0]
                            parsed_amount = self._parse_decimal(amount_cand.replace('+', '').replace('-', ''))

                            if parsed_amount is not None:
                                is_payment = self._determine_is_payment(desc_cand, amount_cand, line)
                                clean_desc, installment = self._clean_description(desc_cand)
                                category_info = self._categorize_transaction(clean_desc)

                                final_amount = parsed_amount if is_payment else -parsed_amount
                                sig = f"{date_str}_{clean_desc}_{final_amount}_{current_card_no}"

                                if sig not in seen_items:
                                    seen_items.add(sig)
                                    expenses.append({
                                        "date": date_str,
                                        "description": clean_desc,
                                        "description_info": installment,
                                        "amount": final_amount,
                                        "card_number": current_card_no,
                                        "category": category_info.get("category"),
                                        "sub_category": category_info.get("sub_category"),
                                        "is_payment": is_payment,
                                        "is_expense": not is_payment
                                    })
                                continue

            # 2. DÜZ METİN / TAKSİTLİ METİN SATIRLARI
            # Örn: 26/05/2026 26/04 IYZICO/AMAZON.COM. 02.Tak İSTANBUL 4.899,00 TL İşlemin 2/3 Taksidi 1.633,00
            # Örn: 25/05/2026 0131 şube-hesaptan ödeme-teşekkür ederiz 37.421,60+
            # Örn: 09/08/2026 ÖZGÜ GLOBAL ANKARA 2.380,00 2,38
            flat_match = re.match(r'^(\d{2}[./]\d{2}[./]\d{4})\s+(.+)$', line)
            if flat_match:
                date_str = flat_match.group(1).replace('/', '.')
                rest = flat_match.group(2).strip()

                # Taksit tespiti: "İşlemin 1/3 Taksidi 1.633,00[+]"
                installment = None
                parsed_amount = None
                is_payment = self._determine_is_payment(rest, "", line)

                inst_match = re.search(r'İşlemin?\s*(\d+/\d+)\s*Taksid[i]?\s*([\d.]+,\d{2}[\+\-]?)', rest, re.IGNORECASE)
                if inst_match:
                    installment = f"{inst_match.group(1)} Taksit"
                    inst_amt_str = inst_match.group(2)
                    if '+' in inst_amt_str:
                        is_payment = True
                    parsed_amount = self._parse_decimal(inst_amt_str.replace('+', '').replace('-', ''))
                else:
                    # Taksitsiz düz satırda sayısal tutarları bul
                    all_amounts = re.findall(r'[\d.]+,\d{2}[\+\-]?', rest)
                    if all_amounts:
                        # Eğer birden fazla tutar varsa, ilki işlem tutarıdır, sonuncusu puan/lira olabilir
                        first_amt_str = all_amounts[0]
                        if '+' in first_amt_str or any('+' in a for a in all_amounts):
                            is_payment = True
                        parsed_amount = self._parse_decimal(first_amt_str.replace('+', '').replace('-', ''))

                if parsed_amount is not None:
                    # Açıklama temizliği
                    clean_desc = rest
                    all_amounts = re.findall(r'[\d.]+,\d{2}[\+\-]?', rest)
                    for a in all_amounts:
                        clean_desc = clean_desc.replace(a, '')
                    clean_desc = re.sub(r'İşlemin?\s*\d+/\d+\s*Taksid[i]?', '', clean_desc, flags=re.IGNORECASE)
                    clean_desc = re.sub(r'^\d{2}/\d{2}\s+', '', clean_desc) # 26/04 gibi işlem tarihi tekrarı
                    clean_desc = re.sub(r'\d{8}\s+', '', clean_desc) # 20260430 referans no
                    clean_desc = re.sub(r'\d+\.?\s*Tak', '', clean_desc, flags=re.IGNORECASE)
                    clean_desc = re.sub(r'TL', '', clean_desc, flags=re.IGNORECASE)
                    clean_desc = self._clean_spaces(clean_desc)

                    if len(clean_desc) >= 3:
                        category_info = self._categorize_transaction(clean_desc)
                        final_amount = parsed_amount if is_payment else -parsed_amount
                        sig = f"{date_str}_{clean_desc}_{final_amount}_{current_card_no}"

                        if sig not in seen_items:
                            seen_items.add(sig)
                            expenses.append({
                                "date": date_str,
                                "description": clean_desc,
                                "description_info": installment,
                                "amount": final_amount,
                                "card_number": current_card_no,
                                "category": category_info.get("category"),
                                "sub_category": category_info.get("sub_category"),
                                "is_payment": is_payment,
                                "is_expense": not is_payment
                            })

        return expenses

    def _determine_is_payment(self, desc: str, amt_str: str, full_line: str) -> bool:
        """
        İşlemin bir harcama (negatif) mi yoksa kredi kartına yapılan ödeme/iade (pozitif) mi olduğunu kesin tespit eder.
        """
        # 1. Tutarın veya satırın sonunda '+' işareti varsa (Örn: 37.421,60+ veya 1.633,00+)
        if '+' in amt_str or '+' in full_line:
            return True

        lower_desc = desc.lower()
        lower_line = full_line.lower()

        # 2. Fatura ödemeleri KARTTAN YAPILAN BİR HARCAMADIR (asla ödeme/gelir değildir!)
        if 'fatura' in lower_desc or 'fatura' in lower_line:
            return False

        # 3. İadeler pozitif olarak karta geri yansır
        if 'iade' in lower_desc or 'iade' in lower_line or 'iptal' in lower_desc:
            return True

        # 4. Kredi kartı borç ödemesi ifadeleri
        if any(term in lower_line for term in [
            'şube-hesaptan ödeme',
            'hesaptan ödeme',
            'otomatik ödeme',
            'teşekkür ederiz',
            'kredi kartı ödeme',
            'eft ile ödeme',
            'mobil bankacılık ödeme'
        ]):
            return True

        return False

    def _clean_description(self, raw_desc: str) -> (str, Optional[str]):
        desc = raw_desc.replace('|', ' ').strip()
        installment = None

        inst_m = re.search(r'(\d+/\d+)\s*Taksit|İşlemin?\s*(\d+/\d+)\s*Taksid[i]?', desc, re.IGNORECASE)
        if inst_m:
            installment = f"{inst_m.group(1) or inst_m.group(2)} Taksit"
            desc = re.sub(r'(\d+/\d+)\s*Taksit|İşlemin?\s*(\d+/\d+)\s*Taksid[i]?', '', desc, flags=re.IGNORECASE)

        desc = self._clean_spaces(desc)
        return desc, installment

    def _clean_spaces(self, text: str) -> str:
        return re.sub(r'\s+', ' ', text).strip()

    def _categorize_transaction(self, desc: str) -> Dict[str, str]:
        """
        Açıklamaya göre Kategori ve Alt Kategori otomatik eşleştirir.
        """
        d = desc.upper()

        # 1. Market & Gıda & Sağlık
        if any(w in d for w in ['MİGROS', 'MIGROS', 'BİM', 'BIM', 'ŞOK', 'SOK', 'FİLE MARKET', 'FILE MARKET', 'MOPAŞ', 'MOPAS', 'CARREFOUR', 'A101', 'TARIM KREDİ', 'GÖZDE KURUYEMİŞ', 'SYM ET GIDA', 'KASAP', 'MANAV']):
            return {"category": "5-Market & Gıda & Sağlık", "sub_category": "Market Alışverişi"}
        if any(w in d for w in ['ECZANE', 'SAGLIK', 'SAĞLIK', 'HASTANE', 'MEDİCAL', 'MEDICAL', 'DİŞ']):
            return {"category": "5-Market & Gıda & Sağlık", "sub_category": "Eczane"}

        # 2. Yeme & İçme
        if any(w in d for w in ['TRENDYOL YEMEK', 'YEMEKSEPETİ', 'YEMEKSEPETI', 'GETİRYEMEK', 'GETIRYEMEK', 'PAKET SERVİS']):
            return {"category": "8-Yeme & İçme", "sub_category": "Paket Servis"}
        if any(w in d for w in ['SBX', 'STARBUCKS', 'COFFEE', 'ESPRESSOLAB', 'KAHVE', 'KAFE', 'CAFE', 'GREENWICH', 'THE CO', 'MPLUS']):
            return {"category": "8-Yeme & İçme", "sub_category": "Kafe"}
        if any(w in d for w in ['MCDONALDS', 'BURGER KING', 'RESTORAN', 'RESTAURANT', 'LOKANTA', 'BÖREK', 'BOREK', 'PİDE', 'PIDE', 'DÖNER', 'DONER', 'KÖFTE', 'KOFTE', 'BÜFE', 'BUFE', 'YEDİ YEMEK']):
            return {"category": "8-Yeme & İçme", "sub_category": "Restoran"}

        # 3. Ulaşım & Araç
        if any(w in d for w in ['PETROL', 'BP', 'SHELL', 'OPET', 'PO ', 'TOTAL', 'AYGAZ', 'AKARYAKIT', 'BİRBİLEN', 'BIRBILEN', 'ATEŞ AKARYAKIT', 'CLASS SANCAKTEPE']):
            return {"category": "7-Ulaşım & Araç", "sub_category": "Akaryakıt"}
        if any(w in d for w in ['HGS', 'OGS', 'KGM', 'OTOBAN', 'KÖPRÜ', 'KOPRU', 'İCA', 'ICA']):
            return {"category": "7-Ulaşım & Araç", "sub_category": "HGS"}
        if any(w in d for w in ['BELBİM', 'BELBIM', 'İSTANBULKART', 'ISTANBULKART', 'TOPLU TAŞIMA', 'METRO', 'MARMARAY']):
            return {"category": "7-Ulaşım & Araç", "sub_category": "Toplu Taşıma"}
        if any(w in d for w in ['OTOPARK', 'ISPARK', 'İSPARK']):
            return {"category": "7-Ulaşım & Araç", "sub_category": "Otopark"}
        if any(w in d for w in ['OTO BAKIM', 'SERVİS', 'LASTİK', 'MUAYENE']):
            return {"category": "7-Ulaşım & Araç", "sub_category": "Araç Bakımı"}

        # 4. Dijital Abonelikler & Servisler
        if any(w in d for w in ['GOOGLE *GOOGLE ONE', 'GOOGLE ONE']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "GoogleOne"}
        if any(w in d for w in ['YOUTUBE', 'YOUTUBEPREMI', 'YOUTUBE MEMB']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "Youtube"}
        if any(w in d for w in ['LINKEDIN', 'LINKED-IN']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "Linked-In"}
        if any(w in d for w in ['APPLE.COM', 'ITUNES', 'APP STORE']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "Apple"}
        if any(w in d for w in ['AMZNPRIME', 'PRIME VIDEO', 'AMAZON PRIME']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "Amazon"}
        if any(w in d for w in ['OPENENGLISH', 'OPEN ENGLİSH', 'OPENENGLİSH']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "OpenEnglish"}
        if any(w in d for w in ['NETFLIX', 'SPOTIFY', 'DISNEY', 'EXXEN', 'BLUTV', 'CHATGPT', 'OPENAI', 'MIDJOURNEY']):
            return {"category": "6-Dijital Abonelikler & Servisler", "sub_category": "Dijital Abonelik"}

        # 5. İnternet Alışveriş & E-Ticaret
        if any(w in d for w in ['AMAZON.COM', 'IYZICO/AMAZON', 'AMAZON TR', 'S/TRENDYOL', 'TRENDYOL', 'HEPSİBURADA', 'HEPSIBURADA', 'N11', 'PAZARAMA']):
            return {"category": "13-İnternet Alışveriş", "sub_category": "İnternet Alışveriş"}

        # 6. Giyim & Aksesuar
        if any(w in d for w in ['ZARA', 'PULL&BEAR', 'BERSHKA', 'STRADIVARIUS', 'MASSIMO DUTTI', 'H&M', 'MANGO', 'LCW', 'DEFACTO', 'KOTON', 'MAVİ', 'MAVI', 'BARRELS AND OİL', 'ALYA ISLETMECILIK', 'GİYİM', 'GIYIM', 'AYAKKABI', 'BOYNER']):
            return {"category": "10-Giyim & Aksesuar", "sub_category": "Mağaza - Giyim"}

        # 7. Konut & Faturalar
        if any(w in d for w in ['FATURA ÖDEME', 'FATURA ODEME', 'ENERJİSA', 'İSKİ', 'ISKI', 'İGDAŞ', 'IGDAS', 'TURKCELL', 'VODAFONE', 'TÜRK TELEKOM', 'TURK TELEKOM', 'SUPERONLINE']):
            return {"category": "2-Konut", "sub_category": "Cep Telefonu / Fatura"}

        # 8. Vergi & Resmi Ödemeler
        if any(w in d for w in ['GİB', 'GIB', 'VERGİ', 'VERGI', 'MTV', 'HARÇ', 'HARC', 'CEZA', 'KAYMAKAMLIK', 'BELEDİYE', 'BELEDIYE']):
            return {"category": "12- Vergi & Resmi Ödemeler", "sub_category": "Motorlu Taşıtlar Vergisi"}

        return {"category": "Diğer Harcamalar", "sub_category": "Genel"}

    def _parse_decimal(self, val_str: str) -> Optional[float]:
        try:
            cleaned = val_str.replace('.', '').replace(',', '.')
            return float(cleaned)
        except:
            return None
