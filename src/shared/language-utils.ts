const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".yaml": "yaml",
  ".yml": "yaml",
  ".sls": "yaml",
  ".json": "json",
  ".py": "python",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".js": "javascript",
  ".mjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".conf": "ini",
  ".cfg": "ini",
  ".ini": "ini",
  ".xml": "xml",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".md": "markdown",
  ".markdown": "markdown",
  ".sql": "sql",
  ".dockerfile": "dockerfile",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".java": "java",
  ".lua": "lua",
  ".r": "r",
  ".pl": "perl",
  ".toml": "plaintext",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".log": "plaintext",
  ".csv": "plaintext",
};

const TEXT_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_LANGUAGE));

export function getMonacoLanguage(filename: string): string {
  const ext = getExtension(filename);
  if (ext && EXTENSION_TO_LANGUAGE[ext]) return EXTENSION_TO_LANGUAGE[ext];

  const lower = filename.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "plaintext";

  return "plaintext";
}

export function isTextFile(filename: string, mimeType?: string): boolean {
  const ext = getExtension(filename);
  if (ext && TEXT_EXTENSIONS.has(ext)) return true;

  const lower = filename.toLowerCase();
  if (lower === "dockerfile" || lower === "makefile" || lower === "gnumakefile") return true;

  if (mimeType) {
    if (mimeType.startsWith("text/")) return true;
    if (mimeType === "application/json") return true;
    if (mimeType === "application/xml") return true;
    if (mimeType === "application/x-yaml") return true;
    if (mimeType === "application/javascript") return true;
  }

  return false;
}

function getExtension(filename: string): string | undefined {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return undefined;
  return filename.slice(dotIndex).toLowerCase();
}
