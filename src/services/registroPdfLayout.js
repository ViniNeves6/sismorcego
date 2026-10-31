const TYPE_LABELS = {
  humano: 'Vítima humana', caninoFelino: 'Canino / Felino', canino: 'Canino / Felino',
  aves: 'Aves', producao: 'Animal de produção',
};
const COMMON_FIELDS = new Set(['Nome do notificador', 'Data do registro', 'Data da mordedura', 'Município', 'Localidade/comunidade']);
const GPS_FIELDS = new Set(['Latitude', 'Longitude']);
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const display = value => value == null || value === '' || value === '-' ? 'Não informado' : String(value);

export function buildFichaModel(registro, campos, imageBase64) {
  const sections = [
    { title: 'Notificação e local', fields: campos.filter(field => COMMON_FIELDS.has(field.label)) },
    { title: 'Informações da vítima', fields: campos.filter(field => !COMMON_FIELDS.has(field.label) && !GPS_FIELDS.has(field.label)) },
    { title: 'Georreferenciamento', fields: campos.filter(field => GPS_FIELDS.has(field.label)) },
  ].filter(section => section.fields.length);
  if (registro.lifecycleStatus === 'cancelled') sections.unshift({ title: 'Cancelamento', fields: [
    { label: 'Situação', value: 'Registro cancelado' },
    { label: 'Motivo', value: registro.cancellation?.reason || registro.cancellationReason },
  ] });
  return {
    type: TYPE_LABELS[registro.tipoVitima] || 'Registro de ocorrência',
    city: registro.municipio || '', community: registro.localidade || '',
    id: String(registro.recordId ?? registro.id ?? 'Não informado'),
    origin: registro._origin === 'cloud' ? 'Nuvem' : 'Neste aparelho',
    sections, imageBase64,
  };
}

