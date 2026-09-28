// src/pages/Main/registro/RegistroHumano.js
import React, { useState } from "react";
import { View } from "react-native";
import { ScrollScreen, ScreenHeader, Section, TextField, Select, Button, FooterBar, useToast } from "../../../ui";
import { useTheme } from "../../../theme/ThemeProvider";
import useSpeakOnMount from "../../../hooks/useSpeakOnMount";
import useSalvarRegistro from "../../../hooks/useSalvarRegistro";
import { SEXO } from "../registroOptions";
import { CIRCUNSTANCIA_HUMANO, MOTIVO_NAO_BUSCOU, TIPO_ABRIGO_MORCEGO, SIM_NAO } from "./registroTypeOptions";

const REQUIRED = ["nomeAgredido", "idade", "sexo", "ocupacaoProfissao", "circunstancia", "buscouAtendimento"];

export default function RegistroHumano({ navigation, route }) {
  const { comum } = route.params;
  const { spacing } = useTheme();
  const toast = useToast();
  useSpeakOnMount("Registro de mordedura em humano.");
  const { salvar, saving } = useSalvarRegistro();

  const [nomeAgredido, setNomeAgredido] = useState("");
  const [apelido, setApelido] = useState("");
  const [idade, setIdade] = useState("");
  const [sexo, setSexo] = useState("");
  const [ocupacaoProfissao, setOcupacaoProfissao] = useState("");
  const [circunstancia, setCircunstancia] = useState("");
  const [circunstanciaPraiaQual, setCircunstanciaPraiaQual] = useState("");
  const [buscouAtendimento, setBuscouAtendimento] = useState("");
  const [naoBuscouMotivo, setNaoBuscouMotivo] = useState("");
  const [abrigoMorcego, setAbrigoMorcego] = useState("");
  const [abrigoTipo, setAbrigoTipo] = useState("");
  const [abrigoDescricao, setAbrigoDescricao] = useState("");
  const [errors, setErrors] = useState({});

  const campos = { nomeAgredido, idade, sexo, ocupacaoProfissao, circunstancia, buscouAtendimento };

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
      nomeAgredido: nomeAgredido.trim(),
      apelido: apelido.trim() || null,
      idade: Number(idade) || null,
      sexo,
      ocupacaoProfissao: ocupacaoProfissao.trim(),
      circunstancia,
      circunstanciaPraiaQual: circunstancia === "praia" ? circunstanciaPraiaQual.trim() || null : null,
      buscouAtendimento,
      naoBuscouMotivo: buscouAtendimento === "nao" ? naoBuscouMotivo || null : null,
      abrigoMorcego: abrigoMorcego || null,
      abrigoTipo: abrigoMorcego === "sim" ? abrigoTipo || null : null,
      abrigoDescricao: abrigoMorcego === "sim" ? abrigoDescricao.trim() || null : null,
    };

    const ok = await salvar({ comum, tipoVitima: "humano", detalhes });
    if (ok) navigation.popToTop();
  };

  return (
    <ScrollScreen
      header={<ScreenHeader title="Vítima humana" onBack={() => navigation.goBack()} />}
      footer={
        <FooterBar>
          <Button title="Salvar registro" icon="check" onPress={salvarRegistro} loading={saving} />
        </FooterBar>
      }
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Pessoa agredida">
        <TextField label="Nome" value={nomeAgredido} onChangeText={setNomeAgredido} error={errors.nomeAgredido} autoCapitalize="words" />
        <TextField label="Apelido (opcional)" value={apelido} onChangeText={setApelido} autoCapitalize="words" />
        <TextField
          label="Idade"
          value={idade}
          onChangeText={(v) => setIdade(v.replace(/\D/g, "").slice(0, 3))}
          error={errors.idade}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Select label="Sexo" value={sexo} onChange={setSexo} options={SEXO} error={errors.sexo} />
        <TextField
          label="Ocupação/profissão"
          value={ocupacaoProfissao}
          onChangeText={setOcupacaoProfissao}
          error={errors.ocupacaoProfissao}
        />
      </Section>

      <Section title="Circunstância">
        <Select
          label="Circunstância da mordedura"
          value={circunstancia}
          onChange={setCircunstancia}
          options={CIRCUNSTANCIA_HUMANO}
          error={errors.circunstancia}
        />
        {circunstancia === "praia" ? (
          <TextField label="Qual praia?" value={circunstanciaPraiaQual} onChangeText={setCircunstanciaPraiaQual} />
        ) : null}
      </Section>

      <Section title="Atendimento">
        <Select
          label="Buscou atendimento?"
          value={buscouAtendimento}
          onChange={setBuscouAtendimento}
          options={SIM_NAO}
          error={errors.buscouAtendimento}
        />
        {buscouAtendimento === "nao" ? (
          <Select
            label="Por quê não buscou?"
            value={naoBuscouMotivo}
            onChange={setNaoBuscouMotivo}
            options={MOTIVO_NAO_BUSCOU}
          />
        ) : null}
      </Section>

      <Section title="Abrigo de morcego (opcional)">
        <Select label="Há abrigo de morcego no local?" value={abrigoMorcego} onChange={setAbrigoMorcego} options={SIM_NAO} />
        {abrigoMorcego === "sim" ? (
          <View style={{ gap: spacing.md }}>
            <Select label="Tipo de abrigo" value={abrigoTipo} onChange={setAbrigoTipo} options={TIPO_ABRIGO_MORCEGO} />
            <TextField label="Descreva o abrigo (opcional)" value={abrigoDescricao} onChangeText={setAbrigoDescricao} />
          </View>
        ) : null}
      </Section>
    </ScrollScreen>
  );
}
