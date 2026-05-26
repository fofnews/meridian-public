// remotion.config.js
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('./remotion/src/Root.jsx');
Config.setPublicDir('./public');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(1);
