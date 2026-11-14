import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const {version:baseVersion}=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8'));
// Each new deployment gets a monotonically increasing patch version. Re-running
// the same deployment keeps its version; local previews are explicitly marked.
const releaseLine=baseVersion.split('.').slice(0,2).join('.');
const version=process.env.GITHUB_RUN_NUMBER?`${releaseLine}.${process.env.GITHUB_RUN_NUMBER}`:`${baseVersion}-dev`;
const revision=process.env.GITHUB_SHA?.slice(0,7)??'local';

// Relative assets support GitHub project Pages and self-hosted subdirectories.
export default defineConfig({
  base:'./',
  define:{__APP_VERSION__:JSON.stringify(version),__APP_REVISION__:JSON.stringify(revision)},
  plugins:[{name:'release-version',generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({version,revision})});}}],
});
