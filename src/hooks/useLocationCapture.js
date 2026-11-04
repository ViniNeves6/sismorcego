// src/hooks/useLocationCapture.js
import { useCallback, useEffect, useRef, useState } from "react";
import { captureGpsLocation } from "../services/deviceCapture";
import { useToast } from "../ui";

// location = { latitude, longitude, accuracy, isHighAccuracy, source }
export default function useLocationCapture() {
  const toast = useToast();
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const operation = useRef(0);
  const busy = useRef(false);

  const reset = useCallback(() => {
    operation.current += 1;
    busy.current = false;
    setLocation(null);
    setRegion(null);
    setCapturing(false);
  }, []);

  useEffect(() => () => { operation.current += 1; }, []);

  const capture = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const request = ++operation.current;
    setCapturing(true);
    try {
      const coords = await captureGpsLocation();
      if (request !== operation.current) return;
      const { lat: latitude, lng: longitude, accuracy, source, isHighAccuracy } = coords;
      setLocation({ latitude, longitude, accuracy, source, isHighAccuracy });
      setRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      const accText = accuracy != null ? ` (~${Math.round(accuracy)} m)` : "";
      toast.show(isHighAccuracy ? `Localização registrada${accText}.` : `Localização aproximada${accText}. Para mais precisão, tente em área aberta.`, {
        tone: isHighAccuracy ? "success" : "warning", duration: isHighAccuracy ? 4000 : 6000,
      });
    } catch (error) {
      if (request === operation.current) toast.show(error.message, { tone: "danger", duration: 6000 });
    } finally {
      if (request === operation.current) { busy.current = false; setCapturing(false); }
    }
  }, [toast]);

  return { location, region, capturing, capture, reset };
}
