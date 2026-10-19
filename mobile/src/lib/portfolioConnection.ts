import * as WebBrowser from 'expo-web-browser';
export function preparePortfolioConnection() {
  return { open: async (url: string) => { await WebBrowser.openBrowserAsync(url); }, close: () => {} };
}
