const state = { isConnected: true, isInternetReachable: true };
export default {
  addEventListener: () => () => {},
  fetch: async () => state,
};
export const addEventListener = () => () => {};
export const fetch = async () => state;
