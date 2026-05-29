// remotion.config.js
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./remotion/src/Root.jsx');
Config.setPublicDir('./public');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(1);
// Mapbox GL requires WebGL; 'angle' is the most reliable renderer in headless Chrome on Windows.
Config.setChromiumOpenGlRenderer('angle');

// Inject VITE_MAPBOX_TOKEN into the webpack bundle so kernel.js can read
// it via process.env.VITE_MAPBOX_TOKEN (import.meta.env is Vite-only).
// This callback runs after Remotion loads .env, so process.env.VITE_MAPBOX_TOKEN
// is available here. remotion.config.js is evaluated as CJS, so require() works.
Config.overrideWebpackConfig((config) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webpack = require('webpack');
  // MAPBOX_TOKEN_RENDER is an unrestricted server-side token (no URL allowlist).
  // Falls back to VITE_MAPBOX_TOKEN when not set. The render token must not have
  // URL restrictions because Remotion's headless Chrome origin (localhost:3003)
  // differs from the deployed website origin.
  const mapboxToken = process.env.MAPBOX_TOKEN_RENDER ?? process.env.VITE_MAPBOX_TOKEN ?? '';
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new webpack.DefinePlugin({
        'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(mapboxToken),
      }),
    ],
  };
});
