import io
from typing import List, Dict, Any
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm

class MonthlyReportGenerator:
    """
    SpendLog V2 Finansal Raporlama Motoru
    - Matplotlib ile FinTech Halka (Donut) Harcama Grafiği (PNG)
    - ReportLab ile Kurumsal Aylık Harcama ve İşlem Dökümü Raporu (PDF)
    """

    COLOR_PALETTE = [
        '#6366F1',  # Indigo
        '#10B981',  # Emerald
        '#F59E0B',  # Amber
        '#EC4899',  # Pink
        '#8B5CF6',  # Purple
        '#3B82F6',  # Blue
        '#14B8A6',  # Teal
        '#F97316',  # Orange
        '#06B6D4',  # Cyan
        '#64748B'   # Slate
    ]

    @classmethod
    def generate_pie_chart(cls, period: str, total_amount: float, categories: List[Dict[str, Any]]) -> bytes:
        """
        Kategori bazlı harcama dağılımını gösteren yüksek çözünürlüklü modern FinTech donut grafiği üretir.
        """
        if not categories:
            # Boş veri durumunda bilgilendirme grafiği
            fig, ax = plt.subplots(figsize=(8, 6), facecolor='#0F172A')
            ax.set_facecolor('#0F172A')
            ax.text(0.5, 0.5, f"{period} Döneminde Harcama Kaydı Bulunamadı", 
                    color='#94A3B8', fontsize=14, ha='center', va='center')
            ax.axis('off')
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=200, bbox_inches='tight', facecolor=fig.get_facecolor())
            plt.close(fig)
            buf.seek(0)
            return buf.getvalue()

        # En yüksek 7 kategori + Diğerleri
        sorted_cats = sorted(categories, key=lambda x: x.get('amount', 0), reverse=True)
        if len(sorted_cats) > 7:
            top_cats = sorted_cats[:6]
            other_amount = sum(c.get('amount', 0) for c in sorted_cats[6:])
            top_cats.append({'name': 'Diğer', 'amount': other_amount})
            chart_data = top_cats
        else:
            chart_data = sorted_cats

        labels = [c.get('name', 'Genel') for c in chart_data]
        amounts = [float(c.get('amount', 0)) for c in chart_data]
        chart_colors = cls.COLOR_PALETTE[:len(chart_data)]

        # Matplotlib Figure
        fig, ax = plt.subplots(figsize=(9, 7), facecolor='#0F172A')
        ax.set_facecolor('#0F172A')

        # Donut grafiği (wedge)
        wedges, texts, autotexts = ax.pie(
            amounts,
            labels=None,
            autopct=lambda pct: f"%{pct:.1f}" if pct > 4 else "",
            pctdistance=0.78,
            startangle=140,
            colors=chart_colors,
            wedgeprops=dict(width=0.42, edgecolor='#0F172A', linewidth=2.5)
        )

        for autotext in autotexts:
            autotext.set_color('#FFFFFF')
            autotext.set_fontsize(10)
            autotext.set_weight('bold')

        # Halka Merkez Metni
        center_text = f"Toplam Harcama\n{total_amount:,.2f} ₺".replace(',', 'X').replace('.', ',').replace('X', '.')
        ax.text(0, 0, center_text,
                horizontalalignment='center',
                verticalalignment='center',
                fontsize=13,
                fontweight='bold',
                color='#F8FAFC',
                linespacing=1.4)

        # Başlık
        ax.set_title(f"SpendLog — {period} Harcama Dağılımı",
                     fontsize=15,
                     fontweight='bold',
                     color='#FFFFFF',
                     pad=20)

        # Açıklama / Legend (Sağ alt / yan)
        legend_labels = [
            f"{c.get('name', 'Genel')}: {float(c.get('amount', 0)):,.2f} ₺".replace(',', 'X').replace('.', ',').replace('X', '.')
            for c in chart_data
        ]
        legend = ax.legend(
            wedges,
            legend_labels,
            title="Kategoriler",
            loc="center left",
            bbox_to_anchor=(1, 0, 0.5, 1),
            frameon=True,
            facecolor='#1E293B',
            edgecolor='#334155',
            fontsize=9.5
        )
        legend.get_title().set_color('#94A3B8')
        legend.get_title().set_weight('bold')
        for text in legend.get_texts():
            text.set_color('#E2E8F0')

        ax.axis('equal')
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=220, bbox_inches='tight', facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    @classmethod
    def generate_monthly_pdf(cls, period: str, total_amount: float, transaction_count: int, 
                             categories: List[Dict[str, Any]], expenses: List[Dict[str, Any]]) -> bytes:
        """
        ReportLab ile A4 boyutunda şık, kurumsal aylık harcama ekstresi PDF'i üretir.
        """
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            rightMargin=1.5 * cm,
            leftMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm
        )

        styles = getSampleStyleSheet()
        
        # Özel Stiller
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#0F172A'),
            spaceAfter=4
        )

        subtitle_style = ParagraphStyle(
            'DocSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#64748B'),
            spaceAfter=14
        )

        kpi_label_style = ParagraphStyle(
            'KPILabel',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#64748B'),
            alignment=1
        )

        kpi_value_style = ParagraphStyle(
            'KPIValue',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=colors.HexColor('#0F172A'),
            alignment=1
        )

        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.white
        )

        table_cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#1E293B')
        )

        table_amount_style = ParagraphStyle(
            'TableAmount',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor('#E11D48'),
            alignment=2
        )

        elements = []

        # 1. Başlık & Logo Alanı
        elements.append(Paragraph("<b>SPENDLOG V2</b> — Aylık Harcama Raporu", title_style))
        elements.append(Paragraph(f"Dönem: <b>{period}</b> &nbsp;|&nbsp; Rapor Üretim Tarihi: <b>{period} Ekstresi</b>", subtitle_style))

        # 2. KPI Özet Kartları Tablosu
        formatted_total = f"{total_amount:,.2f} ₺".replace(',', 'X').replace('.', ',').replace('X', '.')
        top_category_name = categories[0].get('name', 'Yok') if categories else "Yok"

        kpi_data = [
            [
                Paragraph("TOPLAM HARCAMA", kpi_label_style),
                Paragraph("İŞLEM SAYISI", kpi_label_style),
                Paragraph("EN YÜKSEK KATEGORİ", kpi_label_style)
            ],
            [
                Paragraph(formatted_total, kpi_value_style),
                Paragraph(f"{transaction_count} Harcama", kpi_value_style),
                Paragraph(top_category_name, kpi_value_style)
            ]
        ]

        kpi_table = Table(kpi_data, colWidths=[6.0 * cm, 5.0 * cm, 6.0 * cm])
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(kpi_table)
        elements.append(Spacer(1, 14))

        # 3. Kategori Dağılımı Özeti Tablosu
        if categories:
            elements.append(Paragraph("<b>Kategori Bazlı Harcama Dağılımı</b>", ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor('#0F172A'), spaceAfter=6)))
            cat_table_data = [[
                Paragraph("Kategori", table_header_style),
                Paragraph("İşlem Sayısı", table_header_style),
                Paragraph("Oran (%)", table_header_style),
                Paragraph("Toplam Tutar", table_header_style)
            ]]

            for cat in sorted(categories, key=lambda x: x.get('amount', 0), reverse=True):
                cat_amount = float(cat.get('amount', 0))
                pct = (cat_amount / total_amount * 100) if total_amount > 0 else 0
                cat_amt_str = f"{cat_amount:,.2f} ₺".replace(',', 'X').replace('.', ',').replace('X', '.')
                cat_table_data.append([
                    Paragraph(cat.get('name', 'Genel'), table_cell_style),
                    Paragraph(str(cat.get('count', '-')), table_cell_style),
                    Paragraph(f"%{pct:.1f}", table_cell_style),
                    Paragraph(cat_amt_str, table_amount_style)
                ])

            cat_table = Table(cat_table_data, colWidths=[6.0 * cm, 3.5 * cm, 3.5 * cm, 4.0 * cm])
            cat_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8FAFC')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ]))
            elements.append(cat_table)
            elements.append(Spacer(1, 14))

        # 4. Detaylı Harcama Hareketleri Listesi
        elements.append(Paragraph("<b>Harcama Hareketleri Dökümü</b>", ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor('#0F172A'), spaceAfter=6)))

        if not expenses:
            elements.append(Paragraph("Bu dönemde detaylı harcama hareketi bulunmamaktadır.", subtitle_style))
        else:
            exp_table_data = [[
                Paragraph("Tarih", table_header_style),
                Paragraph("Açıklama", table_header_style),
                Paragraph("Kategori", table_header_style),
                Paragraph("Hesap / Kart", table_header_style),
                Paragraph("Tutar", table_header_style)
            ]]

            for exp in expenses:
                amt = float(exp.get('amount', 0))
                amt_str = f"-{abs(amt):,.2f} ₺".replace(',', 'X').replace('.', ',').replace('X', '.')
                exp_table_data.append([
                    Paragraph(exp.get('date', ''), table_cell_style),
                    Paragraph(exp.get('description', '')[:38], table_cell_style),
                    Paragraph(exp.get('category', 'Genel'), table_cell_style),
                    Paragraph(exp.get('account', ''), table_cell_style),
                    Paragraph(amt_str, table_amount_style)
                ])

            exp_table = Table(exp_table_data, colWidths=[2.5 * cm, 6.0 * cm, 3.2 * cm, 2.8 * cm, 2.5 * cm])
            exp_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8FAFC')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ]))
            elements.append(exp_table)

        # PDF Derle
        doc.build(elements)
        buf.seek(0)
        return buf.getvalue()
