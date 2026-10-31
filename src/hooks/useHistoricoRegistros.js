// src/hooks/useHistoricoRegistros.js
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { carregarHistorico } from "../services/historico";
import useAuth from "./useAuth";

// Recarrega ao focar a tela e no evento 'registros:changed'.
// `loading` só vale para a primeira carga: recargas seguintes são silenciosas.
export default function useHistoricoRegistros() {
  const { role } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    setError(null);
    try {
      const data = await carregarHistorico(role, { onCloudError: cause => { if (id === latest.current) setError(cause); } });
      if (id === latest.current) setRegistros(data);
    } catch (cause) { if (id === latest.current) setError(cause); }
    finally { if (id === latest.current) setLoading(false); }
  }, [role]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("registros:changed", reload);
    return () => sub.remove();
  }, [reload]);

  return { registros, loading, refreshing, refresh, error };
}
