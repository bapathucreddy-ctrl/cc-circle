import type { Category } from '../domain';

export const destinationImage = require('../../assets/brand/destination.png');
export const genericRiderImage = require('../../assets/brand/rider-generic-neutral.png');
export const genericTrackingRiderImage = require('../../assets/brand/rider-3d-generic.png');
export const trackingRiderImages: Record<Category, number> = {
  Makeup: require('../../assets/brand/rider-3d-makeup.png'),
  Actor: require('../../assets/brand/rider-3d-actor.png'),
  Photographer: require('../../assets/brand/rider-3d-photographer.png'),
  Editor: require('../../assets/brand/rider-3d-editor.png'),
  Dancer: require('../../assets/brand/rider-3d-dancer.png'),
  HairStylist: require('../../assets/brand/rider-3d-hairstylist.png'),
  ContentCreator: require('../../assets/brand/rider-3d-contentcreator.png'),
};
export const trackingScooterImage = require('../../assets/brand/tracking-scooter.png');
export const genericProfessionBadge = require('../../assets/brand/mark-black.png');
export const professionBadges: Record<Category, number> = {
  Makeup: require('../../assets/brand/badge-makeup.png'),
  Actor: require('../../assets/brand/badge-actor.png'),
  Photographer: require('../../assets/brand/badge-photographer.png'),
  Editor: require('../../assets/brand/badge-editor.png'),
  Dancer: require('../../assets/brand/badge-dancer.png'),
  HairStylist: require('../../assets/brand/badge-hairstylist.png'),
  ContentCreator: require('../../assets/brand/badge-contentcreator.png'),
};
export const riderImages: Record<Category, number> = {
  Makeup: require('../../assets/brand/rider-makeup-neutral.png'),
  Actor: require('../../assets/brand/rider-actor-neutral.png'),
  Photographer: require('../../assets/brand/rider-photographer-neutral.png'),
  Editor: require('../../assets/brand/rider-editor-neutral.png'),
  Dancer: require('../../assets/brand/rider-dancer-neutral.png'),
  HairStylist: require('../../assets/brand/rider-hairstylist-neutral.png'),
  ContentCreator: require('../../assets/brand/rider-contentcreator-neutral.png'),
};
