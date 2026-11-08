import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function loadLocalConfig(file=resolve('.env.local')) {
  const content=readFileSync(file,'utf8');
  const config={};
  for (const raw of content.split(/\r?\n/)) {
    const line=raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match=line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) throw Error('Invalid .env.local line. Use KEY=value format.');
    let value=match[2].trim();
    if ((value.startsWith('"')&&value.endsWith('"')) || (value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    config[match[1]]=value;
  }
  return config;
}
export function assertDevTarget(config) {
  const url=new URL(config.CC_DEV_SUPABASE_URL||'');
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname!=='/') throw Error('Development project URL must be an exact HTTPS Supabase project URL ending in /');
  const ref=url.hostname.split('.')[0];
  if (config.CC_DEV_PROJECT_REF!==ref) throw Error('CC_DEV_PROJECT_REF must equal the development Supabase project URL reference.');
  if (!/^[a-z0-9]{10,32}$/.test(config.CC_ORIGINAL_PROJECT_REF||'') || config.CC_ORIGINAL_PROJECT_REF===ref) throw Error('Provide the actual ORIGINAL project reference (10–32 lowercase letters/digits), which must differ from the development project.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.CC_DEV_PUBLISHABLE_KEY||'')) throw Error('Use ONLY the new development publishable key (sb_publishable_...), never a secret or service_role key.');
  if (config.CC_CONFIRM_NEW_DEV_PROJECT!=='I_CHECKED_THIS_IS_NOT_MY_EXISTING_PROJECT') throw Error('Review the project name/reference, then confirm this is a NEW development project in .env.local.');
  for (const key of ['CC_TEST_A_EMAIL','CC_TEST_B_EMAIL','CC_TEST_A_PASSWORD','CC_TEST_B_PASSWORD']) if (!config[key]) throw Error(`Missing ${key} in .env.local`);
  if (config.CC_TEST_A_EMAIL===config.CC_TEST_B_EMAIL) throw Error('Test accounts A and B must be different.');
  return {url:url.origin,ref,publishableKey:config.CC_DEV_PUBLISHABLE_KEY,users:[{email:config.CC_TEST_A_EMAIL,password:config.CC_TEST_A_PASSWORD},{email:config.CC_TEST_B_EMAIL,password:config.CC_TEST_B_PASSWORD}]};
}
