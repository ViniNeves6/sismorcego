// src/services/geocoding.js
// Geocodificação reversa (lat/lng -> município) via Nominatim (OpenStreetMap),
// gratuito e sem chave de API. Uso leve (1 chamada por captura de localização),
// dentro do limite de uso aceitável do serviço.
import logger from "../utils/logger";

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

export async function reverseGeocodeMunicipio(latitude, longitude) {
  try {
    const url = `${ENDPOINT}?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SismorcegoApp/1.0 (contato via app; uso interno)" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const a = data?.address || {};
    return a.city || a.town || a.village || a.municipality || a.county || null;
  } catch (e) {
    logger.warn("geocoding: falha na geocodificação reversa", e);
    return null;
  }
}
