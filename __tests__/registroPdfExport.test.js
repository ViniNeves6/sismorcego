import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { generatePDF } from 'react-native-html-to-pdf';
import { PDFDocument, PDFName, PDFPage } from 'pdf-lib';
import { NativeModules } from 'react-native';
import FileShare from 'react-native-share';
import { buildCamposFicha, generateRegistroPdf, savePdf } from '../src/services/registroPdf';
import { buildFichaHtml, buildFichaModel, buildStyledFichaPdf } from '../src/services/registroPdfLayout';

jest.mock('react-native-html-to-pdf', () => ({ generatePDF: jest.fn() }));
jest.mock('react-native/Libraries/Utilities/Platform', () => ({ __esModule: true,
  default: { OS: 'android', select: options => options.android || options.default } }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache', readFile: jest.fn(), writeFile: jest.fn(), unlink: jest.fn(),
  readFileAssets: jest.fn().mockResolvedValue('font-data'),
}));

const record = {
  id: 'exemplo-123', municipio: 'Belém', localidade: 'Comunidade de exemplo', nomeAcs: 'Agente Exemplo',
  tipoVitima: 'humano', createdAt: '2026-10-29', dataMordedura: '2026-10-28',
  location: { latitude: -1.4, longitude: -48.5 },
  detalhes: { nomeAgredido: 'Pessoa Exemplo', apelido: 'Apelido Exemplo', idade: 27, sexo: 'F' },
};
const model = (r = record, image = null) => buildFichaModel(r, buildCamposFicha(r, { includeNames: true, includeLocation: true }), image);
test.each(['Coordenadora Ana', 'Coordenador Bruno'])('PDF retains the occurrence author %s instead of the shared account label', author => {
  const html = buildFichaHtml(model({ ...record, uid: 'shared', nomeAcs: author, nomeNotificador: author }));
  expect(html).toContain(author); expect(html).not.toContain('Sismorcego Teste');
});
beforeEach(() => jest.clearAllMocks());
afterEach(() => { delete NativeModules.SismorcegoDocuments; });

test('uses the installed named generatePDF API and adds page numbers and metadata to its output', async () => {
  const native = await PDFDocument.create();
  native.addPage([595, 842]); native.addPage([595, 842]);
  generatePDF.mockResolvedValue({ filePath: '/cache/native.pdf' });
  RNFS.readFile.mockResolvedValue(Buffer.from(await native.save()).toString('base64'));
  const result = await generateRegistroPdf(record);
  expect(generatePDF).toHaveBeenCalledWith(expect.objectContaining({ width: 595, height: 842, shouldPrintBackgrounds: true,
    html: expect.stringContaining('Sismorcego') }));
  const html = generatePDF.mock.calls[0][0].html;
  expect(html).toContain('@font-face');
  expect(html).toContain('29/10/2026');
  expect(html).toContain('28/10/2026');
  expect(RNFS.unlink).toHaveBeenCalledWith('/cache/native.pdf');
  expect(result.path).toMatch(/^file:\/\/\/cache\/Sismorcego_Belem_/);
  const saved = await PDFDocument.load(Buffer.from(RNFS.writeFile.mock.calls[0][1], 'base64'));
  expect(saved.getTitle()).toBe('Sismorcego - Ficha de notificação');
  expect(saved.getAuthor()).toBe('Sismorcego');
  expect(saved.getPageCount()).toBe(2);
  expect(saved.getPages().every(page => page.node.Contents().size() > 0)).toBe(true);
});

test('hides names and nicknames, preserves GPS privacy and escapes user text in HTML', () => {
  const r = { ...record, localidade: '<script>exemplo</script>' };
  const fields = buildCamposFicha(r, { includeNames: false, includeLocation: false });
  const html = buildFichaHtml(buildFichaModel(r, fields, null));
  for (const text of ['Pessoa Exemplo', 'Agente Exemplo', 'Apelido Exemplo', '-48.5', '<script>']) expect(html).not.toContain(text);
  expect(html).toContain('&lt;script&gt;exemplo&lt;/script&gt;');
  expect(fields.filter(f => ['Nome do notificador', 'Nome do agredido', 'Apelido', 'Latitude', 'Longitude'].includes(f.label))
    .every(f => f.value === '[oculto]')).toBe(true);
});

