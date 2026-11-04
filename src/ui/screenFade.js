import { Easing } from 'react-native';

// Shared by tab changes and the post-login handoff to the first guide step.
export const SCREEN_FADE_OUT_MS = 100;
export const SCREEN_FADE_IN_MS = 200;

export function screenFadeTiming(entering) {
  return {
    duration: entering ? SCREEN_FADE_IN_MS : SCREEN_FADE_OUT_MS,
    easing: entering ? Easing.bezier(0, 0, 0.58, 1) : Easing.in(Easing.ease),
    useNativeDriver: true,
  };
}
