// remotion/src/Root.jsx
import { Composition, registerRoot } from 'remotion';
import { z } from 'zod';
import { Broadcast, calculateMetadata } from './Broadcast.jsx';
import { OverlayGallery, galleryDurationInFrames } from './OverlayGallery.jsx';

const broadcastSchema = z.object({
  edition: z.string().nullable(),
  fps: z.number(),
  aspect: z.enum(['16:9', '9:16']),
  port: z.number(),
});

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Broadcast"
        component={Broadcast}
        calculateMetadata={calculateMetadata}
        schema={broadcastSchema}
        defaultProps={{ edition: '2026-06-01-evening', fps: 30, aspect: '16:9', port: 3002 }}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={1}
      />
      <Composition
        id="OverlayGallery"
        component={OverlayGallery}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={galleryDurationInFrames}
      />
      <Composition
        id="Broadcast916"
        component={Broadcast}
        calculateMetadata={calculateMetadata}
        schema={broadcastSchema}
        defaultProps={{ edition: '2026-06-01-evening', fps: 30, aspect: '9:16', port: 3002 }}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={1}
      />
    </>
  );
}

registerRoot(RemotionRoot);
