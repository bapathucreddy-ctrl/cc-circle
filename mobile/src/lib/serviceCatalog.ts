import type { Category } from '../domain';
export const visibleCategories: Category[] = ['Makeup', 'Photographer', 'Editor', 'HairStylist', 'ContentCreator'];
export const serviceCatalog: { key: string; category: Category; label: string }[] = [
  ['bridal-makeup','Makeup','Bridal makeup'], ['party-makeup','Makeup','Party makeup'], ['wedding-makeup','Makeup','Wedding guest makeup'], ['groom-makeup','Makeup','Bridegroom makeup'], ['general-makeup','Makeup','General makeup'], ['festive-makeup','Makeup','Festive makeup'],
  ['wedding-photography','Photographer','Wedding photography'], ['prewedding-photography','Photographer','Pre-wedding shoot'], ['event-photography','Photographer','Event photography'], ['portrait-photography','Photographer','Portrait session'], ['product-photography','Photographer','Product photography'],
  ['photo-editing','Editor','Photo editing'], ['video-editing','Editor','Video editing'], ['reel-editing','Editor','Reel editing'], ['wedding-film-editing','Editor','Wedding film editing'],
  ['bridal-hair','HairStylist','Bridal hair styling'], ['party-hair','HairStylist','Party hair styling'], ['haircut','HairStylist','Haircut'], ['general-hair','HairStylist','Hair styling'], ['groom-styling','HairStylist','Groom styling'],
  ['event-reels','ContentCreator','Event reel shoot'], ['brand-content','ContentCreator','Brand content'], ['social-content','ContentCreator','Social media content'], ['product-reels','ContentCreator','Product reel shoot'],
].map(([key, category, label]) => ({ key: key!, category: category as Category, label: label! }));
export const servicesForCategory = (category: Category) => serviceCatalog.filter(service => service.category === category);
