// src/pages/Main/NovoRegistro.js
// Tela 1 da pilha "Registrar": dados comuns a qualquer tipo de vítima
// (data, município, localidade, foto, geolocalização) + escolha do tipo,
// que decide pra qual tela específica ir em seguida (ver RegistrarStack.js).
import React, { useRef, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

import {
  ScrollScreen,
  ScreenHeader,
  Section,
  TextField,
  DateField,
  Button,
  Badge,
  Card,
  Text,
  useToast,
} from "../../ui";
import { useTheme } from "../../theme/ThemeProvider";
import useAuth from "../../hooks/useAuth";
import usePhotoAttachment from "../../hooks/usePhotoAttachment";
import useLocationCapture from "../../hooks/useLocationCapture";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";
import { TIPOS_VITIMA } from "./registro/registroTypeOptions";

const ROTA_POR_TIPO = {
  humano: "RegistroHumano",
  caninoFelino: "RegistroCaninoFelino",
  aves: "RegistroAves",
  producao: "RegistroProducao",
};

export default function NovoRegistro({ navigation }) {
  const { spacing, radius, colors } = useTheme();
  const toast = useToast();
  const { role } = useAuth();
  useSpeakOnMount("Novo registro. Preencha os dados comuns e escolha o tipo de vítima.");

  const scrollRef = useRef(null);

  const [nomeNotificador, setNomeNotificador] = useState("");
  const [dataMordedura, setDataMordedura] = useState(new Date());
  const [municipio, setMunicipio] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [errors, setErrors] = useState({});

  const { photo, hasPhoto, pick: pickPhoto, reset: resetPhoto } = usePhotoAttachment();
  const { location, region, capturing, capture: captureLocation } = useLocationCapture();

  const notificadorTipo = role === "coordenador" ? "Coordenador" : "ACS";

  const validate = () => {
    const next = {};
    if (!nomeNotificador.trim()) next.nomeNotificador = "Informe o nome do notificador.";
    if (!municipio.trim()) next.municipio = "Informe o município da mordedura.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const irParaTipo = (tipo) => {
    if (!validate()) {
      toast.show("Preencha os campos obrigatórios antes de continuar.", { tone: "warning" });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const comum = {
      notificadorTipo,
      nomeNotificador: nomeNotificador.trim(),
      dataRegistro: new Date().toISOString(),
      dataMordedura: dataMordedura.toISOString(),
      municipio: municipio.trim(),
      localidade: localidade.trim() || null,
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy ?? null,
            isHighAccuracy: !!location.isHighAccuracy,
            source: location.source || null,
          }
        : null,
      photoBase64: photo.base64 || null,
      photoMime: photo.mime || null,
      photoSize: typeof photo.sizeBytes === "number" ? photo.sizeBytes : null,
      photoUriLocal: photo.localUri || null,
    };

    navigation.navigate(ROTA_POR_TIPO[tipo], { comum });
  };

  return (
    <ScrollScreen
      ref={scrollRef}
      header={<ScreenHeader title="Novo registro" subtitle="Campos sem “opcional” são obrigatórios." />}
      contentContainerStyle={{ gap: spacing.xl }}
    >
      <Section title="Notificador">
        <TextField
          label="Nome do notificador"
          value={nomeNotificador}
          onChangeText={setNomeNotificador}
          error={errors.nomeNotificador}
          placeholder="Nome completo"
          autoCapitalize="words"
          autoComplete="name"
        />
        <Badge label={`Notificador: ${notificadorTipo}`} tone="primary" icon="user-check" />
      </Section>

      <Section title="Ocorrência">
        <DateField label="Data da mordedura" value={dataMordedura} onChange={setDataMordedura} maximumDate={new Date()} />
        <TextField
          label="Município da mordedura"
          value={municipio}
          onChangeText={setMunicipio}
          error={errors.municipio}
          placeholder="Ex.: Curuçá"
          autoCapitalize="words"
        />
        <TextField
          label="Localidade/comunidade (opcional)"
          value={localidade}
          onChangeText={setLocalidade}
          autoCapitalize="words"
        />
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
              <Button title="Remover foto" icon="trash-2" variant="ghost" onPress={resetPhoto} />
            </View>
          </Card>
        ) : null}
      </Section>

      <Section title="Tipo de vítima" description="Escolha pra continuar — a próxima tela pede os dados específicos.">
        <View style={{ gap: spacing.md }}>
          {TIPOS_VITIMA.map((tipo) => (
            <Button
              key={tipo.value}
              title={tipo.label}
              icon={tipo.icon}
              onPress={() => irParaTipo(tipo.value)}
            />
          ))}
        </View>
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
