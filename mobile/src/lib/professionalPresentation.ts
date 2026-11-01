import { portfolioAction } from './portfolio';
export const professionalPresentation = (professionalId: string) => portfolioAction<{ src: string | null; verified: boolean; instagram_connected: boolean }>('presentation', { professional_id: professionalId });
// A verification lookup failure must not hide an otherwise accessible profile photo.
export const professionalAvatar = (professionalId: string) => portfolioAction<{ src: string | null;review_status?:string }>('avatar', { professional_id: professionalId });
