// Datas de ocorrência não têm fuso horário. YYYY-MM-DD deve representar o
// mesmo dia no formulário, no painel e no PDF, inclusive no horário do Brasil.
export function parseRegistroDate(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  try {
    let date;
    if (typeof value?.toDate === 'function') date = value.toDate();
    else if (Number.isFinite(value?.seconds)) date = new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    else if (value instanceof Date) date = new Date(value.getTime());
    else {
      const text = String(value).trim();
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|T)/);
      const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?$/);
      if (iso || br) {
        const year = Number(iso ? iso[1] : br[3]);
        const month = Number(iso ? iso[2] : br[2]) - 1;
        const day = Number(iso ? iso[3] : br[1]);
        const hour = Number(br?.[4] || 0);
        const minute = Number(br?.[5] || 0);
        if (hour > 23 || minute > 59) return null;
        date = new Date(year, month, day, hour, minute);
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
        if (iso && text.length > 10) date = new Date(text);
      } else date = new Date(value);
    }
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}
export function registroIsoDate(value) {
  const date = parseRegistroDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
