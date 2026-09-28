// src/pages/Main/NovoRegistro.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Image, DeviceEventEmitter, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import NetInfo from "@react-native-community/netinfo";
import "react-native-get-random-values"; // precisa vir antes do nanoid
import { nanoid } from "nanoid";

import { addToQueue } from "../../services/offlineQueue";
import { syncPendingRegistros } from "../../services/syncRegistros";
import { auth } from "../../services/firebase";
import {
  ScrollScreen,
  ScreenHeader,
  Section,
  TextField,
  Select,
  DateField,
  Button,
  FooterBar,
  Badge,
  Card,
  Text,
  useToast,
} from "../../ui";
import { useTheme } from "../../theme/ThemeProvider";
import usePhotoAttachment from "../../hooks/usePhotoAttachment";
import useLocationCapture from "../../hooks/useLocationCapture";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";
import logger from "../../utils/logger";
import {
  SEXO,
  TRATAMENTO,
  ANIMAL,
  CIRCUNSTANCIA,
  POSSIVEL_ABRIGO,
  TIPO_ABRIGO,
} from "./registroOptions";

// Cada campo obrigatório pertence a uma seção; usada para rolar até o primeiro erro.
const REQUIRED = [
  { key: "nomeAcs", section: "responsavel", message: "Informe o nome do ACS." },
  { key: "nomeAgredido", section: "pessoa", message: "Informe o nome da pessoa agredida." },
  { key: "sexo", section: "pessoa", message: "Selecione o sexo." },
  { key: "tratamentoAntirrabico", section: "pessoa", message: "Informe se fez tratamento antirrábico." },
  { key: "municipio", section: "ocorrencia", message: "Informe o município da agressão." },
];

const createInitialForm = () => ({
  nomeAcs: "",
  dataRegistro: new Date(),
  apelido: "",
  nomeAgredido: "",
  idade: "",
  sexo: "",
  tratamentoAntirrabico: "",
  dataAgressao: new Date(),
  municipio: "",
  animalAgredido: "",
  circunstancia: "",
  possivelAbrigo: "",
  abrigoOpcao: "",
  abrigoOutro: "",
});

