const { spawnSync } = require("child_process");

// Different platforms/installs expose the Python 3 interpreter under different
// names: "python3" (most Linux/macOS), "python" (many Windows installs, some
// virtualenvs), or the Windows launcher "py -3". We probe them once at worker
// startup instead of hardcoding "python3", so a missing/renamed interpreter
// gives a clear, actionable error instead of a bare "spawn python3 ENOENT".
const CANDIDATES = [
  process.env.PYTHON_BIN, // explicit override always wins if set
  "python3",
  "python",
  "py",
].filter(Boolean);

const REQUIRED_MODULES = ["numpy", "PIL", "scipy"];

let resolved = null; // { bin, args } | null
let resolutionError = null;

function probe(bin) {
  // "py" (Windows launcher) needs a "-3" flag to select Python 3.
  const args = bin === "py" ? ["-3", "--version"] : ["--version"];
  try {
    const res = spawnSync(bin, args, { stdio: "ignore", timeout: 5000 });
    return res.error ? null : { bin, args: bin === "py" ? ["-3"] : [] };
  } catch {
    return null;
  }
}

function checkModules(candidate) {
  const importCode = `import ${REQUIRED_MODULES.join(", ")}`;
  const res = spawnSync(candidate.bin, [...candidate.args, "-c", importCode], { stdio: "pipe", timeout: 10000 });
  if (res.status !== 0) {
    return (res.stderr || "").toString().trim() || "unknown import error";
  }
  return null;
}

/**
 * Returns { bin, args } for a working Python 3 interpreter with the required
 * packages installed. Throws a descriptive error (only once, then cached) if
 * none of the candidates work, so callers can surface it as a clear job
 * failure instead of a cryptic ENOENT.
 */
function resolvePython() {
  if (resolved) return resolved;
  if (resolutionError) throw resolutionError;

  const tried = [];
  for (const bin of CANDIDATES) {
    const candidate = probe(bin);
    if (!candidate) {
      tried.push(`${bin}: not found on PATH`);
      continue;
    }
    const moduleError = checkModules(candidate);
    if (moduleError) {
      tried.push(`${bin}: found, but missing required packages (numpy/Pillow/scipy) — ${moduleError.split("\n").pop()}`);
      continue;
    }
    resolved = candidate;
    // eslint-disable-next-line no-console
    console.log(`[worker] Using Python interpreter: ${bin}`);
    return resolved;
  }

  resolutionError = new Error(
    "No working Python 3 interpreter found for the AI analysis pipeline.\n" +
      "Tried:\n  " +
      tried.join("\n  ") +
      "\n\nFix this by either:\n" +
      "  1. Installing Python 3 and the required packages:\n" +
      "       pip install -r ai/requirements.txt --break-system-packages\n" +
      "  2. Setting PYTHON_BIN in backend/.env to the correct interpreter path,\n" +
      "     e.g. PYTHON_BIN=python  or  PYTHON_BIN=/usr/bin/python3.11"
  );
  throw resolutionError;
}

module.exports = { resolvePython };
