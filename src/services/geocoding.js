// src/services/geocoding.js
// Geocodificação reversa (lat/lng -> município e localidade) via Nominatim (OpenStreetMap),
// gratuito e sem chave de API. Uso leve (1 chamada por captura de localização),
// dentro do limite de uso aceitável do serviço.
import logger from "../utils/logger";
import { isValidGpsCoordinates } from "./gpsCoordinates";

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

const placeName = value => typeof value === "string" ? value.trim() : "";

export async function reverseGeocodeLocation(latitude, longitude) {
  if (!isValidGpsCoordinates(latitude, longitude)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${ENDPOINT}?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=pt-BR`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SismorcegoApp/1.0 (contato via app; uso interno)" },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = await res.json();
    const a = data?.address || {};
    const municipio = [a.city, a.town, a.municipality, a.county, a.village].map(placeName).find(Boolean) || null;
    // Só usa nomes de localidades: rua, estabelecimento e município não são comunidade.
    const localidade = [a.neighbourhood, a.quarter, a.hamlet, a.isolated_dwelling,
      a.locality, a.village, a.suburb, a.city_district, a.borough].map(placeName)
      .find(name => name && name.toLocaleLowerCase('pt-BR') !== municipio?.toLocaleLowerCase('pt-BR')) || null;
    return { municipio, localidade };
  } catch (e) {
    logger.warn("geocoding: falha na geocodificação reversa", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function reverseGeocodeMunicipio(latitude, longitude) {
  return (await reverseGeocodeLocation(latitude, longitude))?.municipio || null;
}
