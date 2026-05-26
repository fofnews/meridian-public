// remotion/src/Root.jsx
import { Composition, registerRoot } from 'remotion';
import { Broadcast, calculateMetadata } from './Broadcast.jsx';

export function RemotionRoot() {
  return (
    <Composition
      id="Broadcast"
      component={Broadcast}
      calculateMetadata={calculateMetadata}
      defaultProps={{ edition: '', fps: 30, aspect: '16:9', port: 3002 }}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1}
    />
  );
}

registerRoot(RemotionRoot);
