// A interface do redesign usa rótulos; a base existente usa estes códigos.
// Esta fronteira preserva o contrato do banco, do painel e dos PDFs antigos.
import * as options from '../pages/Main/registro/registroTypeOptions';
import { registroIsoDate } from './registroDate';
import { gpsAccuracy, isValidGpsCoordinates } from './gpsCoordinates';
import { isCancelledRecord } from './recordLifecycle';

const sexo = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }];
const mappings = {
  humano: [
    ['hv-nome', 'nomeAgredido'], ['hv-apelido', 'apelido'], ['hv-idade', 'idade'],
    ['hv-sexo', 'sexo', sexo], ['hv-ocupacao', 'ocupacaoProfissao'],
    ['hv-circ', 'circunstancia', options.CIRCUNSTANCIA_HUMANO],
    ['hv-praia', 'circunstanciaPraiaQual'], ['hv-circ-desc', 'circunstanciaOutraDescricao'],
    ['hv-atend', 'buscouAtendimento', options.SIM_NAO],
    ['hv-atend-motivo', 'naoBuscouMotivo', options.MOTIVO_NAO_BUSCOU],
    ['hv-abrigo', 'abrigoMorcego', options.SIM_NAO],
    ['hv-tipo', 'abrigoTipo', [...options.TIPO_ABRIGO_MORCEGO, { value: 'outro', label: 'Outro' }]],
    ['hv-desc', 'abrigoDescricao'],
    ['hv-local', 'localAgressao'],
  ],
  canino: [
    ['cf-especie', 'especie', options.ESPECIE_CANINO_FELINO],
    ['cf-circ', 'circunstancia', options.CIRCUNSTANCIA_CANINO_FELINO],
    ['cf-circ-desc', 'circunstanciaDescricao'],
    ['cf-vac', 'participouVacinacao', options.SIM_NAO],
    ['cf-vac-motivo', 'naoParticipouMotivo', options.MOTIVO_NAO_PARTICIPOU_CANINO_FELINO],
    ['cf-vac-motivo-desc', 'naoParticipouDescricao'],
    ['cf-aviso', 'avisouMunicipio', options.SIM_NAO],
    ['cf-aviso-motivo', 'naoAvisouMotivo', options.MOTIVO_NAO_AVISOU],
    ['cf-aviso-motivo-desc', 'naoAvisouDescricao'],
    ['cf-local', 'localAgressao'],
  ],
  aves: [
    ['av-especie', 'especie', options.ESPECIE_AVES],
    ['av-circ', 'circunstancia', options.CIRCUNSTANCIA_AVES], ['av-circ-desc', 'circunstanciaDescricao'],
    ['av-aviso', 'avisouAdeparaOuMunicipio', options.SIM_NAO],
    ['av-motivo', 'naoAvisouMotivo', options.MOTIVO_NAO_AVISOU], ['av-motivo-desc', 'naoAvisouDescricao'],
    ['av-local', 'localAgressao'],
  ],
  producao: [
    ['pr-especie', 'especie', options.ESPECIE_PRODUCAO],
    ['pr-circ', 'circunstancia', options.CIRCUNSTANCIA_PRODUCAO], ['pr-circ-desc', 'circunstanciaDescricao'],
    ['pr-vac', 'participouVacinacao', options.PARTICIPOU_VACINACAO_PRODUCAO],
    ['pr-vac-motivo', 'naoParticipouDescricao'],
    ['pr-aviso', 'avisouAdeparaOuMunicipio', options.SIM_NAO],
    ['pr-aviso-motivo', 'naoAvisouMotivo', options.MOTIVO_NAO_AVISOU], ['pr-aviso-motivo-desc', 'naoAvisouDescricao'],
    ['pr-local', 'localAgressao'],
  ],
};
const titles = { humano: 'Agressão em Humano', canino: 'Canino / Felino', aves: 'Aves', producao: 'Animal de produção' };
const labelFor = (list, value) => list?.find(o => String(o.value) === String(value))?.label ?? value ?? '';
const valueFor = (list, label) => list?.find(o => o.label === label)?.value ?? label;