test('offline fallback paginates long answers and bounds a tall photo within the page', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAABkCAIAAADITs03AAAAFUlEQVR4nGNoYGhgYmBgGMUMgyIMACpeAcdDiYoSAAAAAElFTkSuQmCC';
  const drawImage = jest.spyOn(PDFPage.prototype, 'drawImage');
  const m = model(record, png);
  m.sections[1].fields.push({ label: 'Descrição', value: 'Descrição extensa de exemplo. '.repeat(300) });
  const doc = await PDFDocument.load(await buildStyledFichaPdf(m));
  expect(doc.getPageCount()).toBeGreaterThan(2);
  for (const page of doc.getPages()) {
    expect(page.getWidth()).toBeCloseTo(595.28);
    expect(page.getHeight()).toBeCloseTo(841.89);
  }
  const imagePage = doc.getPages().at(-1);
  expect(imagePage.node.Resources().lookup(PDFName.of('XObject')).keys()).toHaveLength(1);
  const dimensions = drawImage.mock.calls[0][1];
  expect(dimensions.height).toBeLessThanOrEqual(150);
  expect(dimensions.y).toBeGreaterThanOrEqual(58);
  expect(dimensions.y + dimensions.height).toBeLessThan(842);
  drawImage.mockRestore();
});

test('native conversion failure produces a branded PDF and respects the photo option', async () => {
  generatePDF.mockRejectedValue(new Error('Native unavailable'));
  const result = await generateRegistroPdf({ ...record, photoBase64: 'invalid photo' }, { includePhoto: false });
  const doc = await PDFDocument.load(Buffer.from(RNFS.writeFile.mock.calls[0][1], 'base64'));
  expect(doc.getAuthor()).toBe('Sismorcego');
  expect(result.path).toContain('Sismorcego_Belem');
  expect(generatePDF.mock.calls[0][0].html).not.toContain('invalid photo');
});

test('Android saves the actual PDF with its document chooser and returns cancellation without sharing', async () => {
  NativeModules.SismorcegoDocuments = { savePdf: jest.fn().mockResolvedValueOnce('saved').mockResolvedValueOnce(null) };
  const pdf = { path: 'file:///cache/Sismorcego_Belem.pdf' };
  await expect(savePdf(pdf)).resolves.toBe('saved');
  expect(NativeModules.SismorcegoDocuments.savePdf).toHaveBeenCalledWith('/cache/Sismorcego_Belem.pdf', 'Sismorcego_Belem.pdf');
  await expect(savePdf(pdf)).resolves.toBeNull();
  expect(FileShare.open).not.toHaveBeenCalled();
});

test('file sharing attaches application/pdf rather than sharing only a message', async () => {
  await expect(savePdf({ path: 'file:///cache/Sismorcego_Belem.pdf' })).resolves.toBe('shared');
  expect(FileShare.open).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///cache/Sismorcego_Belem.pdf', type: 'application/pdf', failOnCancel: false }));
  expect(RNFS.unlink).not.toHaveBeenCalled();
});

test.each(['humano', 'caninoFelino', 'aves', 'producao', undefined])('exports the fields for victim type %s', async tipoVitima => {
  const m = model({ ...record, tipoVitima });
  const pdf = await PDFDocument.load(await buildStyledFichaPdf(m));
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  expect(m.sections.map(section => section.title)).toContain('Georreferenciamento');
});

test('PDF lists the local da agressão only when it was filled', () => {
  const campos = r => buildCamposFicha(r, { includeNames: true, includeLocation: true });
  const base = { tipoVitima: 'aves', municipio: 'Belém', localidade: 'Centro', detalhes: { especie: 'galinha' } };
  expect(campos(base).some(c => c.label === 'Local da agressão')).toBe(false);
  expect(campos({ ...base, detalhes: { ...base.detalhes, localAgressao: 'Ilha do Combu' } }))
    .toContainEqual({ label: 'Local da agressão', value: 'Ilha do Combu' });
});
