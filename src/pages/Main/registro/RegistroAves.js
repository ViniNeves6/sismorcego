// src/pages/Main/registro/RegistroAves.js
import React, { useState } from "react";
import { ScrollScreen, ScreenHeader, Section, TextField, Select, Button, FooterBar, useToast } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import useSpeakOnMount from "../../../hooks/useSpeakOnMount";
import useSalvarRegistro from "../../../hooks/useSalvarRegistro";
import { ESPECIE_AVES, CIRCUNSTANCIA_AVES, MOTIVO_NAO_AVISOU, SIM_NAO } from "./registroTypeOptions";

const REQUIRED = ["especie", "circunstancia", "avisouAdeparaOuMunicipio"];

export default function RegistroAves({ navigation, route }) {
  const { comum } = route.params;
  const { spacing } = useTheme();
  const toast = useToast();
  useSpeakOnMount("Registro de mordedura em ave.");
  const { salvar, saving } = useSalvarRegistro();

  const [especie, setEspecie] = useState("");
  const [circunstancia, setCircunstancia] = useState("");
  const [circunstanciaDescricao, setCircunstanciaDescricao] = useState("");
  const [avisouAdeparaOuMunicipio, setAvisouAdeparaOuMunicipio] = useState("");
  const [naoAvisouMotivo, setNaoAvisouMotivo] = useState("");
  const [naoAvisouDescricao, setNaoAvisouDescricao] = useState("");
  const [errors, setErrors] = useState({});

  const campos = { especie, circunstancia, avisouAdeparaOuMunicipio };

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
      circunstanciaDescricao: circunstancia === "outro" ? circunstanciaDescricao.trim() || null : null,
      avisouAdeparaOuMunicipio,
      naoAvisouMotivo: avisouAdeparaOuMunicipio === "nao" ? naoAvisouMotivo || null : null,
      naoAvisouDescricao:
        avisouAdeparaOuMunicipio === "nao" && naoAvisouMotivo === "outro" ? naoAvisouDescricao.trim() || null : null,
    };

    const ok = await salvar({ comum, tipoVitima: "aves", detalhes });
    if (ok) navigation.popToTop();
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Aves" onBack={() => navigation.goBack()} />}
      footer={
        <FooterBar>
          <Button title="Salvar registro" icon="check" onPress={salvarRegistro} loading={saving} />
        </FooterBar>
      }
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Ave">
        <Select label="Espécie" value={especie} onChange={setEspecie} options={ESPECIE_AVES} error={errors.especie} />
        <Select
          label="Circunstância da mordedura"
          value={circunstancia}
          onChange={setCircunstancia}
          options={CIRCUNSTANCIA_AVES}
          error={errors.circunstancia}
        />
        {circunstancia === "outro" ? (
          <TextField label="Descreva a circunstância" value={circunstanciaDescricao} onChangeText={setCircunstanciaDescricao} />
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
