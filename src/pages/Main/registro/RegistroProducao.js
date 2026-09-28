// src/pages/Main/registro/RegistroProducao.js
import React, { useState } from "react";
import { ScrollScreen, ScreenHeader, Section, TextField, Select, Button, FooterBar, useToast } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import useSpeakOnMount from "../../../hooks/useSpeakOnMount";
import useSalvarRegistro from "../../../hooks/useSalvarRegistro";
import {
  ESPECIE_PRODUCAO,
  CIRCUNSTANCIA_PRODUCAO,
  PARTICIPOU_VACINACAO_PRODUCAO,
  MOTIVO_NAO_AVISOU,
  SIM_NAO,
} from "./registroTypeOptions";

const REQUIRED = ["especie", "circunstancia", "participouVacinacao", "avisouAdeparaOuMunicipio"];

export default function RegistroProducao({ navigation, route }) {
  const { comum } = route.params;
  const { spacing } = useTheme();
  const toast = useToast();
  useSpeakOnMount("Registro de mordedura em animal de produção.");
  const { salvar, saving } = useSalvarRegistro();

  const [especie, setEspecie] = useState("");
  const [circunstancia, setCircunstancia] = useState("");
  const [participouVacinacao, setParticipouVacinacao] = useState("");
  const [naoParticipouDescricao, setNaoParticipouDescricao] = useState("");
  const [avisouAdeparaOuMunicipio, setAvisouAdeparaOuMunicipio] = useState("");
  const [naoAvisouMotivo, setNaoAvisouMotivo] = useState("");
  const [naoAvisouDescricao, setNaoAvisouDescricao] = useState("");
  const [errors, setErrors] = useState({});

  const campos = { especie, circunstancia, participouVacinacao, avisouAdeparaOuMunicipio };

  const validate = () => {
    const next = {};
    for (const key of REQUIRED) {
      if (!String(campos[key] ?? "").trim()) next[key] = "Obrigatório.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const salvarRegistro = async () => {
    if (!validate()) {
      toast.show("Preencha os campos obrigatórios.", { tone: "warning" });
      return;
    }

    const detalhes = {
      especie,
      circunstancia,
      participouVacinacao,
      naoParticipouDescricao: participouVacinacao === "nao" ? naoParticipouDescricao.trim() || null : null,
      avisouAdeparaOuMunicipio,
      naoAvisouMotivo: avisouAdeparaOuMunicipio === "nao" ? naoAvisouMotivo || null : null,
      naoAvisouDescricao:
        avisouAdeparaOuMunicipio === "nao" && naoAvisouMotivo === "outro" ? naoAvisouDescricao.trim() || null : null,
    };

    const ok = await salvar({ comum, tipoVitima: "producao", detalhes });
    if (ok) navigation.popToTop();
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Animal de produção" onBack={() => navigation.goBack()} />}
      footer={
        <FooterBar>
          <Button title="Salvar registro" icon="check" onPress={salvarRegistro} loading={saving} />
        </FooterBar>
      }
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Animal">
        <Select label="Espécie" value={especie} onChange={setEspecie} options={ESPECIE_PRODUCAO} error={errors.especie} />
        <Select
          label="Circunstância da mordedura"
          value={circunstancia}
          onChange={setCircunstancia}
          options={CIRCUNSTANCIA_PRODUCAO}
          error={errors.circunstancia}
        />
      </Section>

      <Section title="Vacinação">
        <Select
          label="Participou da última campanha de vacinação?"
          value={participouVacinacao}
          onChange={setParticipouVacinacao}
          options={PARTICIPOU_VACINACAO_PRODUCAO}
          error={errors.participouVacinacao}
        />
        {participouVacinacao === "nao" ? (
          <TextField label="Por quê não participou?" value={naoParticipouDescricao} onChangeText={setNaoParticipouDescricao} />
        ) : null}
      </Section>

      <Section title="Notificação">
        <Select
          label="Avisou a ADEPARÁ ou o município?"
          value={avisouAdeparaOuMunicipio}
          onChange={setAvisouAdeparaOuMunicipio}
          options={SIM_NAO}
          error={errors.avisouAdeparaOuMunicipio}
        />
        {avisouAdeparaOuMunicipio === "nao" ? (
          <Select label="Por quê não avisou?" value={naoAvisouMotivo} onChange={setNaoAvisouMotivo} options={MOTIVO_NAO_AVISOU} />
        ) : null}
        {avisouAdeparaOuMunicipio === "nao" && naoAvisouMotivo === "outro" ? (
          <TextField label="Descreva o motivo" value={naoAvisouDescricao} onChangeText={setNaoAvisouDescricao} />
        ) : null}
      </Section>
    </ScrollScreen>
  );
}
