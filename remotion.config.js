// remotion.config.js
import { Config } from '@remotion/cli/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

Config.setEntryPoint('./remotion/src/Root.jsx');
Config.setPublicDir('./public');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(1);

// Inject VITE_MAPBOX_TOKEN into the webpack bundle so kernel.js can read it
// via process.env.VITE_MAPBOX_TOKEN (import.meta.env is Vite-only).
// The overrideWebpackConfig callback runs after Remotion loads .env, so
// process.env.VITE_MAPBOX_TOKEN is available here.
Config.overrideWebpackConfig((config) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    new (require('webpack').DefinePlugin)({
      'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(process.env.VITE_MAPBOX_TOKEN ?? ''),
    }),
  ],
}));
