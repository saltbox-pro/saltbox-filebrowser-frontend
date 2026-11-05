import type {
  BulkDeleteFailedEntry,
  BulkDeleteItem,
  SelectedPaths,
} from "saltbox-filesystem/shared/types";

export function pickBulkDeleteFailures(
  requestedPaths: readonly string[],
  failed: readonly BulkDeleteItem[]
): BulkDeleteFailedEntry[] {
  const messageByPath = new Map(failed.map((item) => [item.path, item.message]));
  return requestedPaths
    .filter((path) => messageByPath.has(path))
    .map((path) => ({ path, message: messageByPath.get(path) }));
}

export function pickExistingSelectedPaths(
  selectedPaths: SelectedPaths,
  existingPaths: ReadonlySet<string>
): SelectedPaths {
  return Object.fromEntries(
    Object.entries(selectedPaths).filter(([path, selected]) => selected && existingPaths.has(path))
  );
}
