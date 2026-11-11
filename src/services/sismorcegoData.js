export const VICTIM_DESCRIPTIONS = {
  humano: {
    title: 'Espécie mordida: Humano',
    prefix: 'Selecione esta opção quando uma ',
    bold: 'pessoa',
    suffix:
      ' sofrer mordedura, arranhadura ou contato direto com saliva de morcego (espoliação).',
    stepTitle: 'Dados solicitados na sequência',
    stepBody:
      'Nome ou apelido do paciente, idade, local anatômico da mordedura e se já buscou atendimento médico.',
  },
  canino: {
    title: 'Espécie mordida: Canino / Felino',
    prefix: 'Selecione para ataques de morcegos em ',
    bold: 'cães ou gatos domésticos',
    suffix: ' da residência ou comunidade.',
    stepTitle: 'Importância epidemiológica',
    stepBody:
      'Animais domésticos atuam como ponte de transmissão entre o ciclo silvestre e os moradores. Informe se o animal é vacinado contra a raiva.',
  },
  aves: {
    title: 'Espécie mordida: Aves',
    prefix: 'Selecione quando houver espoliação sanguínea em ',
    bold: 'aves de criação ou subsistência',
    suffix: ' (galinhas, patos, perus, etc.).',
    stepTitle: 'Por que notificar ataques em aves?',
    stepBody:
      'Embora aves não transmitam a raiva para humanos, ataques frequentes em galinheiros indicam alta circulação de morcegos hematófagos próximos aos domicílios.',
  },
  producao: {
    title: 'Espécie mordida: Animal de Produção',
    prefix: 'Selecione para agressões em ',
    bold: 'herbívoros e animais de criação econômica',
    suffix: ': bovinos, bubalinos, equinos, suínos, caprinos ou ovinos.',
    stepTitle: 'Atenção em campo',
    stepBody:
      'Observe sinais neurológicos no rebanho (paralisia, isolamento ou dificuldade de locomoção) e nunca manipule a boca do animal sem luvas.',
  },
};

export const VICTIM_META = {
  humano: { title: 'Agressão em Humano', typeLabel: 'Humano' },
  canino: { title: 'Canino / Felino', typeLabel: 'Canino / Felino' },
  aves: { title: 'Aves', typeLabel: 'Aves' },
  producao: { title: 'Animal de produção', typeLabel: 'Animal de produção' },
};

