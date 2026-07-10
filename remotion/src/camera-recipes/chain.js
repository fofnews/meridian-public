// chain — concatenate two waypoint arrays with a time offset applied to the second.
// Use to compose e.g. establish + hover for a two-phase shot.
// offsetB: start time (seconds) of segment B; all B tOffsets are shifted by offsetB.
export function chain(a, b, offsetB) {
  return [
    ...a,
    ...b.map(wp => ({ ...wp, tOffset: wp.tOffset + offsetB })),
  ];
}
