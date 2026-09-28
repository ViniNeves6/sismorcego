// src/pages/Main/registro/RegistroCaninoFelino.js
import React, { useState } from "react";
import { ScrollScreen, ScreenHeader, Section, TextField, Select, Button, FooterBar, useToast } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import useSpeakOnMount from "../../../hooks/useSpeakOnMount";
import useSalvarRegistro from "../../../hooks/useSalvarRegistro";
import {
  ESPECIE_CANINO_FELINO,
  CIRCUNSTANCIA_CANINO_FELINO,
  MOTIVO_NAO_PARTICIPOU_CANINO_FELINO,
  MOTIVO_NAO_AVISOU,
  SIM_NAO,
} from "./registroTypeOptions";

const REQUIRED = ["especie", "circunstancia", "participouVacinacao", "avisouMunicipio"];

export default function RegistroCaninoFelino({ navigation, route }) {
  const { comum } = route.params;
  const { spacing } = useTheme();
  const toast = useToast();
  useSpeakOnMount("Registro de mordedura em animal canino ou felino.");
  const { salvar, saving } = useSalvarRegistro();

  const [especie, setEspecie] = useState("");
  const [circunstancia, setCircunstancia] = useState("");
  const [participouVacinacao, setParticipouVacinacao] = useState("");
  const [naoParticipouMotivo, setNaoParticipouMotivo] = useState("");
  const [naoParticipouDescricao, setNaoParticipouDescricao] = useState("");
  const [avisouMunicipio, setAvisouMunicipio] = useState("");
  const [naoAvisouMotivo, setNaoAvisouMotivo] = useState("");
  const [naoAvisouDescricao, setNaoAvisouDescricao] = useState("");
  const [errors, setErrors] = useState({});

  const campos = { especie, circunstancia, participouVacinacao, avisouMunicipio };

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
      naoParticipouMotivo: participouVacinacao === "nao" ? naoParticipouMotivo || null : null,
      naoParticipouDescricao:
        participouVacinacao === "nao" && naoParticipouMotivo === "outro" ? naoParticipouDescricao.trim() || null : null,
      avisouMunicipio,
      naoAvisouMotivo: avisouMunicipio === "nao" ? naoAvisouMotivo || null : null,
      naoAvisouDescricao: avisouMunicipio === "nao" && naoAvisouMotivo === "outro" ? naoAvisouDescricao.trim() || null : null,
    };

    const ok = await salvar({ comum, tipoVitima: "caninoFelino", detalhes });
    if (ok) navigation.popToTop();
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Canino / Felino" onBack={() => navigation.goBack()} />}
      footer={
        <FooterBar>
          <Button title="Salvar registro" icon="check" onPress={salvarRegistro} loading={saving} />
        </FooterBar>
      }
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Animal">
        <Select label="Espécie" value={especie} onChange={setEspecie} options={ESPECIE_CANINO_FELINO} error={errors.especie} />
        <Select
          label="Circunstância da mordedura"
          value={circunstancia}
          onChange={setCircunstancia}
          options={CIRCUNSTANCIA_CANINO_FELINO}
          error={errors.circunstancia}
        />
      </Section>

      <Section title="Vacinação">
        <Select
          label="Participou da última campanha de vacinação?"
          value={participouVacinacao}
          onChange={setParticipouVacinacao}
          options={SIM_NAO}
          error={errors.participouVacinacao}
        />
        {participouVacinacao === "nao" ? (
          <Select
            label="Por quê não participou?"
            value={naoParticipouMotivo}
            onChange={setNaoParticipouMotivo}
            options={MOTIVO_NAO_PARTICIPOU_CANINO_FELINO}
          />
        ) : null}
        {participouVacinacao === "nao" && naoParticipouMotivo === "outro" ? (
          <TextField label="Descreva o motivo" value={naoParticipouDescricao} onChangeText={setNaoParticipouDescricao} />
        ) : null}
      </Section>

      <Section title="Notificação ao município">
        <Select
          label="Avisou o município?"
          value={avisouMunicipio}
          onChange={setAvisouMunicipio}
          options={SIM_NAO}
          error={errors.avisouMunicipio}
        />
        {avisouMunicipio === "nao" ? (
          <Select label="Por quê não avisou?" value={naoAvisouMotivo} onChange={setNaoAvisouMotivo} options={MOTIVO_NAO_AVISOU} />
        ) : null}
        {avisouMunicipio === "nao" && naoAvisouMotivo === "outro" ? (
          <TextField label="Descreva o motivo" value={naoAvisouDescricao} onChangeText={setNaoAvisouDescricao} />
        ) : null}
      </Section>
    </ScrollScreen>
  );
}