export const VICTIM_FORMS = {
  humano: {
    title: 'Humano',
    missingMsg: 'Preencha os dados da pessoa mordida',
    savedMsg: 'Dados da espécie mordida concluídos!',
    groups: [
      {
        title: 'Pessoa agredida',
        fields: [
          {
            key: 'hv-nome',
            label: 'Nome',
            type: 'text',
            required: true,
            placeholder: '',
            errorMsg: 'Informe o nome da pessoa.',
          },
          {
            key: 'hv-apelido',
            label: 'Apelido',
            optionalTag: 'Opcional',
            type: 'text',
            required: false,
            placeholder: '',
            errorMsg: 'Campo obrigatório.',
          },
          {
            key: 'hv-idade',
            label: 'Idade',
            type: 'number',
            required: true,
            placeholder: '',
            min: 0,
            max: 120,
            errorMsg: 'Informe uma idade válida (0 a 120).',
          },
          {
            key: 'hv-sexo',
            label: 'Sexo',
            type: 'select',
            required: true,
            options: ['Masculino', 'Feminino'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'hv-ocupacao',
            label: 'Ocupação/profissão',
            type: 'text',
            required: true,
            placeholder: '',
            errorMsg: 'Informe a ocupação.',
          },
        ],
      },
      {
        title: 'Circunstância',
        fields: [
          {
            key: 'hv-circ',
            label: 'Circunstância da mordedura',
            type: 'select',
            required: true,
            options: ['Em casa, dormindo', 'Na praia', 'No barco', 'Outro'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'hv-praia', label: 'Qual praia?', type: 'text', required: false,
            showWhen: { key: 'hv-circ', equals: 'Na praia' },
          },
          {
            key: 'hv-circ-desc',
            label: 'Descreva a circunstância',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'hv-circ', equals: 'Outro' },
            errorMsg: 'Descreva a circunstância.',
          },
        ],
      },
      {
        title: 'Atendimento',
        fields: [
          {
            key: 'hv-atend',
            label: 'Buscou atendimento?',
            type: 'select',
            required: true,
            options: ['Sim', 'Não'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'hv-atend-motivo', label: 'Por que não buscou atendimento?', type: 'select', required: false,
            options: ['Distância', 'Falta de recurso financeiro', 'Não se importou com o ocorrido'],
            showWhen: { key: 'hv-atend', equals: 'Não' },
          },
        ],
      },
      {
        title: 'Abrigo de morcego (opcional)',
        fields: [
          {
            key: 'hv-abrigo',
            label: 'Há abrigo de morcego no local?',
            type: 'select',
            required: false,
            options: ['Sim', 'Não'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'hv-tipo',
            label: 'Tipo de abrigo',
            type: 'select',
            required: true,
            options: ['Natural', 'Artificial', 'Outro'],
            showWhen: { key: 'hv-abrigo', equals: 'Sim' },
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'hv-desc',
            label: 'Descreva o abrigo',
            type: 'text',
            required: false,
            placeholder: '',
            showWhen: { key: 'hv-tipo', equals: 'Outro' },
            errorMsg: 'Campo obrigatório.',
          },
        ],
      },
    ],
  },
  canino: {
    title: 'Canino / Felino',
    missingMsg: 'Preencha os dados do animal',
    savedMsg: 'Dados do animal concluídos!',
    groups: [
      {
        title: 'Animal',
        fields: [
          {
            key: 'cf-especie',
            label: 'Espécie',
            type: 'select',
            required: true,
            options: ['Canina', 'Felina'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'cf-circ',
            label: 'Circunstância da mordedura',
            type: 'select',
            required: true,
            options: [
              'Dormindo fora de casa',
              'Saiu para pescar com o proprietário',
              'Outro',
            ],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'cf-circ-desc',
            label: 'Descreva a circunstância',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'cf-circ', equals: 'Outro' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
      {
        title: 'Vacinação',
        fields: [
          {
            key: 'cf-vac',
            label: 'Participou da última campanha de vacinação?',
            type: 'select',
            required: true,
            options: ['Sim', 'Não'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'cf-vac-motivo',
            label: 'Por que não participou?',
            type: 'select',
            required: true,
            options: [
              'Outro (descrever)',
              'Não sabe / não lembra',
              'Não sabia da campanha',
              'Não conseguiu participar',
            ],
            showWhen: { key: 'cf-vac', equals: 'Não' },
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'cf-vac-motivo-desc',
            label: 'Descreva o motivo',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'cf-vac-motivo', equals: 'Outro (descrever)' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
      {
        title: 'Notificação ao município',
        fields: [
          {
            key: 'cf-aviso',
            label: 'Avisou o município?',
            type: 'select',
            required: true,
            options: ['Sim', 'Não'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'cf-aviso-motivo',
            label: 'Por que não avisou?',
            type: 'select',
            required: true,
            options: ['Não sabia', 'Não deu importância', 'Outro'],
            showWhen: { key: 'cf-aviso', equals: 'Não' },
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'cf-aviso-motivo-desc',
            label: 'Descreva o motivo',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'cf-aviso-motivo', equals: 'Outro' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
    ],
  },
  aves: {
    title: 'Aves',
    missingMsg: 'Preencha os dados da ave',
    savedMsg: 'Dados da ave concluídos!',
    groups: [
      {
        title: 'Ave',
        fields: [
          {
            key: 'av-especie',
            label: 'Espécie',
            type: 'select',
            required: true,
            options: ['Galinha', 'Pato', 'Ave silvestre'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'av-circ',
            label: 'Circunstância da mordedura',
            type: 'select',
            required: true,
            options: ['No galinheiro', 'Outro'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'av-circ-desc',
            label: 'Descreva a circunstância',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'av-circ', equals: 'Outro' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
      {
        title: 'Notificação',
        fields: [
          {
            key: 'av-aviso',
            label: 'Avisou a ADEPARÁ ou o município?',
            type: 'select',
            required: true,
            options: ['Sim', 'Não'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'av-motivo',
            label: 'Por que não avisou?',
            type: 'select',
            required: true,
            options: ['Não sabia', 'Não deu importância', 'Outro'],
            showWhen: { key: 'av-aviso', equals: 'Não' },
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'av-motivo-desc',
            label: 'Descreva o motivo',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'av-motivo', equals: 'Outro' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
    ],
  },
  producao: {
    title: 'Animal de produção',
    missingMsg: 'Preencha os dados do animal de produção',
    savedMsg: 'Dados do animal de produção concluídos!',
    groups: [
      {
        title: 'Animal',
        fields: [
          {
            key: 'pr-especie',
            label: 'Espécie',
            type: 'select',
            required: true,
            options: ['Bovino', 'Equino', 'Suíno'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'pr-circ',
            label: 'Circunstância da mordedura',
            type: 'select',
            required: true,
            options: ['Solto no pasto', 'Chiqueiro/Curral', 'Outro'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'pr-circ-desc',
            label: 'Descreva a circunstância',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'pr-circ', equals: 'Outro' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
      {
        title: 'Vacinação',
        fields: [
          {
            key: 'pr-vac',
            label: 'Participou da última campanha de vacinação?',
            type: 'select',
            required: true,
            options: ['Sim', 'Não', 'Não sabe / não lembra'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'pr-vac-motivo',
            label: 'Por que não participou?',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'pr-vac', equals: 'Não' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
      {
        title: 'Notificação',
        fields: [
          {
            key: 'pr-aviso',
            label: 'Avisou a ADEPARÁ ou o município?',
            type: 'select',
            required: true,
            options: ['Sim', 'Não'],
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'pr-aviso-motivo',
            label: 'Por que não avisou?',
            type: 'select',
            required: true,
            options: ['Não sabia', 'Não deu importância', 'Outro'],
            showWhen: { key: 'pr-aviso', equals: 'Não' },
            errorMsg: 'Selecione uma opção.',
          },
          {
            key: 'pr-aviso-motivo-desc',
            label: 'Descreva o motivo',
            type: 'text',
            required: true,
            placeholder: '',
            showWhen: { key: 'pr-aviso-motivo', equals: 'Outro' },
            errorMsg: 'Preencha este campo.',
          },
        ],
      },
    ],
  },
};

export function isVictimFieldVisible(field, values = {}) {
  if (!field || !field.showWhen) return true;
  return (values[field.showWhen.key] || '') === field.showWhen.equals;
}

export function clearHiddenVictimFields(victimKey, sourceValues = {}) {
  const form = VICTIM_FORMS[victimKey];
  if (!form) return { ...sourceValues };
  const next = { ...sourceValues };
  let changed = true;
  while (changed) {
    changed = false;
    form.groups.forEach((group) => {
      group.fields.forEach((field) => {
        if (!isVictimFieldVisible(field, next) && next[field.key]) {
          delete next[field.key];
          changed = true;
        }
      });
    });
  }
  return next;
}

export function validateVictimFields(victimKey, values = {}) {
  const form = VICTIM_FORMS[victimKey];
  const errors = {};
  let firstErrorFieldKey = null;
  if (!form) return { valid: true, errors, firstErrorFieldKey };

  form.groups.forEach((group) => {
    group.fields.forEach((field) => {
      if (!isVictimFieldVisible(field, values)) return;
      const val = String(values[field.key] ?? '').trim();
      let invalid = false;
      let errText = field.errorMsg || 'Campo obrigatório.';
      if (field.required && !val) {
        invalid = true;
      } else if (field.type === 'number' && val) {
        const num = Number(val);
        if (
          !Number.isInteger(num) ||
          (field.min !== undefined && num < field.min) ||
          (field.max !== undefined && num > field.max)
        ) {
          invalid = true;
          errText =
            field.errorMsg || 'Informe uma idade válida (0 a 120).';
        }
      }
      if (invalid) {
        errors[field.key] = errText;
        if (!firstErrorFieldKey) firstErrorFieldKey = field.key;
      }
    });
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    firstErrorFieldKey,
  };
}

export function getFilledVictimDetailItems(victimKey, details = {}) {
  const form = VICTIM_FORMS[victimKey];
  if (!form || !details) return [];
  const items = [];
  form.groups.forEach((group) => {
    group.fields.forEach((field) => {
      const value = String(details[field.key] ?? '').trim();
      if (value) {
        items.push({ key: field.key, label: field.label, value });
      }
    });
  });
  return items;
}

export function getReporterInitials(name) {
  const clean = String(name || '').trim();
  if (
    !clean ||
    clean === 'Agente de Saúde (Você)' ||
    clean === 'Agente de Saúde'
  ) {
    return 'SC';
  }
  const words = clean
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return (words[0] || 'SC').slice(0, 2).toUpperCase();
}

export function formatDatePtBrFromIso(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function parseBrDate(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return {
    year,
    monthIndex,
    day,
    iso: toIsoDateString(year, monthIndex, day),
    display: `${match[1]}/${match[2]}/${match[3]}`,
  };
}

export function toIsoDateString(year, monthIndex, day) {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export { addNewRecordToStorage, deleteRecordFromStorage, loadAccountProfile, loadRecordsFromStorage, loadReporterName, saveAccountProfile, saveReporterNameToStorage, triggerSyncRecords, updateRecordInStorage, acceptRemoteRecordInStorage, loadPendingCount } from './redesignData';
