import { copyFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const output = new URL('dist/docs/', root);
mkdirSync(output, { recursive: true });
for (const [source, target] of [
  ['index.html', 'index.html'],
  ['../openapi.yaml', 'openapi.yaml'],
  ['node_modules/swagger-ui-dist/swagger-ui.css', 'swagger-ui.css'],
  ['node_modules/swagger-ui-dist/swagger-ui-bundle.js', 'swagger-ui-bundle.js'],
  ['node_modules/swagger-ui-dist/LICENSE', 'LICENSE'],
  ['node_modules/swagger-ui-dist/NOTICE', 'NOTICE'],
  ['node_modules/swagger-ui-dist/swagger-ui-bundle.js.LICENSE.txt', 'swagger-ui-bundle.js.LICENSE.txt'],
]) copyFileSync(new URL(source, root), new URL(target, output));
console.log('API documentation built in dist/docs/');


