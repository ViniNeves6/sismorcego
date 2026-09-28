// src/hooks/useLocationCapture.js
import { useCallback, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import Geolocation from "@react-native-community/geolocation";
import { useToast } from "../ui";
import logger from "../utils/logger";

const DEFAULT_REGION = {
  latitude: -1.354986,
  longitude: -48.395724,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const getPosition = (highAccuracy) =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: highAccuracy ? 20000 : 12000,
      maximumAge: highAccuracy ? 5000 : 30000,
    });
  });

// Retorna true se a permissão foi concedida; senão, avisa e retorna false.
async function ensurePermission(toast) {
  if (Platform.OS === "android") {
    const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: "Permissão de localização",
      message: "O app precisa acessar sua localização para registrar o ponto.",
      buttonNeutral: "Pergunte-me depois",
      buttonNegative: "Cancelar",
      buttonPositive: "OK",
    });
    const coarse = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

    const ok = fine === PermissionsAndroid.RESULTS.GRANTED || coarse === PermissionsAndroid.RESULTS.GRANTED;
    if (!ok) {
      toast.show("Sem permissão de localização não é possível obter as coordenadas.", { tone: "danger" });
    }
    return ok;
  }

  if (Platform.OS === "ios") {
    try {
      const authz = await Geolocation.requestAuthorization();
      if (authz && authz !== "granted") {
        toast.show("Permissão de localização não concedida.", { tone: "danger" });
        return false;
      }
    } catch {
      // segue: o getCurrentPosition informa o erro real
    }
  }
  return true;
}

const describeError = (code) => {
  if (code === 1) return "Permissão de localização negada.";
  if (code === 2) return "Sinal de GPS indisponível. Tente em uma área aberta.";
  if (code === 3) return "Tempo limite excedido. Tente novamente.";
  return "Verifique se a localização do aparelho está ativada.";
};

// location = { latitude, longitude, accuracy, isHighAccuracy, source }
export default function useLocationCapture() {
  const toast = useToast();
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [capturing, setCapturing] = useState(false);

  const reset = useCallback(() => setLocation(null), []);

  const store = useCallback((position, isHighAccuracy) => {
    const { latitude, longitude, accuracy } = position.coords || {};
    const acc = typeof accuracy === "number" ? accuracy : null;

    setLocation({
      latitude,
      longitude,
      accuracy: acc,
      isHighAccuracy: !!isHighAccuracy,
      source: isHighAccuracy ? "gps_high" : "gps_coarse",
    });
    setRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    return acc;
  }, []);

  const capture = useCallback(async () => {
    try {
      setCapturing(true);
      if (!(await ensurePermission(toast))) return;

      try {
        const acc = store(await getPosition(true), true);
        const approx = acc ? ` Precisão estimada: ~${Math.round(acc)} m.` : "";
        toast.show(`Localização registrada.${approx}`, { tone: "success" });
      } catch {
        try {
          const position = await getPosition(false);
          const acc = store(position, false);
          const approx = typeof acc === "number" ? ` (~${Math.round(acc)} m)` : "";
          toast.show(
            `Localização aproximada${approx}. Para mais precisão, tente em área aberta com o GPS ativado.`,
            { tone: "warning", duration: 6000 }
          );
        } catch (lowAccuracyError) {
          toast.show(`Não foi possível obter sua localização. ${describeError(lowAccuracyError?.code)}`, {
            tone: "danger",
            duration: 6000,
          });
        }
      }
    } catch (error) {
      logger.error("Erro ao solicitar permissão:", error);
      toast.show("Não foi possível acessar o serviço de localização.", { tone: "danger" });
    } finally {
      setCapturing(false);
    }
  }, [store, toast]);

  return { location, region, capturing, capture, reset };
}
