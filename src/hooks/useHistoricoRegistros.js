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
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    const data = await carregarHistorico(role);
    // Ignora respostas antigas se outra recarga começou depois.
    if (id !== latest.current) return;
    setRegistros(data);
    setLoading(false);
  }, [role]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
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

  return { registros, loading, refreshing, refresh };
}
