// src/pages/Main/NovoRegistro.js
// Tela 1 da pilha "Registrar": dados da notificação (notificador, data,
// município/localidade e geolocalização da notificação) + escolha do tipo de
// vítima, que decide pra qual tela específica ir em seguida — é lá que entram
// os dados da mordedura em si (ver RegistrarStack.js).
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
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
import useLocationCapture from "../../hooks/useLocationCapture";
import useSpeakOnMount from "../../hooks/useSpeakOnMount";
import { reverseGeocodeMunicipio } from "../../services/geocoding";
import { TIPOS_VITIMA } from "./registro/registroTypeOptions";

const ROTA_POR_TIPO = {
  humano: "RegistroHumano",
  caninoFelino: "RegistroCaninoFelino",
  aves: "RegistroAves",
  producao: "RegistroProducao",
};

export default function NovoRegistro({ navigation, route }) {
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

  const { location, region, capturing, capture: captureLocation, reset: resetLocation } = useLocationCapture();

  const notificadorTipo = role === "coordenador" ? "Coordenador" : "ACS";

  // Volta aqui depois de salvar (ver RegistroHumano/CaninoFelino/Aves/Producao):
  // limpa o formulário pra um novo registro, em vez de deixar os dados do
  // registro anterior preenchidos.
  useEffect(() => {
    if (!route.params?.savedAt) return;
    setNomeNotificador("");
    setDataMordedura(new Date());
    setMunicipio("");
    setLocalidade("");
    setErrors({});
    resetLocation();
    navigation.setParams({ savedAt: undefined });
  }, [route.params?.savedAt]);

  // Preenche o município pela localização (só se o campo ainda estiver
  // vazio — nunca sobrescreve o que a pessoa já digitou).
  useEffect(() => {
    if (!location) return;
    let cancelado = false;

    reverseGeocodeMunicipio(location.latitude, location.longitude).then((cidade) => {
      if (!cancelado && cidade) setMunicipio((prev) => (prev.trim() ? prev : cidade));
    });

    return () => {
      cancelado = true;
    };
  }, [location]);

  const validate = () => {
    const next = {};
    if (!nomeNotificador.trim()) next.nomeNotificador = "Informe o nome do notificador.";
    if (!municipio.trim()) next.municipio = "Informe o município da notificação.";
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
        <DateField label="Data da notificação" value={dataMordedura} onChange={setDataMordedura} maximumDate={new Date()} />
        <TextField
          label="Município da notificação"
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

      <Section title="Dados da mordedura" description="Escolha pra continuar — a próxima tela pede os dados específicos.">
        <View style={{ gap: spacing.md }}>
          {TIPOS_VITIMA.map((tipo) => (
            <Button
              key={tipo.value}
              title={tipo.label}
              icon={tipo.icon}
              iconFamily={tipo.iconFamily}
              onPress={() => irParaTipo(tipo.value)}
            />
          ))}
        </View>
      </Section>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  map: { height: 160 },
});
