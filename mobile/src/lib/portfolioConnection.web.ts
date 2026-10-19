export function preparePortfolioConnection() {
  const popup = window.open('about:blank', 'cc-circle-portfolio', 'popup,width=520,height=740');
  return { open: async (url: string) => { if (!popup) throw new Error('Allow pop-ups to connect your portfolio.'); popup.location.replace(url); }, close: () => popup?.close() };
}
