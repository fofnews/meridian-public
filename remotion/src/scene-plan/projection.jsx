// remotion/src/scene-plan/projection.jsx
// ProjectFnContext provides geo-to-screen projection to geo-anchored treatments.
// ProjectFn = (p: { lat: number, lng: number }) => { x: number, y: number }
import { createContext, useContext } from 'react';

export const ProjectFnContext = createContext(null);

export function useProject() {
  return useContext(ProjectFnContext);
}
