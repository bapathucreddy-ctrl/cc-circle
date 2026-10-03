import React from 'react';
import {Aperture,Box,BriefcaseBusiness,Brush,Camera,Clapperboard,Film,Headphones,Lightbulb,Megaphone,Mic,Music2,Palette,PenLine,Shirt,Sparkles,Star,Video,WandSparkles,Zap,MapPin} from 'lucide-react-native';
const icons=[Clapperboard,Film,Camera,Lightbulb,Palette,Shirt,Brush,Zap,Video,Headphones,Music2,Mic,WandSparkles,Sparkles,Palette,PenLine,BriefcaseBusiness,PenLine,Star,MapPin,Aperture,Video,Megaphone,Box];
export function CraftIcon({index,size=32}:{index:number;size?:number}){const Icon=icons[index]||Clapperboard;const colors=['#554C41','#756451','#655B50'];return <Icon size={size} strokeWidth={1.7} color={colors[index%3]}/>}
