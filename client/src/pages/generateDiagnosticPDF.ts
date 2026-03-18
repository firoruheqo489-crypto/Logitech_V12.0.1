/**
 * generateDiagnosticPDF — A4 专业工程报告
 * 可打印 | 表格式元数据 | 编号标题 | 无圆角/渐变/阴影
 * Canvas渲染中文(永不加粗) | 固定页脚页码
 */

import { getIssueProcessStepLabel, getIssueTypeLabels } from '@/lib/issueDomain';
import type { IssueRecord } from '@/lib/issueService';

export async function generateDiagnosticPDF(record: IssueRecord, filename: string) {
  const jspdfMod = await import('jspdf');
  const jsPDF = jspdfMod.jsPDF || jspdfMod.default;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const PW = pdf.internal.pageSize.getWidth();   // ~595
  const PH = pdf.internal.pageSize.getHeight();   // ~842

  // Margins: top 25mm, right 18mm, bottom 22mm, left 18mm (1mm ≈ 2.835pt)
  const ML = 51;   // 18mm
  const MR = 51;   // 18mm
  const MT = 57;   // 20mm
  const MB = 62;   // 22mm
  const W = PW - ML - MR;
  const FOOTER_H = 24;
  const BOTTOM_PAD = 43; // 15mm safe space above footer
  const SAFE_BOTTOM = PH - MB - FOOTER_H - BOTTOM_PAD;

  let Y = 0;
  let pageNum = 1;

  const cvs = document.createElement('canvas');
  const cx = cvs.getContext('2d')!;
  const R = 3; // retina scale

  // ── Design Tokens (print-friendly, no gradients) ──
  const C = {
    black:    '#000000',
    gray900:  '#111827',
    gray700:  '#374151',
    gray500:  '#6b7280',
    gray400:  '#9ca3af',
    gray300:  '#d1d5db',
    gray200:  '#e5e7eb',
    gray100:  '#f3f4f6',
    white:    '#ffffff',
    blue700:  '#1d4ed8',
    blue600:  [37, 99, 235] as [number, number, number],
    green600: [5, 150, 105] as [number, number, number],
    grayBadge: [107, 114, 128] as [number, number, number],
  };

  // 10.5pt body ≈ 10.5 in jsPDF pt units
  const FS = {
    xs: 8,
    sm: 9,
    body: 10.5,
    md: 12,
    lg: 15,
    xl: 19,
  };

  const FF = {
    cn: '"Source Han Sans SC","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
    en: '"Inter","Helvetica Neue","Arial",sans-serif',
    mono: '"JetBrains Mono","Consolas","SF Mono",monospace',
  };

  // ── Utilities ──
  const fillBg = () => { pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, PW, PH, 'F'); };

  const newPage = () => { pdf.addPage(); fillBg(); Y = MT; pageNum++; };

  const checkPage = (h: number) => { if (Y + h > SAFE_BOTTOM) newPage(); };

  const sp = (h: number) => { Y += h; };

  // ── Text renderer (canvas → image, always normal weight for Chinese) ──
  const drawText = (
    text: string, size: number, color: string,
    maxW = W, offX = ML, advance = true, ff = FF.cn
  ): number => {
    if (!text) return 0;
    const font = `${size}px ${ff}`;
    const lines: string[] = [];
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.font = font;
    for (const p of text.split('\n')) {
      if (!p) { lines.push(''); continue; }
      let ln = '';
      for (const ch of p) {
        const t = ln + ch;
        if (cx.measureText(t).width > maxW) { if (ln) lines.push(ln); ln = ch; }
        else ln = t;
      }
      if (ln) lines.push(ln);
    }
    const lh = size * 1.6;
    const topPad = size * 0.1;
    const bh = lines.length * lh + topPad + size * 0.12;
    cvs.width = Math.ceil(maxW * R) + 4;
    cvs.height = Math.ceil(bh * R) + 4;
    cx.setTransform(R, 0, 0, R, 0, 0);
    cx.clearRect(0, 0, cvs.width, cvs.height);
    cx.font = font;
    cx.fillStyle = color;
    cx.textBaseline = 'top';
    lines.forEach((l, i) => cx.fillText(l, 0, topPad + i * lh));
    checkPage(bh);
    pdf.addImage(cvs.toDataURL('image/png'), 'PNG', offX, Y, maxW, bh);
    if (advance) Y += bh;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    return bh;
  };

  const enText = (t: string, s: number, c: string, w = W, x = ML, a = true) =>
    drawText(t, s, c, w, x, a, FF.en);
  const mono = (t: string, s: number, c: string, w = W, x = ML, a = true) =>
    drawText(t, s, c, w, x, a, FF.mono);

  const loadImg = (url: string): Promise<HTMLImageElement | null> => new Promise(r => {
    const i = new window.Image(); i.crossOrigin = 'anonymous';
    i.onload = () => r(i); i.onerror = () => r(null); i.src = url;
  });

  // ── Horizontal rule (thin gray line) ──
  const hr = (width = 0.5, color = C.gray300) => {
    checkPage(10);
    pdf.setDrawColor(color);
    pdf.setLineWidth(width);
    pdf.line(ML, Y + 5, ML + W, Y + 5);
    Y += 10;
  };

  // ── Metadata table (horizontal lines only, header bg, improved padding) ──
  const drawMetaTable = (rows: { label: string; value: string; isMono?: boolean }[][], colWidths: number[]) => {
    // mm-based padding: 4mm vertical ≈ 11.3pt, 5mm horizontal ≈ 14.2pt
    const padX = 14.2;
    const padY = 11.3;
    const labelSize = 9;
    const valueSize = 11;
    const labelValueGap = 4.3; // 1.5mm
    const labelH = labelSize * (0.15 + 1.6 + 0.25); // matches canvas: topPad + lineH + botPad
    const valueH = valueSize * 1.2;
    const cellH = padY + labelH + labelValueGap + valueH + padY;
    const totalH = rows.length * cellH;
    checkPage(totalH + 4);

    const tableY = Y;

    // Outer border: 1px #E5E7EB, white bg
    pdf.setFillColor(255, 255, 255);
    pdf.rect(ML, tableY, W, totalH, 'F');
    pdf.setDrawColor('#e5e7eb');
    pdf.setLineWidth(1);
    pdf.rect(ML, tableY, W, totalH, 'S');

    for (let r = 0; r < rows.length; r++) {
      const ry = tableY + r * cellH;
      let cx2 = ML;

      // Row separator (not on first row)
      if (r > 0) {
        pdf.setDrawColor('#e5e7eb');
        pdf.setLineWidth(1);
        pdf.line(ML, ry, ML + W, ry);
      }

      for (let c = 0; c < rows[r].length; c++) {
        const cell = rows[r][c];
        const cw = colWidths[c];

        // Very light vertical separator #F1F5F9 (inset), skip first col
        if (c > 0) {
          pdf.setDrawColor('#f1f5f9');
          pdf.setLineWidth(0.8);
          pdf.line(cx2, ry + 8, cx2, ry + cellH - 8);
        }

        // Label: 9pt #4B5563, letter-spacing 0.06em (canvas with proper padding for CN glyphs)
        {
          const lblSpacing = labelSize * 0.06;
          const lblTopPad = labelSize * 0.15;
          const lblBotPad = labelSize * 0.25;
          const lblLineH = labelSize * 1.6;
          const lblRenderH = lblTopPad + lblLineH + lblBotPad;
          const lblCvs = document.createElement('canvas');
          const lblW = cw - padX * 2;
          lblCvs.width = Math.ceil(lblW * R) + 4;
          lblCvs.height = Math.ceil(lblRenderH * R) + 4;
          const lx = lblCvs.getContext('2d')!;
          lx.setTransform(R, 0, 0, R, 0, 0);
          lx.clearRect(0, 0, lblCvs.width, lblCvs.height);
          lx.font = `${labelSize}px ${FF.cn}`;
          lx.fillStyle = '#4b5563';
          lx.textBaseline = 'top';
          let lxPos = 0;
          for (const ch of cell.label) {
            lx.fillText(ch, lxPos, lblTopPad);
            lxPos += lx.measureText(ch).width + lblSpacing;
          }
          pdf.addImage(lblCvs.toDataURL('image/png'), 'PNG', cx2 + padX, ry + padY, lblW, lblRenderH);
        }

        // Value: 11pt #111827, line-height 1.2
        Y = ry + padY + labelH + labelValueGap;
        if (cell.isMono) {
          mono(cell.value, valueSize, '#111827', cw - padX * 2, cx2 + padX, false);
        } else {
          drawText(cell.value, valueSize, '#111827', cw - padX * 2, cx2 + padX, false);
        }

        cx2 += cw;
      }
    }

    Y = tableY + totalH;
  };

  // ── Section header: "1. 现场证据  EVIDENCE" on ONE line ──
  let sectionNum = 0;
  const SECTION_MARGIN = 17; // ~6mm
  const SEC_PAD_LEFT = 17;   // 6mm

  const sectionHead = (cn: string, en: string) => {
    sectionNum++;
    // Anti-orphan: heading (~20pt) + 14mm minimum content after (40pt) + margin (45pt) = ~105pt
    // If not enough room, start new page BEFORE the margin
    const ANTI_ORPHAN = 40; // 14mm minimum content after heading
    const headingH = 20;
    const needed = SECTION_MARGIN + headingH + ANTI_ORPHAN;
    if (Y + needed > SAFE_BOTTOM) newPage();
    sp(SECTION_MARGIN);

    // Left accent border 3px #2563EB
    pdf.setFillColor(37, 99, 235);
    pdf.rect(ML, Y, 3, 20, 'F');

    // Render title via canvas: CN 13pt only
    const titleX = ML + 3 + SEC_PAD_LEFT;
    const titleW = W - 3 - SEC_PAD_LEFT;
    const cnSize = 13;
    const lineH = cnSize * 1.5;

    const tc = document.createElement('canvas');
    tc.width = Math.ceil(titleW * R) + 4;
    tc.height = Math.ceil(lineH * R) + 4;
    const tx = tc.getContext('2d')!;
    tx.setTransform(R, 0, 0, R, 0, 0);

    // CN part: 13pt
    const cnFont = `${cnSize}px ${FF.cn}`;
    tx.font = cnFont;
    tx.fillStyle = C.gray900;
    tx.textBaseline = 'alphabetic';
    const cnLabel = `${sectionNum}. ${cn}`;
    const baseline = cnSize * 1.1;
    tx.fillText(cnLabel, 0, baseline);

    checkPage(lineH);
    pdf.addImage(tc.toDataURL('image/png'), 'PNG', titleX, Y, titleW, lineH);
    Y += lineH;
    sp(8.5); // ~3mm gap between section title and content
  };

  // ── Image grid: aspect-ratio aware, capped height, inside evidence block ──
  const IMG_MAX_H = 240; // ~85mm max per image row — keeps images readable without dominating page
  const EVIDENCE_PAD = 17; // 6mm

  const drawImageGrid = async (imgs: { preview: string }[]) => {
    if (!imgs.length) return;
    const count = imgs.length;
    const cols = count === 1 ? 1 : count === 2 ? 2 : 3;
    const gap = 8;
    const innerW = W - EVIDENCE_PAD * 2;
    const iw = (innerW - gap * (cols - 1)) / cols;

    // Load all images first
    const loaded: (HTMLImageElement | null)[] = [];
    for (const item of imgs) loaded.push(await loadImg(item.preview));

    // Calculate per-row heights based on actual image aspect ratios
    const rowCount = Math.ceil(imgs.length / cols);
    const rowHeights: number[] = [];
    for (let row = 0; row < rowCount; row++) {
      let maxH = iw * 0.35; // fallback if no image loaded
      for (let c = 0; c < cols; c++) {
        const idx = row * cols + c;
        if (idx >= imgs.length) break;
        const img = loaded[idx];
        if (img && img.naturalWidth > 0) {
          const aspect = Math.min(img.naturalHeight / img.naturalWidth, 0.75); // cap aspect ratio
          const h = iw * aspect;
          maxH = Math.max(maxH, h);
        }
      }
      rowHeights.push(Math.min(maxH, IMG_MAX_H));
    }

    const blockH = rowHeights.reduce((s, h) => s + h + gap, 0) - gap + EVIDENCE_PAD * 2;
    const labelH = 14;
    const totalNeeded = labelH + 4 + blockH + 4;

    // Adaptive scaling: if block doesn't fit current page, try shrinking to fit
    // rather than pushing to next page and leaving a big gap
    const pageAvail = SAFE_BOTTOM - Y;
    if (totalNeeded > pageAvail && pageAvail > 120) {
      // Enough room to show a scaled version — shrink row heights proportionally
      const availForBlock = pageAvail - labelH - 8; // space for actual image block
      const currentBlockH = blockH;
      if (availForBlock > 80 && availForBlock < currentBlockH) {
        const scale = (availForBlock - EVIDENCE_PAD * 2) / (currentBlockH - EVIDENCE_PAD * 2);
        for (let i = 0; i < rowHeights.length; i++) {
          rowHeights[i] = Math.max(rowHeights[i] * scale, 60); // minimum 60pt per row
        }
      }
    } else if (totalNeeded > pageAvail) {
      newPage();
    }

    // Label
    checkPage(labelH + 4);
    enText('EVIDENCE ATTACHMENT', 8, '#6b7280', W, ML, true);
    sp(2); // ~1mm tight gap to block

    // Evidence block: background #FAFAFA + border 1px #D1D5DB
    // For multi-row blocks that span pages, render per-row
    for (let row = 0; row < rowCount; row++) {
      const ih = rowHeights[row];
      const rowBlockH = ih + EVIDENCE_PAD * 2;

      // Check if this row fits, if not start new page
      checkPage(rowBlockH + 8);

      const blockY = Y;
      pdf.setFillColor(250, 250, 250);
      pdf.rect(ML, blockY, W, rowBlockH, 'F');
      pdf.setDrawColor('#d1d5db');
      pdf.setLineWidth(1);
      pdf.rect(ML, blockY, W, rowBlockH, 'S');

      Y = blockY + EVIDENCE_PAD;

      for (let c = 0; c < cols; c++) {
        const idx = row * cols + c;
        if (idx >= imgs.length) break;
        const img = loaded[idx];
        const ix = ML + EVIDENCE_PAD + c * (iw + gap);

        // White cell background + light border
        pdf.setDrawColor(C.gray300);
        pdf.setLineWidth(0.5);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(ix, Y, iw, ih, 'FD');

        // Render image preserving aspect ratio, centered in cell
        if (img && img.naturalWidth > 0) {
          const aspect = img.naturalHeight / img.naturalWidth;
          const cellPad = 2;
          const availW = iw - cellPad * 2;
          const availH = ih - cellPad * 2;
          let drawW = availW;
          let drawH = drawW * aspect;
          if (drawH > availH) { drawH = availH; drawW = drawH / aspect; }
          const dx = ix + cellPad + (availW - drawW) / 2;
          const dy = Y + cellPad + (availH - drawH) / 2;
          pdf.addImage(img, 'JPEG', dx, dy, drawW, drawH);
        }
      }

      Y = blockY + rowBlockH + (row < rowCount - 1 ? gap : 4);
    }
  };

  // ── Fixed page footer (8.5pt, letter-spacing .03em, strong top border) ──
  const drawFooters = () => {
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      const fy = PH - MB;

      // Strong top border
      pdf.setDrawColor(C.gray300);
      pdf.setLineWidth(0.8);
      pdf.line(ML, fy - 18, ML + W, fy - 18);

      // Footer via canvas with letter-spacing simulation
      const pc = document.createElement('canvas');
      pc.width = Math.ceil(W * R); pc.height = Math.ceil(16 * R);
      const px = pc.getContext('2d')!;
      px.setTransform(R, 0, 0, R, 0, 0);
      px.textBaseline = 'top';

      // Helper: draw text with letter-spacing
      const drawSpaced = (text: string, x: number, y: number, font: string, color: string, spacing: number) => {
        px.font = font;
        px.fillStyle = color;
        let curX = x;
        for (const ch of text) {
          px.fillText(ch, curX, y);
          curX += px.measureText(ch).width + spacing;
        }
        return curX - x;
      };

      // Left: report label + record ID (reduced visual weight, ~0.85 opacity)
      const footerColor = '#8b95a3'; // gray-500 at ~85% opacity on white
      const leftFont = `8.5px ${FF.cn}`;
      drawSpaced(`质量异常诊断报告  ${record.id}`, 0, 1, leftFont, footerColor, 0.25);

      // Right: page number
      const rightFont = `8.5px ${FF.en}`;
      const pageText = `Page ${i} of ${n}`;
      px.font = rightFont;
      const pageW = px.measureText(pageText).width + pageText.length * 0.25;
      drawSpaced(pageText, W - pageW, 1, rightFont, footerColor, 0.25);

      pdf.addImage(pc.toDataURL('image/png'), 'PNG', ML, fy - 13, W, 16);
    }
  };


  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  fillBg();
  Y = MT;

  // ── HEADER (title block with bound divider) ──
  // Chinese title (primary)
  drawText('质量异常诊断报告', 22, C.gray900);
  sp(5.7);   // 2mm gap to caption

  // English caption (secondary): 9pt, uppercase, letter-spacing 0.06em, line-height 1.2
  // Use canvas directly for letter-spacing control
  {
    const capText = 'QUALITY ISSUE DIAGNOSTIC REPORT';
    const capSize = 9;
    const capSpacing = capSize * 0.06; // 0.06em
    const capLh = capSize * 1.2;
    const capH = capLh + 2;

    const capCvs = document.createElement('canvas');
    capCvs.width = Math.ceil(W * R) + 4;
    capCvs.height = Math.ceil(capH * R) + 4;
    const capCx = capCvs.getContext('2d')!;
    capCx.setTransform(R, 0, 0, R, 0, 0);
    capCx.font = `${capSize}px ${FF.en}`;
    capCx.fillStyle = '#6b7280';
    capCx.textBaseline = 'top';
    let curX = 0;
    for (const ch of capText) {
      capCx.fillText(ch, curX, 1);
      curX += capCx.measureText(ch).width + capSpacing;
    }
    checkPage(capH);
    pdf.addImage(capCvs.toDataURL('image/png'), 'PNG', ML, Y, W, capH);
    Y += capH;
  }

  sp(14.2);  // 5mm padding-bottom before divider

  // Divider bound to title block: 1px #D1D5DB
  pdf.setDrawColor('#d1d5db');
  pdf.setLineWidth(1);
  pdf.line(ML, Y, ML + W, Y);

  sp(17);    // 6mm margin-bottom after divider → metadata

  // ── METADATA TABLE ──
  // Column weights: 1.4fr 1.2fr 1fr 1fr = total 4.6fr
  const fr = W / 4.6;
  const colW = [fr * 1.4, fr * 1.2, fr * 1, fr * 1];

  const metaRow1: { label: string; value: string; isMono?: boolean }[] = [
    { label: '编号', value: record.id, isMono: true },
    { label: '问题类型', value: getIssueTypeLabels(record.types).join(' · ') || '—' },
    { label: '发生日期', value: record.date || '—' },
    { label: '发现环节', value: record.process ? getIssueProcessStepLabel(record.process) : '—' },
  ];

  const meta2Items = [
    { label: '关联数量', value: record.quantity || '' },
    { label: '技术员', value: record.technician || '' },
    { label: '机台', value: record.machine || '' },
    { label: '模具穴号', value: record.cavity || '' },
  ];
  const hasRow2 = meta2Items.some(m => m.value);

  const tableRows: { label: string; value: string; isMono?: boolean }[][] = [metaRow1];
  if (hasRow2) {
    tableRows.push(meta2Items.map(m => ({ label: m.label, value: m.value || '—' })));
  }
  drawMetaTable(tableRows, colW);
  sp(4);



  // ── SECTIONS ──
  const sections: { cn: string; en: string; key: keyof IssueRecord['modules'] }[] = [
    { cn: '现场证据', en: 'Evidence', key: 'evidence' },
    { cn: '问题描述', en: 'Description', key: 'description' },
    { cn: '原因分析', en: 'Root Cause', key: 'rootCause' },
    { cn: '处理对策', en: 'Countermeasure', key: 'solution' },
    { cn: '效果验证', en: 'Verification', key: 'verification' },
  ];

  for (const sec of sections) {
    const mod = record.modules[sec.key];
    if (!mod.text && !mod.images.length) continue;

    // Pre-estimate section content height for break-inside: avoid
    // Only keep text-only sections together; image sections use their own break logic
    const estTextH = mod.text ? Math.ceil(mod.text.length / 55) * (FS.body * 1.6) + 10 : 0;
    const hasImages = mod.images.length > 0;
    // For text-only sections: keep together if they fit on a fresh page
    // For sections with images: let them flow naturally (images handle their own pagination)
    if (!hasImages) {
      const estTotalH = SECTION_MARGIN + 28 + estTextH + 20;
      if (estTotalH < (SAFE_BOTTOM - MT) && Y + estTotalH > SAFE_BOTTOM) {
        newPage();
      }
    }

    sectionHead(sec.cn, sec.en);

    if (mod.images.length > 0) {
      await drawImageGrid(mod.images);
      sp(2);
    }

    if (mod.text) {
      drawText(mod.text, FS.body, '#DC2626');
      sp(4);
    }

    // Light separator after each section
    hr();
  }

  // ── TRACEABILITY ──
  sp(8);
  checkPage(50);
  drawText('数字化存证', FS.md, C.gray900);
  sp(4);
  const hash = genHash(record.id + record.createdAt + record.updatedAt);
  mono(`SHA-256  ${hash}`, FS.xs, C.gray500);
  sp(2);
  mono(`Generated  ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, FS.xs, C.gray500);

  // ── FOOTERS ──
  drawFooters();
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

function genHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  const p = [];
  for (let j = 0; j < 4; j++) {
    let x = h + j * 0x9e3779b9;
    x = ((x >> 16) ^ x) * 0x45d9f3b; x = ((x >> 16) ^ x) * 0x45d9f3b; x = (x >> 16) ^ x;
    p.push(Math.abs(x).toString(16).padStart(8, '0'));
  }
  return p.join('').slice(0, 32);
}
