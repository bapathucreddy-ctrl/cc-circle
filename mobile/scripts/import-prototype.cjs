// Import only the prototype's declarative questionnaire data into the native app.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'prototype-demo.js'), 'utf8');
const start = source.indexOf('const choice=');
const end = source.indexOf('state.roleDetails=', start);
if (start < 0 || end < 0) throw new Error('Questionnaire data was not found.');
const data = vm.runInNewContext(source.slice(start, end) + '\nJSON.stringify(detailedQuestions)', {}, { timeout: 1000 });
const header = `// Generated from prototype-demo.js. Regenerate with node scripts/import-prototype.cjs.\nimport type { Category } from './domain';\nimport { hairQuestionnaire } from './hairQuestionnaire';\nexport type Question = { id: string; label: string; type: 'select' | 'multi' | 'text' | 'number' | 'textarea'; required?: boolean; privateField?: boolean; hint?: string; options?: string[]; min?: number; max?: number };\nexport type QuestionSection = { title: string; description: string; fields: Question[] };\nexport const questionnaires: Record<Category, QuestionSection[]> = `;
fs.writeFileSync(path.join(root, 'mobile/src/questionnaires.ts'), header + JSON.stringify(JSON.parse(data), null, 2).replace(/^\{/, '{\n  HairStylist: hairQuestionnaire,') + ';\n');
