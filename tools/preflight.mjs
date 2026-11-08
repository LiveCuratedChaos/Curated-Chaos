// Local-only preflight; does not display credentials or touch Supabase.
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalConfig, assertDevTarget } from './dev-env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['dev-organize.html','src/dev-organize.mjs','src/dev-organize-model.mjs','dev-dashboard.html','dev-workspace.html','src/dev-workspace.mjs','src/dev-workspace-model.mjs','src/dev-navigation-model.mjs','dev-agenda.html','src/dev-agenda.mjs','src/dev-agenda-model.mjs','dev-email.html','src/dev-email.mjs','src/dev-email-model.mjs','dev-life.html','src/dev-life.mjs','src/dev-life-model.mjs','src/dev-decision-model.mjs','dev-settings.html','src/dev-settings.mjs','src/dev-preferences-model.mjs','src/dev-sync-model.mjs','dev-acceptance.html','src/dev-acceptance.mjs','src/dev-acceptance-model.mjs'];
for (const file of files) {
  if (!existsSync(resolve(root,file))) {
    console.error(`M2C setup check failed: ${file} is missing. Open the folder containing package.json, dev-agenda.html and dev-email.html.`);
    process.exitCode=1;
  }
}
try {
  const dev=assertDevTarget(loadLocalConfig(resolve(root,'.env.local')));
  console.log(`M2C development configuration: valid for separate project ${dev.ref}.`);
} catch (err) {
  console.error(`M2C development configuration issue: ${err.message}. Copy .env.local from your earlier working development folder.`);
  process.exitCode=1;
}
if (!process.exitCode) console.log('M2C preflight passed. Start with: PORT=5195 npm start');
