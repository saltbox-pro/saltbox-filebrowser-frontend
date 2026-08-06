import {
  applyFileBrowserLocationQuery,
  joinFileBrowserPathChild,
  readFileBrowserLocationQuery,
  type FileBrowserLocationQuery,
  type ShowFileBrowserErrorByCode,
} from "@saltbox/saltbox-frontend-common";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { mountFileBrowserLocation } from "saltbox-filesystem/helpers/mount-file-browser-location";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";

interface UseFileBrowserPageLocationOptions {
  currentPath: string;
  currentSource: string;
  editorOpen: boolean;
  editorFileName: string;
  onOpenFile: (name: string) => void;
  showErrorByCode: ShowFileBrowserErrorByCode;
}

function writeLocationToSearchParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  location: { source: string | null; path: string | null; file: string | null }
): void {
  setSearchParams(
    (prev) => {
      const current = readFileBrowserLocationQuery(prev);
      if (
        current.source === location.source &&
        current.path === location.path &&
        current.file === location.file
      ) {
        return prev;
      }
      return applyFileBrowserLocationQuery(prev, location);
    },
    { replace: true }
  );
}

function formatDeepLinkPathSuffix(path: string | null | undefined): string | undefined {
  if (path == null || path.length === 0) {
    return undefined;
  }
  return `: "${path}"`;
}

function toLocationKey(location: FileBrowserLocationQuery): string {
  return `${location.source ?? ""}\0${location.path ?? ""}\0${location.file ?? ""}`;
}

export function useFileBrowserPageLocation({
  currentPath,
  currentSource,
  editorOpen,
  editorFileName,
  onOpenFile,
  showErrorByCode,
}: UseFileBrowserPageLocationOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAppliedRef = useRef(false);
  const suppressWriteBackRef = useRef(true);
  const mountGenerationRef = useRef(0);
  const appliedLocationKeyRef = useRef<string | null>(null);
  const searchParamsRef = useRef(searchParams);
  const onOpenFileRef = useRef(onOpenFile);
  const showErrorByCodeRef = useRef(showErrorByCode);

  searchParamsRef.current = searchParams;
  onOpenFileRef.current = onOpenFile;
  showErrorByCodeRef.current = showErrorByCode;

  const location = readFileBrowserLocationQuery(searchParams);
  const locationKey = toLocationKey(location);

  useEffect(() => {
    if (locationKey === appliedLocationKeyRef.current) {
      return;
    }

    const mountGeneration = ++mountGenerationRef.current;
    initialAppliedRef.current = false;
    suppressWriteBackRef.current = true;
    appliedLocationKeyRef.current = locationKey;

    const run = async () => {
      let openedFileName: string | null = null;

      try {
        const currentLocation = readFileBrowserLocationQuery(searchParamsRef.current);
        const result = await mountFileBrowserLocation(currentLocation, (name) => {
          if (mountGeneration === mountGenerationRef.current) {
            openedFileName = name;
            onOpenFileRef.current(name);
          }
        });

        if (mountGeneration !== mountGenerationRef.current) {
          return;
        }

        if (result.ok === false) {
          if (result.reason === "no-sources") {
            showErrorByCodeRef.current({ code: "no-sources" });
          } else if (result.reason === "unknown-source") {
            showErrorByCodeRef.current({
              code: "unknown-source",
              suffix: formatDeepLinkPathSuffix(currentLocation.source),
            });
          } else if (result.reason === "path-not-found") {
            showErrorByCodeRef.current({
              code: "path-not-found",
              suffix: formatDeepLinkPathSuffix(result.requestedPath ?? currentLocation.path),
            });
          } else if (result.reason === "directory-unavailable") {
            showErrorByCodeRef.current({
              code: "directory-unavailable",
              suffix: formatDeepLinkPathSuffix(result.requestedPath ?? currentLocation.path),
            });
          } else if (result.reason === "file-missing") {
            const fullPath =
              currentLocation.path != null && currentLocation.file != null
                ? joinFileBrowserPathChild(currentLocation.path, currentLocation.file)
                : currentLocation.file;
            showErrorByCodeRef.current({
              code: "file-gone",
              suffix: formatDeepLinkPathSuffix(fullPath),
            });
          }
        }
      } finally {
        if (mountGeneration === mountGenerationRef.current) {
          initialAppliedRef.current = true;
          suppressWriteBackRef.current = false;
          const nextLocation = {
            source: fileBrowserStore.currentSource || null,
            path: fileBrowserStore.currentPath || null,
            file: openedFileName,
          };
          appliedLocationKeyRef.current = toLocationKey(nextLocation);
          writeLocationToSearchParams(setSearchParams, nextLocation);
        }
      }
    };

    run().catch(() => undefined);

    return () => {
      mountGenerationRef.current += 1;
    };
  }, [locationKey, setSearchParams]);

  useEffect(() => {
    if (suppressWriteBackRef.current || !initialAppliedRef.current) {
      return;
    }

    const nextLocation = {
      source: currentSource || null,
      path: currentPath || null,
      file: editorOpen && editorFileName.length > 0 ? editorFileName : null,
    };
    appliedLocationKeyRef.current = toLocationKey(nextLocation);
    writeLocationToSearchParams(setSearchParams, nextLocation);
  }, [currentPath, currentSource, editorFileName, editorOpen, setSearchParams]);
}