export function buildFichaHtml(model, fontCss = '') {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
  <title>Sismorcego - Ficha de notificação</title><style>
  ${fontCss}
  @page { size: A4; margin: 30pt 36pt 54pt; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #181126; font: 10pt/1.45 Sismorcego, Arial, sans-serif; }
  .brand { width: 100%; border-bottom: 2pt solid #6824D6; padding-bottom: 12pt; margin-bottom: 14pt; }
  .brand td { padding: 0; border: 0; background: white; vertical-align: top; }
  .brand-name { color: #5316B8; font-size: 23pt; font-weight: 700; letter-spacing: -.5pt; }
  .brand-subtitle { color: #5E5473; font-size: 8pt; margin-top: 2pt; }
  .document-name { text-align: right; font-size: 11pt; font-weight: 700; padding-top: 6pt !important; }
  .summary { padding: 12pt 14pt; background: #F6F3FF; border: 1pt solid #DFD2FA; border-radius: 10pt; }
  .eyebrow { font-size: 7.5pt; font-weight: 700; color: #6824D6; letter-spacing: .7pt; text-transform: uppercase; }
  h1 { margin: 3pt 0 4pt; font-size: 17pt; line-height: 1.25; }
  .place { color: #5E5473; font-size: 10pt; overflow-wrap: anywhere; }
  .identity { margin: 8pt 0 16pt; color: #796E92; font-size: 8pt; overflow-wrap: anywhere; }
  h2 { font-size: 10.5pt; color: #5316B8; margin: 14pt 0 6pt; padding-left: 8pt;
    border-left: 3pt solid #6824D6; page-break-after: avoid; break-after: avoid; }
  .fields { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .fields tr { page-break-inside: avoid; break-inside: avoid; }
  .fields tr.long-answer { page-break-inside: auto; break-inside: auto; }
  .keep-together { page-break-inside: avoid; break-inside: avoid; }
  .fields th, .fields td { padding: 6pt 8pt; border-bottom: .6pt solid #EAE5F5;
    vertical-align: top; text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
  .fields th { width: 36%; font-size: 8.7pt; font-weight: 700; color: #5E5473; }
  .fields td { font-size: 10pt; }
  .fields tr:nth-child(odd) { background: #FAF8FD; }
  .photo { page-break-inside: avoid; break-inside: avoid; }
  .photo-frame { padding: 10pt; border: 1pt solid #EAE5F5; border-radius: 9pt; text-align: center; background: #FAF8FD; }
  .photo img { display: block; max-width: 100%; max-height: 150pt; width: auto; height: auto; object-fit: contain; margin: auto; }
  </style></head><body>
  <table class="brand"><tr><td><div class="brand-name">Sismorcego</div>
    <div class="brand-subtitle">Vigilância da raiva na Amazônia</div></td><td class="document-name">Ficha de notificação</td></tr></table>
  <div class="summary"><div class="eyebrow">Registro de ocorrência</div><h1>${escape(model.type)}</h1>
    <div class="place">${escape([model.city, model.community].filter(Boolean).join(' / '))}</div></div>
  <div class="identity">Origem: ${escape(model.origin)}<br />Identificador: ${escape(model.id)}</div>
  ${model.sections.map(section => `<section class="${section.fields.every(field => GPS_FIELDS.has(field.label)) ? 'keep-together' : ''}"><h2>${escape(section.title)}</h2><table class="fields"><tbody>${section.fields.map(field =>
    `<tr class="${String(field.value ?? '').length > 700 ? 'long-answer' : ''}"><th>${escape(field.label)}</th><td>${escape(display(field.value))}</td></tr>`).join('')}</tbody></table></section>`).join('')}
  ${model.imageBase64 ? `<section class="photo"><h2>Fotografia anexada</h2><div class="photo-frame"><img src="${escape(model.imageBase64)}" alt="Fotografia da ocorrência" /></div></section>` : ''}
  </body></html>`;
}

async function finishDocument(document) {
  const { StandardFonts, rgb } = require('pdf-lib');
  const font = await document.embedFont(StandardFonts.Helvetica);
  document.setTitle('Sismorcego - Ficha de notificação');
  document.setAuthor('Sismorcego');
  document.setSubject('Registro de ocorrência');
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    page.drawLine({ start: { x: 36, y: 42 }, end: { x: width - 36, y: 42 }, thickness: .6, color: rgb(.87, .82, .98) });
    page.drawText('Sismorcego | Ficha de notificação', { x: 36, y: 28, size: 8, font, color: rgb(.37, .33, .45) });
    const pageLabel = `${index + 1} / ${pages.length}`;
    page.drawText(pageLabel, { x: width - 36 - font.widthOfTextAtSize(pageLabel, 8), y: 28, size: 8, font, color: rgb(.37, .33, .45) });
  });
  return document.save();
}

export async function decorateFichaPdf(bytes) {
  const { PDFDocument } = require('pdf-lib');
  return finishDocument(await PDFDocument.load(bytes));
}

// Alternativa vetorial offline, com os mesmos dados, hierarquia e limites da versão HTML.
export async function buildStyledFichaPdf(model) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const purple = rgb(.325, .086, .72), ink = rgb(.094, .067, .149), muted = rgb(.37, .33, .45);
  const light = rgb(.965, .953, 1), border = rgb(.918, .898, .961);
  const width = 595.28, height = 841.89, left = 36, inner = width - left * 2, bottom = 58;
  let page, y;
  const safe = value => Array.from(display(value).replace(/[\u2010-\u2015]/g, '-').replace(/\u2026/g, '...')).map(char => {
    if (char === '\n') return char;
    if (char === '\t') return ' ';
    try { regular.encodeText(char); return char; } catch { return '?'; }
  }).join('');
  const wrap = (value, font, size, maxWidth) => {
    const lines = [];
    for (const paragraph of safe(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
        if (line) lines.push(line);
        line = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > maxWidth && line) { lines.push(line); line = ''; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const draw = (text, x, atY, size = 10, font = regular, color = ink) => page.drawText(safe(text), { x, y: atY, size, font, color });
  const newPage = () => {
    page = doc.addPage([width, height]);
    draw('Sismorcego', left, height - 49, 22, bold, purple);
    draw('Vigilância da raiva na Amazônia', left, height - 64, 8, regular, muted);
    draw('Ficha de notificação', width - 148, height - 48, 10, bold);
    page.drawLine({ start: { x: left, y: height - 75 }, end: { x: width - left, y: height - 75 }, thickness: 2, color: purple });
    y = height - 95;
  };
  const ensure = space => { if (y - space < bottom) newPage(); };
  const heading = title => { ensure(38); draw(title, left + 8, y, 10.5, bold, purple); y -= 15; };
  newPage();
  const placeLines = wrap([model.city, model.community].filter(Boolean).join(' / '), regular, 10, inner - 28);
  const summaryHeight = 47 + placeLines.length * 13;
  page.drawRectangle({ x: left, y: y - summaryHeight + 8, width: inner, height: summaryHeight, color: light, borderColor: border, borderWidth: 1 });
  draw('REGISTRO DE OCORRÊNCIA', left + 14, y - 7, 7.5, bold, purple);
  draw(model.type, left + 14, y - 28, 16, bold);
  placeLines.forEach((line, index) => draw(line, left + 14, y - 43 - index * 13, 10, regular, muted));
  y -= summaryHeight + 13;
  for (const line of wrap(`Origem: ${model.origin}\nIdentificador: ${model.id}`, regular, 8, inner)) { draw(line, left, y, 8, regular, muted); y -= 12; }
  y -= 10;
  for (const section of model.sections) {
    heading(section.title);
    for (let i = 0; i < section.fields.length; i++) {
      const field = section.fields[i];
      const labels = wrap(field.label, bold, 8.7, 164);
      const values = wrap(field.value, regular, 10, inner - 196);
      while (labels.length || values.length) {
        if (y - 38 < bottom) { newPage(); heading(`${section.title} (continuação)`); }
        const take = Math.min(Math.max(labels.length, values.length), Math.max(1, Math.floor((y - bottom - 12) / 14)));
        const rowHeight = take * 14 + 12;
        if (i % 2 === 0) page.drawRectangle({ x: left, y: y - rowHeight, width: inner, height: rowHeight, color: rgb(.98, .975, .995) });
        labels.splice(0, take).forEach((line, j) => draw(line, left + 8, y - 15 - j * 14, 8.7, bold, muted));
        values.splice(0, take).forEach((line, j) => draw(line, left + 188, y - 15 - j * 14));
        y -= rowHeight;
        page.drawLine({ start: { x: left, y }, end: { x: width - left, y }, thickness: .5, color: border });
      }
    }
    y -= 18;
  }
  if (model.imageBase64) {
    try {
      const image = /^data:image\/png/.test(model.imageBase64) ? await doc.embedPng(model.imageBase64) : await doc.embedJpg(model.imageBase64);
      const scale = Math.min((inner - 20) / image.width, 150 / image.height);
      const iw = image.width * scale, ih = image.height * scale;
      ensure(ih + 48); heading('Fotografia anexada');
      page.drawRectangle({ x: left, y: y - ih - 20, width: inner, height: ih + 20, color: light, borderColor: border, borderWidth: 1 });
      page.drawImage(image, { x: left + (inner - iw) / 2, y: y - ih - 10, width: iw, height: ih });
    } catch { /* Dados da ocorrência continuam disponíveis se a foto legada estiver danificada. */ }
  }
  return finishDocument(doc);
}
