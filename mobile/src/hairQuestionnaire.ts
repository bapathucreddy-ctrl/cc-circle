import type { QuestionSection } from './questionnaires';
export const hairQuestionnaire: QuestionSection[] = [
  { title: 'Your hair practice', description: 'Help clients choose the right styling professional.', fields: [
    { id: 'hair-services', label: 'Services you offer', type: 'multi', required: true, options: ['Haircuts', 'Blowouts', 'Bridal hair', 'Braids', 'Colour', 'Extensions', 'Editorial styling'] },
    { id: 'hair-textures', label: 'Hair textures you work with', type: 'multi', required: true, options: ['Straight', 'Wavy', 'Curly', 'Coily', 'All textures'] },
    { id: 'experience', label: 'Years of professional experience', type: 'number', min: 0, max: 70, required: true },
  ] },
  { title: 'Tools and client preparation', description: 'Explain what you bring and how clients should prepare.', fields: [
    { id: 'hair-kit', label: 'Tools and products you bring', type: 'textarea', required: true },
    { id: 'client-prep', label: 'Client preparation and space requirements', type: 'textarea', required: true },
    { id: 'hair-consultation', label: 'Do you offer a pre-service consultation?', type: 'select', required: true, options: ['Included', 'On request', 'Not offered'] },
    { id: 'hair-access', label: 'Private accessibility or working preferences', type: 'textarea', privateField: true },
  ] },
];
