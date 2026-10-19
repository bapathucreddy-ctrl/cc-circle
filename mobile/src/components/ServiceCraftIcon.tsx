import { Image } from 'react-native';
import type { Category } from '../domain';

const icons: Partial<Record<Category, number>> = {
  Makeup: require('../../assets/crafts/realistic-makeup.png'),
  Photographer: require('../../assets/crafts/realistic-photographer.png'),
  Editor: require('../../assets/crafts/realistic-editor.png'),
  HairStylist: require('../../assets/crafts/realistic-hairstylist.png'),
  ContentCreator: require('../../assets/crafts/realistic-contentcreator.png'),
};
const teamIcon = require('../../assets/crafts/realistic-team.png');

export function ServiceCraftIcon({ category, size = 66 }: { category?: Category; size?: number }) {
  return <Image accessible={false} source={category && icons[category] || teamIcon} resizeMode="contain" style={{ width: size, height: size }} />;
}
