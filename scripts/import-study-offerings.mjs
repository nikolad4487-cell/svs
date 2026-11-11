import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {localConfig} from './local-config.mjs';
const production=process.argv.includes('--production'),apply=process.argv.includes('--apply');
let url,key;
if(production){url=process.env.SVS_SUPABASE_URL;key=process.env.SVS_SUPABASE_SECRET_KEY;if(!url||new URL(url).origin!=='https://wjxmyxxwqspwswfwjpdn.supabase.co')throw Error('Configured ISVU project required');}
else{const c=localConfig();url=c.API_URL;key=c.SERVICE_ROLE_KEY;if(!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Local test database required');}
if(!key)throw Error('Configured server credential required; never paste it into chat');
const institutions=JSON.parse(readFileSync('data/study-programs/new-institutions.json'));
const programs=JSON.parse(readFileSync('data/study-programs/programs-2024.json'));
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(60000)})}});
const readiness=await db.from('study_programs').select('id,catalog_source_key').limit(1);
if(readiness.error)throw Error('Apply 202611110006_study_offering_catalog.sql in the ISVU project before importing');
console.log(JSON.stringify({environment:production?'ISVU production':'local test',operation:apply?'apply':'read-only preview',source_year:2024,institution_candidates:institutions.length,programme_records:programs.length}));
if(!apply){console.log('No rows changed. Migration 007 already imports this snapshot.');process.exit(0);}
const result=await db.rpc('import_study_offerings_2024',{institution_rows:institutions,program_rows:programs});
if(result.error)throw Error(`Catalogue transaction failed (${result.error.code}): ${result.error.message}`);
console.log(JSON.stringify(result.data));