export default function NovoRegistro() {
  const { spacing, radius, colors } = useTheme();
  const toast = useToast();
  useSpeakOnMount("Novo registro. Preencha os dados da ocorrência.");

  const scrollRef = useRef(null);
  const sectionY = useRef({});

  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const { photo, hasPhoto, pick: pickPhoto, reset: resetPhoto } = usePhotoAttachment();
  const { location, region, capturing, capture: captureLocation, reset: resetLocation } = useLocationCapture();

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const trackSection = (name) => (e) => {
    sectionY.current[name] = e.nativeEvent.layout.y;
  };

  // ===== Sincronização =====
  const safeSync = useCallback(
    (opts) => {
      syncPendingRegistros(opts).catch(() => {});
    },
    []
  );

  useEffect(() => {
    const notify = (n) => {
      toast.show(`${n} registro(s) enviados para o servidor.`, { tone: "success" });
      DeviceEventEmitter.emit("registros:changed");
    };

    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) safeSync({ notify });
    });

    safeSync();
    return () => unsub();
  }, [safeSync, toast]);

  const resetForm = () => {
    setForm(createInitialForm());
    setErrors({});
    resetLocation();
    resetPhoto();
  };

  // ===== Envio =====
  const validate = () => {
    const next = {};
    for (const { key, message } of REQUIRED) {
      if (!String(form[key] ?? "").trim()) next[key] = message;
    }
    setErrors(next);

    const first = REQUIRED.find(({ key }) => next[key]);
    if (first) {
      const y = sectionY.current[first.section] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
    }
    return !first;
  };

  const salvar = async () => {
    const user = auth?.currentUser;
    if (!user) {
      toast.show("Faça login para criar registros e sincronizar depois.", { tone: "danger" });
      return;
    }

    if (!validate()) {
      toast.show("Preencha os campos obrigatórios.", { tone: "warning" });
      return;
    }

    setSaving(true);

    // recordId identifica o registro sem expor dados pessoais.
    const recordId = nanoid();
    const now = new Date().toISOString();

    // PII (nomes) segue em claro até a fila; a camada SQLite criptografa em repouso.
    const registroData = {
      recordId,
      uid: user.uid,

      nomeAcs: form.nomeAcs.trim(),
      nomeAgredido: form.nomeAgredido.trim(),

      dataRegistro: form.dataRegistro.toISOString(),
      apelido: form.apelido,
      idade: Number(form.idade) || null,
      sexo: form.sexo,
      tratamentoAntirrabico: form.tratamentoAntirrabico,
      dataAgressao: form.dataAgressao.toISOString(),
      municipio: form.municipio.trim(),
      animalAgredido: form.animalAgredido,
      circunstancia: form.circunstancia,
      possivelAbrigo: form.possivelAbrigo,
      abrigoOpcao: form.abrigoOpcao,
      abrigoOutro: form.abrigoOutro || null,

      // Localização com metadados de precisão (não é PII).
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy ?? null,
            isHighAccuracy: !!location.isHighAccuracy,
            source: location.source || null,
          }
        : null,

      // Foto: Base64 só quando cabe no limite; o original fica no aparelho.
      photoBase64: photo.base64 || null,
      photoMime: photo.mime || null,
      photoSize: typeof photo.sizeBytes === "number" ? photo.sizeBytes : null,
      photoUriLocal: photo.localUri || null,

      status: "pending",
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAtLocal: now,
    };

    try {
      await addToQueue(registroData);

      toast.show("Registro salvo no aparelho. Será enviado quando houver internet.", { tone: "success" });
      resetForm();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      DeviceEventEmitter.emit("registros:changed");

      safeSync({
        notify: (n) => {
          toast.show(`${n} registro(s) enviados para o servidor.`, { tone: "success" });
          DeviceEventEmitter.emit("registros:changed");
        },
      });
    } catch (error) {
      logger.error("Erro ao salvar registro:", error);
      toast.show("Não foi possível salvar o registro no aparelho.", { tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const abrigoSim = form.possivelAbrigo === "sim";

  return (
    <ScrollScreen
      ref={scrollRef}
      header={<ScreenHeader title="Novo registro" subtitle="Campos sem “opcional” são obrigatórios." />}
      footer={
        <FooterBar>
          <Button
            title="Salvar registro"
            icon="check"
            onPress={salvar}
            loading={saving}
            disabled={capturing}
          />
        </FooterBar>
      }
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Responsável" onLayout={trackSection("responsavel")}>
        <TextField
          label="Nome do ACS"
          value={form.nomeAcs}
          onChangeText={(v) => setField("nomeAcs", v)}
          error={errors.nomeAcs}
          placeholder="Nome completo"
          autoCapitalize="words"
          autoComplete="name"
        />
        <DateField
          label="Data do registro"
          value={form.dataRegistro}
          onChange={(d) => setField("dataRegistro", d)}
          maximumDate={new Date()}
        />
      </Section>

      <Section title="Pessoa agredida" onLayout={trackSection("pessoa")}>
        <TextField
          label="Nome"
          value={form.nomeAgredido}
          onChangeText={(v) => setField("nomeAgredido", v)}
          error={errors.nomeAgredido}
          placeholder="Nome completo"
          autoCapitalize="words"
        />
        <TextField
          label="Apelido (opcional)"
          value={form.apelido}
          onChangeText={(v) => setField("apelido", v)}
          autoCapitalize="words"
        />
        <TextField
          label="Idade (opcional)"
          value={form.idade}
          onChangeText={(v) => setField("idade", v.replace(/\D/g, "").slice(0, 3))}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Select
          label="Sexo"
          value={form.sexo}
          onChange={(v) => setField("sexo", v)}
          options={SEXO}
          error={errors.sexo}
        />
        <Select
          label="Fez tratamento antirrábico?"
          title="Tratamento antirrábico"
          value={form.tratamentoAntirrabico}
          onChange={(v) => setField("tratamentoAntirrabico", v)}
          options={TRATAMENTO}
          error={errors.tratamentoAntirrabico}
        />
      </Section>

      <Section title="Ocorrência" onLayout={trackSection("ocorrencia")}>
        <DateField
          label="Data da agressão"
          value={form.dataAgressao}
          onChange={(d) => setField("dataAgressao", d)}
          maximumDate={new Date()}
        />
        <TextField
          label="Município da agressão"
          value={form.municipio}
          onChangeText={(v) => setField("municipio", v)}
          error={errors.municipio}
          placeholder="Ex.: Curuçá"
          autoCapitalize="words"
        />
        <Select
          label="Animal agredido (opcional)"
          title="Animal agredido"
          value={form.animalAgredido}
          onChange={(v) => setField("animalAgredido", v)}
          options={ANIMAL}
        />
        <Select
          label="Circunstância (opcional)"
          title="Circunstância"
          value={form.circunstancia}
          onChange={(v) => setField("circunstancia", v)}
          options={CIRCUNSTANCIA}
        />
      </Section>

      <Section title="Abrigo">
        <Select
          label="Possível abrigo? (opcional)"
          title="Possível abrigo"
          value={form.possivelAbrigo}
          onChange={(v) => {
            setField("possivelAbrigo", v);
            setField("abrigoOpcao", "");
            setField("abrigoOutro", "");
          }}
          options={POSSIVEL_ABRIGO}
        />
        {abrigoSim ? (
          <Select
            label="Tipo de abrigo (opcional)"
            title="Tipo de abrigo"
            value={form.abrigoOpcao}
            onChange={(v) => setField("abrigoOpcao", v)}
            options={TIPO_ABRIGO}
          />
        ) : null}
        {abrigoSim && form.abrigoOpcao === "outros" ? (
          <TextField
            label="Descreva o abrigo (opcional)"
            value={form.abrigoOutro}
            onChangeText={(v) => setField("abrigoOutro", v)}
          />
        ) : null}
      </Section>

      <Section title="Localização" description="Use o GPS do aparelho no local da ocorrência.">
        <Button
          title={location ? "Atualizar localização" : "Obter localização"}
          icon="crosshair"
          variant="secondary"
          onPress={captureLocation}
          loading={capturing}
        />

        {location ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              <View style={styles.rowBetween}>
                <Text variant="bodyStrong">
                  {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}
                </Text>
                <Badge
                  label={location.isHighAccuracy ? "Alta precisão" : "Aproximada"}
                  tone={location.isHighAccuracy ? "success" : "warning"}
                  icon="map-pin"
                />
              </View>
              <Text variant="caption" tone="muted">
                {typeof location.accuracy === "number"
                  ? `Precisão estimada: ~${Math.round(location.accuracy)} m (pode variar)`
                  : "Precisão não informada (pode variar)"}
              </Text>
              <MapView
                style={[styles.map, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
              </MapView>
            </View>
          </Card>
        ) : null}
      </Section>

      <Section title="Foto (opcional)">
        <View style={[styles.row, { gap: spacing.md }]}>
          <Button title="Câmera" icon="camera" variant="secondary" onPress={() => pickPhoto("camera")} style={styles.half} />
          <Button title="Galeria" icon="image" variant="secondary" onPress={() => pickPhoto("gallery")} style={styles.half} />
        </View>

        {hasPhoto ? (
          <Card>
            <View style={{ gap: spacing.md }}>
              {photo.previewUri ? (
                <Image
                  source={{ uri: photo.previewUri }}
                  style={[styles.preview, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}
                  accessibilityLabel="Pré-visualização da foto do registro"
                />
              ) : null}
              <Badge
                label={photo.base64 ? "Salva e pronta para envio" : "Salva só no aparelho"}
                tone={photo.base64 ? "success" : "warning"}
                icon={photo.base64 ? "check-circle" : "smartphone"}
              />
              <Button title="Remover foto" icon="trash-2" variant="ghost" onPress={resetPhoto} />
            </View>
          </Card>
        ) : null}
      </Section>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  half: { flex: 1 },
  map: { height: 160 },
  preview: { width: "100%", aspectRatio: 4 / 3 },
});
