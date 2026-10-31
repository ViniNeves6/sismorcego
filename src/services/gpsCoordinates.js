export function isValidGpsCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function gpsAccuracy(accuracy) {
  return Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null;
}
