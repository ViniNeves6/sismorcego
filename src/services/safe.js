export function safeAsync(promise) {
  Promise.resolve(promise).catch(() => {});
}