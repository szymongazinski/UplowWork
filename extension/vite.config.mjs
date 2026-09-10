import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root,base:'./',plugins:[react()],resolve:{alias:{'@':path.resolve(root,'..')}},build:{outDir:path.resolve(root,'../dist'),emptyOutDir:false},server:{host:'127.0.0.1',port:5173,strictPort:true,fs:{allow:[path.resolve(root,'..')]}}});
