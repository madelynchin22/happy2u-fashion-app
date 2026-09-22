// Legacy reverse map: old outlet IDs baked into imported PO data → marking
// Used when the DB was re-seeded and the stored outletId no longer matches current rows
export const LEGACY_ID_TO_MARKING: Record<string, string> = {
  "cmowg9eed0001nkbf2y1yx9d7": "JN53-H2UWM",
  "cmowg9eee0002nkbfe9eiqekp": "JN55-H2UES",
  "cmowg9eef0003nkbfrwixoa72": "JN55-H2USA",
  "cmowg9eef0004nkbfwbxvom6o": "JN59-H2UMV",
  "cmowg9eeg0005nkbflnslo9rr": "JN62-H2UPTJ",
  "cmowg9eeg0006nkbf86bo15ax": "JN75-H2UABM",
  "cmowg9eeh0007nkbfyai2gkfq": "JN75-H2UABMDEP",
  "cmowg9eei0008nkbfkahlsmcb": "JN75-H2UAK",
  "cmowg9eei0009nkbfhtoz6o1y": "JN75-H2UHQ",
  "cmowg9eej000ankbfoo8xwf0z": "JN81-H2UATC",
  "cmowg9eej000bnkbf9yec4sdi": "JN81-H2UBI",
};

export function makeOutletResolver<T extends { id: string; marking: string }>(allOutlets: T[]) {
  const outletMapById      = new Map(allOutlets.map(o => [o.id,      o]));
  const outletMapByMarking = new Map(allOutlets.map(o => [o.marking, o]));

  return function resolveOutlet(outletId: string): T | { id: string; marking: string; name: string } {
    return outletMapById.get(outletId)
      ?? (LEGACY_ID_TO_MARKING[outletId]
          ? outletMapByMarking.get(LEGACY_ID_TO_MARKING[outletId]) ?? null
          : null)
      ?? { id: outletId, marking: LEGACY_ID_TO_MARKING[outletId] ?? outletId, name: "" };
  };
}
