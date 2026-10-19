export async function readPortfolioAsset(uri: string) { return (await fetch(uri)).arrayBuffer(); }
