import type { Category, Coordinate, Professional } from '../domain';
export type TalentMapProps = {
  center: Coordinate; professionals?: Professional[]; destination?: Coordinate; heading?: number | null;
  tracking?: boolean; route?: Coordinate[] | null; onSelect?: (person: Professional) => void;
  trackingCategory?: Category; centerIsLocation?: boolean;
  onChooseLocation?: (point: Coordinate) => void;
  height?: number; label?: string; status?: string; distanceLabel?: string;
  immersive?: boolean; overlayBottom?: number; overlayTop?: number;
  cameraOverlayBottom?: number;
  selectedProfessionalId?: string;
};
