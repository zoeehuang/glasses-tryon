import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev server only: lets the `?calibrate` page read the local labeled dataset
 * (kept out of git) and save the model it learns into the project.
 *   GET  /__calibration/files              → paths of every image in the dataset
 *   GET  /__calibration/file?path=…        → one image
 *   POST /__calibration/model  (JSON body) → writes src/lib/faceShapeModel.json
 */
function calibrationDataset(folder: string): Plugin {
  const datasetRoot = path.join(projectRoot, folder);
  return {
    name: 'calibration-dataset',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__calibration', async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://localhost');
          if (req.method === 'GET' && url.pathname === '/files') {
            const entries = await readdir(datasetRoot, { recursive: true, withFileTypes: true });
            const files = entries
              .filter((e) => e.isFile() && /\.(jpe?g|png|webp|bmp)$/i.test(e.name))
              .map((e) => path.join(folder, path.relative(datasetRoot, path.join(e.parentPath, e.name))))
              .map((p) => p.split(path.sep).join('/'));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(files));
          } else if (req.method === 'GET' && url.pathname === '/file') {
            const file = path.resolve(projectRoot, url.searchParams.get('path') ?? '');
            if (!file.startsWith(datasetRoot + path.sep)) throw new Error('Outside the dataset');
            createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
          } else if (req.method === 'POST' && url.pathname === '/model') {
            let body = '';
            for await (const chunk of req) body += chunk;
            JSON.parse(body); // refuse anything that isn't valid JSON
            await writeFile(path.join(projectRoot, 'src/lib/faceShapeModel.json'), body);
            res.end('saved');
          } else {
            res.writeHead(404).end();
          }
        } catch (err) {
          res.writeHead(400).end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), calibrationDataset('image calibrating')],
  test: {
    environment: 'node',
  },
});
