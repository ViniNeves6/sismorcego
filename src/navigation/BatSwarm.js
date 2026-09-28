// src/navigation/BatSwarm.js
import React from "react";
import { Image, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

const BAT_SOURCE = require("../assets/images/BatFlying.png");
const BAT_RATIO = 79 / 100; // altura / largura do sprite

const BAT_COUNT = 18;
const EASE = Easing.out(Easing.quad);

// Hash determinístico simples (sem dependência de lib de random) — mesmo
// seed sempre gera a mesma sequência, então a horda tem a mesma "coreografia"
// em toda abertura do app, só variando a duração real do splash.
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function FlyingBat({ index, width: screenW, height: screenH }) {
  // Seeds independentes pra início, fim, tamanho, tempo e ondulação — usar a
  // mesma variável em dois eixos correlaciona as trajetórias e faz os
  // morcegos ficarem "enfileirados" em vez de espalhados.
  const rStartX = pseudoRandom(index * 9 + 1);
  const rStartY = pseudoRandom(index * 9 + 2);
  const rEndX = pseudoRandom(index * 9 + 3);
  const rEndY = pseudoRandom(index * 9 + 4);
  const rSize = pseudoRandom(index * 9 + 5);
  const rDelay = pseudoRandom(index * 9 + 6);
  const rDuration = pseudoRandom(index * 9 + 7);
  const rFlutter = pseudoRandom(index * 9 + 8);
  const rWave = pseudoRandom(index * 9 + 9);

  // Tamanho: morcegos "mais perto" (maiores) e "mais longe" (menores), pra
  // dar sensação de profundidade em vez de uma fileira uniforme.
  const size = 56 + rSize * 70; // 56–126px de largura

  // Trajetória diagonal: começa embaixo/esquerda (parte pode estar fora da
  // tela) e termina em cima/direita (também podendo sair da tela) — atravessa
  // o centro visível no meio do percurso. Início e fim usam seeds diferentes
  // pra não ficarem paralelos entre si.
  const startX = -0.2 * screenW + rStartX * 0.7 * screenW;
  const startY = 0.5 * screenH + rStartY * 0.65 * screenH;
  const endX = 0.5 * screenW + rEndX * 0.8 * screenW;
  const endY = -0.2 * screenH + rEndY * 0.65 * screenH;

  // Deslocamento perpendicular ao voo (curva suave, tipo "S"), pra separar
  // visualmente os morcegos que por acaso tenham início/fim parecidos.
  const dirX = endX - startX;
  const dirY = endY - startY;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
  const perpX = -dirY / dirLen;
  const perpY = dirX / dirLen;
  const waveAmp = (rWave - 0.5) * 0.5 * screenW;

  const delay = Math.round(rDelay * 550);
  const duration = 1500 + Math.round(rDuration * 700);
  const flutterMs = 130 + Math.round(rFlutter * 90);

  const progress = useSharedValue(0);
  const flutter = useSharedValue(0);

  React.useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration, easing: EASE })));
    flutter.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: flutterMs, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: flutterMs, easing: Easing.inOut(Easing.quad) })
          ),
          -1,
          true
        )
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    // Curva em "S": a onda cresce e volta a zero nas pontas (sin(p*PI)), então
    // o desvio lateral é maior no meio do voo e nulo no início/fim do trajeto.
    const wave = Math.sin(p * Math.PI) * waveAmp;
    const x = startX + (endX - startX) * p + perpX * wave;
    const y = startY + (endY - startY) * p + perpY * wave;
    // fade-in rápido no início, fade-out no fim — evita "pop" de entrada/saída
    const opacity = p < 0.08 ? p / 0.08 : p > 0.9 ? (1 - p) / 0.1 : 1;

    const f = flutter.get();
    const scaleX = 1 - f * 0.35; // "batida de asa" fake: encolhe/expande horizontalmente
    const rotate = -8 + f * 16; // leve balanço

    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotate}deg` },
        { scaleX },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, style]}>
      <Image
        source={BAT_SOURCE}
        style={{ width: size, height: size * BAT_RATIO }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export default function BatSwarm({ reduced = false }) {
  const { width, height } = useWindowDimensions();
  if (reduced) return null;
  return (
    <>
      {Array.from({ length: BAT_COUNT }, (_, i) => (
        <FlyingBat key={i} index={i} width={width} height={height} />
      ))}
    </>
  );
}