export function toRecordView(raw) {
  const victimKey = raw.tipoVitima === 'caninoFelino' ? 'canino' : raw.tipoVitima || 'humano';
  const source = raw.detalhes || raw; // Registros humanos anteriores à separação por tipo.
  const details = {};
  (mappings[victimKey] || []).forEach(([key, name, list]) => {
    let value = source[name];
    if (name === 'sexo') value = value === 1 ? 'M' : value === 2 ? 'F' : value;
    details[key] = String(labelFor(list, value));
  });
  const date = registroIsoDate(raw.dataMordedura || raw.dataAgressao || raw.dataRegistro);
  const location = raw.location;
  const gps = location && isValidGpsCoordinates(location.latitude, location.longitude)
    ? { lat: location.latitude, lng: location.longitude, accuracy: location.accuracy, source: location.source, isHighAccuracy: location.isHighAccuracy,
      text: `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` } : null;
  const dataUrl = !raw.photoHidden && raw.photoBase64 ? `data:${raw.photoMime || 'image/jpeg'};base64,${raw.photoBase64}` : null;
  const localUri = !raw.photoHidden && (raw._origin !== 'cloud' || raw.hasLocalPhoto) ? raw.photoUriLocal || raw.photoLocalUri : null;
  // Caminhos locais pertencem ao aparelho que capturou a foto.
  const uri = localUri || dataUrl;
  const status = raw.status || (raw._origin === 'cloud' ? 'synced' : 'pending');
  return {
    id: String(raw.recordId || raw.id), uid: raw.uid, victimKey, title: titles[victimKey] || raw.tipoVitima,
    city: raw.municipio || '', community: raw.localidade || '', isoDate: date,
    date: date ? date.split('-').reverse().join('/') : '', reporter: raw.nomeNotificador || raw.nomeAcs || '',
    status, lifecycleStatus: raw.lifecycleStatus || 'active', cancellation: raw.cancellation || null,
    statusLabel: isCancelledRecord(raw) ? 'Registro cancelado' : ({ synced: 'Sincronizado', syncing: 'Enviando', failed: 'Falha no envio', pending: 'Aguardando envio' })[status] || status,
    gps, photo: uri ? { uri, dataUrl: uri, localUri, base64: raw.photoBase64, mime: raw.photoMime, sizeBytes: raw.photoSize } : null,
    details, _raw: raw,
  };
}

export function toStoredRecord(view, uid) {
  if (view.gps && !isValidGpsCoordinates(view.gps.lat, view.gps.lng)) {
    throw new Error('Coordenadas GPS inválidas. Capture a localização novamente antes de salvar.');
  }
  const raw = view._raw || {};
  const sameType = (raw.tipoVitima === 'caninoFelino' ? 'canino' : raw.tipoVitima || 'humano') === view.victimKey;
  const detalhes = sameType ? { ...(raw.detalhes || {}) } : {};
  (mappings[view.victimKey] || []).forEach(([key, name, list]) => {
    const value = view.details?.[key];
    if (value !== undefined) detalhes[name] = value === '' ? null : name === 'idade' ? Number(value) : valueFor(list, value);
  });
  const photo = view.photo;
  const existing = Boolean(raw.recordId || raw.id);
  const dataParts = photo?.dataUrl?.match(/^data:([^;]+);base64,(.*)$/s);
  return {
    ...raw,
    _origin: 'local',
    lifecycleVersion: 2,
    baseServerRevision: raw.baseServerRevision ?? raw.serverRevision ?? 0,
    recordId: String(view.id), uid,
    tipoVitima: view.victimKey === 'canino' ? 'caninoFelino' : view.victimKey,
    nomeNotificador: existing ? (raw.nomeNotificador ?? raw.nomeAcs ?? null) : view.reporter,
    nomeAcs: existing ? (raw.nomeAcs ?? null) : view.reporter,
    notificadorTipo: existing ? (raw.notificadorTipo ?? null) : (raw.notificadorTipo || 'acs'),
    dataRegistro: raw.dataRegistro || new Date().toISOString(), dataMordedura: view.isoDate, dataAgressao: view.isoDate,
    municipio: view.city, localidade: view.community || null, detalhes,
    location: view.gps ? { latitude: view.gps.lat, longitude: view.gps.lng, accuracy: gpsAccuracy(view.gps.accuracy),
      source: view.gps.source || raw.location?.source || 'gps', isHighAccuracy: view.gps.isHighAccuracy ?? raw.location?.isHighAccuracy ?? false } : null,
    photoBase64: photo?.base64 || dataParts?.[2] || null,
    photoMime: photo?.mime || dataParts?.[1] || null, photoSize: photo?.sizeBytes || null,
    photoLocalUri: photo?.localUri || (photo?.uri && !photo.uri.startsWith('data:') ? photo.uri : null),
    hasLocalPhoto: !!photo?.localUri || !!(photo?.uri && !photo.uri.startsWith('data:')),
    photoPolicyVersion:1, photoHidden:!photo,
    photoUriLocal: photo?.localUri || (photo?.uri && !photo.uri.startsWith('data:') ? photo.uri : null),
    status: 'pending', retryCount: 0, lastError: null,
    createdAt: raw.createdAt || new Date().toISOString(), updatedAtLocal: new Date().toISOString(),
    // A resposta de um envio anterior não pode sobrescrever esta edição.
    localRevision: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}
