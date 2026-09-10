import {spawnSync} from 'node:child_process';
import {copyFileSync,cpSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','extension/vite.config.mjs'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
for(const name of ['manifest.json','background.js','runner.js','dom.js','schedule.js','tiktok-schedule-ui.js','policy.js','captions.js','options.js','store.js','icon16.png','icon48.png','icon128.png'])copyFileSync(path.join(root,'extension',name),path.join(root,'dist',name));
mkdirSync(path.join(root,'UplowWork'),{recursive:true});cpSync(path.join(root,'dist'),path.join(root,'UplowWork'),{recursive:true});
console.log('Gotowe rozszerzenie: '+path.join(root,'UplowWork'));
