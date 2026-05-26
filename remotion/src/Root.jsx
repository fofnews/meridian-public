// remotion/src/Root.jsx
import { Composition, registerRoot } from '@remotion/core';
import { AbsoluteFill } from '@remotion/core';

function Placeholder() {
  return <AbsoluteFill style={{ background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>Remotion scaffold</AbsoluteFill>;
}

export const RemotionRoot = () => (
  <Composition
    id="Broadcast"
    component={Placeholder}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={90}
    defaultProps={{}}
  />
);

registerRoot(RemotionRoot);
