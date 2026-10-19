import { File } from 'expo-file-system';
export async function readPortfolioAsset(uri: string) { return new File(uri).arrayBuffer(); }
