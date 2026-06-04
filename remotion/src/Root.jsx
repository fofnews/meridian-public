// remotion/src/Root.jsx
import { Composition, registerRoot } from 'remotion';
import { Broadcast, calculateMetadata } from './Broadcast.jsx';

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Broadcast"
        component={Broadcast}
        calculateMetadata={calculateMetadata}
        defaultProps={{ edition: null, fps: 30, aspect: '16:9', port: 3002 }}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={1}
      />
      <Composition
        id="Broadcast916"
        component={Broadcast}
        calculateMetadata={calculateMetadata}
        defaultProps={{ edition: null, fps: 30, aspect: '9:16', port: 3002 }}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={1}
      />
    </>
  );
}

registerRoot(RemotionRoot);
