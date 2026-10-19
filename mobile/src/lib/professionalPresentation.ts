import { portfolioAction } from './portfolio';
export const professionalPresentation = (professionalId: string) => portfolioAction<{ src: string | null; verified: boolean }>('presentation', { professional_id: professionalId });
