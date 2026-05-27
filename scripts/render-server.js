// Ephemeral static server for Remotion render isolation.
// Serves the three asset trees that Remotion's headless Chrome fetches,
// bound to loopback on an OS-assigned free port so nothing external can
// collide with or restart it during a render.
//
// Usage:
//   import { startRenderServer } from './render-server.js';
//   const { port, close } = await startRenderServer({ rootDir });
//   // ... run remotion render with port in props ...
//   await close();

import { createServer } from 'http';
import { join } from 'path';
import express from 'express';

/**
 * @param {{ rootDir: string }} options
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function startRenderServer({ rootDir }) {
  const app = express();

  const cors = (_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); };
  app.use(cors);

  app.use(express.static(join(rootDir, 'public')));
  app.use('/out/shotlists', express.static(join(rootDir, 'out', 'shotlists')));
  app.use('/out/audio',     express.static(join(rootDir, 'out', 'audio')));

  const server = createServer(app);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  const { port } = server.address();
  const close = () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));

  return { port, close };
}
