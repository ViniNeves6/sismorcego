export const sentences = (...parts) => parts.flat(Infinity).filter(value => value !== null && value !== undefined && value !== '').map(String).join('. ');
export function describeRecord(record) {
  if (!record) return '';
  return sentences(record.title || record.tipoVitima || 'Ocorrência', record.statusLabel,
    record.city ? `Município: ${record.city}` : '', record.community || record.locality,
    record.date ? `Data: ${record.date}` : '', record.reporter ? `Agente: ${record.reporter}` : '');
}
export function describeRecords(records, label = 'Registros') {
  return sentences(`${label}. ${records.length} ${records.length === 1 ? 'item' : 'itens'}`,
    records.slice(0, 3).map(describeRecord), records.length > 3 ? 'Há mais itens na lista' : '');
}
export function describeMessage(message) {
  return typeof message === 'string' ? message : sentences(message?.prefix, message?.bold, message?.suffix, message?.stepTitle, message?.stepBody);
}
export function describeChart(data) {
  return sentences('Registros por período', data.periodTitle, `Total: ${data.sum}`,
    data.buckets.map((bucket, index) => `${bucket.caption}: ${data.values[index]} registros`));
}
