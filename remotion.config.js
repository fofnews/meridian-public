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
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      new webpack.DefinePlugin({
        'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(process.env.VITE_MAPBOX_TOKEN ?? ''),
      }),
    ],
  };
});
