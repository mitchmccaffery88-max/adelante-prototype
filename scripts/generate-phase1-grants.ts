// Build-time only. Evaluates the reviewed matrix and nursing overlays without
// importing the demo store (which would seed records as an import side effect).
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync('src/lib/roles.ts', 'utf8');
const classes = [...source.slice(source.indexOf('export type RecordClass ='), source.indexOf('export type AccessLevel')).matchAll(/\|\s*"([a-z_]+)"/g)].map(x => x[1]);
const roles = [...source.slice(source.indexOf('export const STAFF_ROLES:'), source.indexOf('export type RecordClass')).matchAll(/key: "([a-z_]+)"/g)].map(x => x[1]);
const matrixSource = source.slice(source.indexOf('const MATRIX:'), source.indexOf('/** §Batch E1 — outpatient nursing roles. */'));
const compiled = ts.transpile(matrixSource + '\nexport default MATRIX;', { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const exports: { default?: Record<string, Record<string,string>> } = {};
new Function('exports', compiled)(exports);
const matrix = exports.default;
if (!matrix || classes.length !== 44 || roles.length !== 18) throw new Error('Phase 1 matrix inventory changed; review required.');
const rows = roles.flatMap(role => classes.map(recordClass => ({ role, record_class: recordClass, level: matrix[recordClass]?.[role === 'physician' ? 'pmhnp' : role] ?? 'none' })));
writeFileSync('src/lib/persistence/grants.generated.json', JSON.stringify(rows, null, 2) + '\n');
writeFileSync('/tmp/phase1-grants.json', JSON.stringify(rows));
console.log(`Generated ${rows.length} grants (${roles.length} roles × ${classes.length} classes).`);