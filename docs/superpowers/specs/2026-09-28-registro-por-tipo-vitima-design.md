# Registro ramificado por tipo de vítima

## Objetivo

Hoje `NovoRegistro.js` assume sempre uma vítima humana. A planilha
fornecida pelo usuário (fonte de verdade deste documento) define **4
tipos de vítima**, cada um com seu próprio conjunto de perguntas:
**Humano**, **Canino/Felino** (animal doméstico), **Aves**, **Animal
de produção**. O objetivo é ramificar o cadastro por tipo, mantendo
tudo mais no mesmo backend (Firestore/local) de hoje.

## Navegação

Novo `src/navigation/RegistrarStack.js` (mesmo padrão de
`MoreStack.js`), com duas camadas:

1. **`NovoRegistro`** (tela comum, é o arquivo `NovoRegistro.js`
   existente, reescrito) — pede: data da mordedura, município,
   localidade/comunidade (opcional), foto (opcional, mantém a
   funcionalidade atual), geolocalização, e termina com 4 botões
   grandes de tipo de vítima. `nomeAcs`/notificador continua sendo
   digitado manualmente (como hoje), mas o *rótulo* do tipo de
   notificador ("ACS"/"Coordenador") é preenchido sozinho a partir do
   papel de login (`useAuth().role`), sem perguntar de novo.
2. Ao escolher o tipo, navega para uma tela específica, passando os
   dados comuns como parâmetro de rota (`navigation.navigate(rota, {
   comum })`):
   - `RegistroHumano`
   - `RegistroCaninoFelino`
   - `RegistroAves`
   - `RegistroProducao`

`AppTabs.js` passa a apontar a aba "Registrar" pra `RegistrarStack`
em vez de `NovoRegistro` diretamente.

## Modelo de dados

Um objeto só, salvo do mesmo jeito de hoje (fila local
`offlineQueue` → Firestore `registros/{uid}/itens/{recordId}` — sem
mudança de schema SQL, já que a fila local grava um blob JSON
criptografado, schema-agnóstico):

```
{
  recordId, uid,
  tipoVitima: "humano" | "caninoFelino" | "aves" | "producao",

  // Comuns (tela 1)
  notificadorTipo: "ACS" | "Coordenador",   // auto, do papel de login
  nomeNotificador: string,                   // era "nomeAcs"
  dataRegistro, dataMordedura,                // era "dataAgressao"
  municipio, localidade,
  location: {...},                            // igual hoje
  photoBase64, photoMime, photoSize, photoUriLocal, // igual hoje

  // Específico do tipo (só um dos 4 formatos abaixo, conforme tipoVitima)
  detalhes: { ... }
}
```

### `detalhes` por tipo

**Humano:**
```
nomeAgredido*, apelido, idade*, sexo* (M|F), ocupacaoProfissao*,
circunstancia* ("em_casa_dormindo" | "praia" | "barco"),
circunstanciaPraiaQual (texto livre, só se circunstancia="praia"),
buscouAtendimento* (sim|nao),
naoBuscouMotivo ("distancia"|"falta_recurso"|"nao_se_importou", só se buscouAtendimento="nao"),
abrigoMorcego (sim|nao),
abrigoTipo ("natural"|"artificial", só se abrigoMorcego="sim"),
abrigoDescricao (texto livre, opcional, complementa abrigoTipo)
```

**Canino/Felino:**
```
especie* ("canina"|"felina"),
circunstancia* ("dormindo_fora_de_casa"|"saiu_pescar_com_proprietario"),
participouVacinacao* (sim|nao),
naoParticipouMotivo ("outro"|"nao_sabe", só se participouVacinacao="nao"),
naoParticipouDescricao (texto livre, só se naoParticipouMotivo="outro"),
avisouMunicipio* (sim|nao),
naoAvisouMotivo ("nao_sabia"|"nao_deu_importancia"|"outro", só se avisouMunicipio="nao"),
naoAvisouDescricao (texto livre, só se naoAvisouMotivo="outro")
```

**Aves:**
```
especie* ("galinha"|"pato"|"ave_silvestre"),
circunstancia* ("no_galinheiro"|"outro"),
circunstanciaDescricao (texto livre, só se circunstancia="outro"),
avisouAdeparaOuMunicipio* (sim|nao),
naoAvisouMotivo ("nao_sabia"|"nao_deu_importancia"|"outro", só se avisou="nao"),
naoAvisouDescricao (texto livre, só se naoAvisouMotivo="outro")
```

**Animal de produção:**
```
especie* ("bovino"|"equino"|"suino"),
circunstancia* ("solto_pasto"|"chiqueiro_curral"),
participouVacinacao* (sim|nao|nao_sabe),
naoParticipouDescricao (texto livre, só se participouVacinacao="nao"),
avisouAdeparaOuMunicipio* (sim|nao),
naoAvisouMotivo ("nao_sabia"|"nao_deu_importancia"|"outro", só se avisou="nao"),
naoAvisouDescricao (texto livre, só se naoAvisouMotivo="outro")
```

`*` = obrigatório (mesma convenção visual já usada: "Campos sem
'opcional' são obrigatórios").

## Compatibilidade com registros antigos

Registros sincronizados antes desta mudança não têm `tipoVitima` nem
`detalhes`. Onde o dado é lido (`RegistroCard`, `PdfOptionsSheet`,
`registroPdf.js`), trata `tipoVitima` ausente como `"humano"` e mapeia
os campos antigos pros novos nomes (`nomeAgredido` já bate,
`dataAgressao` → `dataMordedura`, `animalAgredido`/`circunstancia`
antigos ficam só de leitura — não tentam se encaixar no novo
`detalhes.circunstancia`, que tem opções diferentes; exibidos como
estão, sem tentar reclassificar).

## Arquivos tocados

- `src/navigation/RegistrarStack.js` (novo)
- `src/navigation/AppTabs.js` (aponta "Registrar" pro stack novo)
- `src/pages/Main/NovoRegistro.js` (reescrito: vira a tela comum)
- `src/pages/Main/registro/RegistroHumano.js` (novo)
- `src/pages/Main/registro/RegistroCaninoFelino.js` (novo)
- `src/pages/Main/registro/RegistroAves.js` (novo)
- `src/pages/Main/registro/RegistroProducao.js` (novo)
- `src/pages/Main/registro/registroTypeOptions.js` (novo — listas de
  opção por tipo; substitui as listas obsoletas de
  `registroOptions.js`: `ANIMAL`, `CIRCUNSTANCIA`, `POSSIVEL_ABRIGO`,
  `TIPO_ABRIGO`. `SEXO`/`TRATAMENTO` continuam em uso e ficam onde
  estão)
- `src/services/syncRegistros.js` (`buildCloudPayload` passa a incluir
  `tipoVitima`/`detalhes`/campos renomeados)
- `src/pages/Main/buscar/RegistroCard.js` (resumo condicional por tipo
  + fallback legado)
- `src/services/registroPdf.js` (seções condicionais por tipo +
  fallback legado)
- `src/database/registro.js` — **apagado** (confirmado código morto)

## Testes / validação

Sem testes automatizados novos (repo não tem suíte de integração pra
telas). Validação manual: criar um registro de cada um dos 4 tipos,
conferir que aparece certo no Buscar, no PDF, e que um registro
*antigo* (já sincronizado antes da mudança) ainda abre sem erro.

## Fora de escopo (adiado)

- Mapa de calor / painel analítico do coordenador (próximo ciclo,
  spec separada).
- Edição de registros já enviados.
