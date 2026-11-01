import { Image } from 'react-native';
import type { Category } from '../domain';
import { craftIconImages, genericCraftImage } from './mapArtwork';
export function ServiceCraftIcon({ category, size = 66 }: { category?: Category; size?: number }) {
 return <Image accessible={false} source={category ? craftIconImages[category] : genericCraftImage} resizeMode="contain" style={{ width: size, height: size }} />;
}
