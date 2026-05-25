/**
 * Pico Sync Module
 * Handles file operations on the Pico (list, upload, delete).
 */

import {
  computeWaitMs,
  ensureDirectory,
  newMarker,
  sendRawCommand,
  sendRawCommandUntilMarker,
} from "../serial/rawRepl.js";
import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";
import { getFileContent, getLibFiles, getProjectFiles } from "./fileManager.js";

const MARKER_REMINDER =
  "\r\n[Bridge] Add a .micropico file to your project root to enable uploads\r\n";

// --- Debug instrumentation -----------------------------------------------
// Off by default. Toggle at runtime from the browser devtools console:
//   window.__BRIDGE_DEBUG_UPLOAD = true   // verbose timing + raw output
//   window.__BRIDGE_DEBUG_UPLOAD = false  // back to quiet (default)
function dbgEnabled() {
  return typeof window !== "undefined" && !!window.__BRIDGE_DEBUG_UPLOAD;
}
/** Write a debug line to the terminal AND console. No-op if disabled. */
function dbg(msg) {
  if (!dbgEnabled()) return;
  termWrite(`[dbg] ${msg}\r\n`);
  try {
    console.debug("[bridge-upload]", msg);
  } catch (_e) {
    /* ignore */
  }
}
/** Shorten device output for terminal display (escapes CR/LF and \x04). */
function summarizeOutput(s, max = 200) {
  if (!s) return "<empty>";
  const escaped = s
    .replace(/\x04/g, "<EOT>")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  if (escaped.length <= max) return escaped;
  return `${escaped.slice(0, max)}…(${escaped.length}b total)`;
}

// Files that should never be merged into a multi-file batch and that
// should be uploaded LAST so any failure is immediately visible (and so
// they aren't competing for the same race window as everything else).
const CRITICAL_FILE_BASENAMES = new Set(["main.py", "boot.py"]);

// Max retries per file when post-upload verification reports a real
// size mismatch (i.e. the file on the device is actually wrong).
const VERIFY_MAX_RETRIES = 2;

// How many times to re-issue the verify command itself if the device's
// reply doesn't arrive (or is truncated) within the wait window. This
// is distinct from VERIFY_MAX_RETRIES — a missing reply is NOT a write
// failure, it just means we didn't wait long enough. Each retry uses a
// longer wait window before we conclude something is actually wrong.
const VERIFY_RESPONSE_RETRIES = 3;

// Track whether we've synced the Pico's RTC this session. The RTC
// survives across uploads but resets on power loss, so we re-sync on
// every fresh connection (handled via store.isRtcSynced()).

/**
 * Push the host's wall-clock into the Pico's RTC. LFS2 stamps every
 * subsequent file write with the RTC time automatically (mtime=True is
 * the default), so this is all we need for accurate file timestamps —
 * no per-file os.utime() call required (and many firmware builds don't
 * ship os.utime at all). Idempotent: safe to call before every upload.
 */
async function syncRtc() {
  const d = new Date();
  // RTC.datetime tuple: (year, month, day, weekday, hour, min, sec, subsec)
  // weekday: Mon=0..Sun=6 in MicroPython; JS getDay() is Sun=0..Sat=6.
  const jsDay = d.getDay();
  const weekday = (jsDay + 6) % 7;
  const tuple = `(${d.getFullYear()}, ${d.getMonth() + 1}, ${d.getDate()}, ${weekday}, ${d.getHours()}, ${d.getMinutes()}, ${d.getSeconds()}, 0)`;
  const code = `try:\n import machine\n machine.RTC().datetime(${tuple})\nexcept Exception as _e:\n pass\n`;
  try {
    await sendRawCommand(code, 200);
  } catch (_err) {
    // Non-fatal: timestamps will just be 2000-01-01 if this fails.
  }
}

/**
 * UTF-8 byte length of a string (what os.stat()[6] will report after we
 * write it). Used both for verification and for sizing waits accurately.
 */
function utf8ByteLength(s) {
  return new TextEncoder().encode(s).length;
}

function isCriticalPath(path) {
  const base = path.substring(path.lastIndexOf("/") + 1);
  return CRITICAL_FILE_BASENAMES.has(base);
}

/**
 * Animate "..." after a status line while a slow op is in flight. Uses
 * CR + ANSI erase-to-end-of-line to redraw the same row, then clears the
 * dots and emits a newline when stop() is called. Safe to call stop()
 * more than once.
 * @param {string} prefix - text to display before the animated dots
 * @returns {() => void} stop function
 */
function startUploadSpinner(prefix) {
  const frames = ["   ", ".  ", ".. ", "..."];
  let i = 0;
  // Initial frame
  termWrite(`${prefix} ${frames[0]}`);
  const timer = setInterval(() => {
    i = (i + 1) % frames.length;
    // \r returns to column 0; \x1b[K erases from cursor to end of line.
    termWrite(`\r${prefix} ${frames[i]}\x1b[K`);
  }, 200);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    // Wipe the spinner row and end with a clean newline.
    termWrite(`\r${prefix}\x1b[K\r\n`);
  };
}

/**
 * List files on Pico using os.listdir() - recursive
 */
export async function listPicoFiles() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  termWrite("\r\n[Bridge] Listing files on Pico...\r\n");

  const code = `import os
try:
    import time
    _lt = time.localtime
except:
    _lt = None
def _ts(t):
    # Hide timestamps that resolve to 2000-01-01 (Pico's epoch zero,
    # meaning the RTC was never set when the file was written).
    if not t or _lt is None:
        return ''
    try:
        Y, M, D, h, m, s, _, _ = _lt(t)
        if Y <= 2000:
            return ''
        return ', %04d-%02d-%02d %02d:%02d' % (Y, M, D, h, m)
    except:
        return ''
def ls(path='/', indent=''):
    try:
        items = os.listdir(path)
    except:
        return
    for f in sorted(items):
        fp = path + ('/' if path != '/' else '') + f
        try:
            os.listdir(fp)
            print(indent + f + '/')
            ls(fp, indent + '  ')
        except:
            try:
                st = os.stat(fp)
                size = st[6]
                mtime = st[8] if len(st) > 8 else 0
            except:
                size = 0
                mtime = 0
            print(indent + f + ' (' + str(size) + 'b' + _ts(mtime) + ')')
print('/')
ls('/')
`;

  try {
    await sendRawCommand(code, 1000); // Wait longer for recursive listing
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Run file on Pico (execute without saving)
 * @param {string} filePath - Relative path to file
 */
export async function runFile(filePath) {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  termWrite(`\r\n[Bridge] Running ${filePath}...\r\n`);
  termWrite("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n");

  try {
    const data = await getFileContent(filePath);
    if (!data) return;

    // Send the code via raw REPL
    await sendRawCommand(data.content);
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Upload file to Pico (save to filesystem)
 * @param {string} filePath - Relative path to file
 */
export async function uploadFile(filePath) {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  if (!store.isProjectDetected()) {
    termWrite(MARKER_REMINDER);
    return;
  }

  termWrite(`\r\n[Bridge] Uploading ${filePath}...\r\n`);

  try {
    await syncRtc();
    const data = await getFileContent(filePath);
    if (!data) return;

    if (!data.projectDetected) {
      termWrite(
        "[Bridge] Project marker missing. Create a .micropico file in your project root.\r\n",
      );
      return;
    }

    // Check if file has a valid destination path (within project)
    if (!data.destPath) {
      termWrite(
        `[Bridge] Cannot upload: File is outside the project folder.\r\n`,
      );
      termWrite(
        `[Bridge] Move the file inside the .micropico project folder first.\r\n`,
      );
      return;
    }

    const destPath = data.destPath;
    await writeSingleFile(destPath, data.content);
    termWrite(`[Bridge] ✓ Uploaded: ${destPath}\r\n`);
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Write one file to the Pico with a payload-aware wait window. Used by
 * the single-file upload UI, the "critical files last" pass in
 * uploadProject(), and the auto-retry loop in verifyUploads().
 */
async function writeSingleFile(destPath, content) {
  // Ensure parent directory exists.
  const dirPath = destPath.substring(0, destPath.lastIndexOf("/"));
  if (dirPath && dirPath !== "/") {
    await ensureDirectory(dirPath);
  }

  const b64 = btoa(unescape(encodeURIComponent(content)));
  const payloadBytes = utf8ByteLength(content);
  const marker = newMarker("WROTE");

  // LFS2 stamps mtime from the RTC on close(); syncRtc() was called by
  // the entry-point upload function. No explicit os.utime needed.
  const writeCode = `import ubinascii
f = open('${destPath}', 'w')
f.write(ubinascii.a2b_base64('${b64}').decode())
f.close()
print('${marker}')
`;

  // Layer 4: marker-based completion. Returns the moment the device
  // prints `${marker}`, instead of blindly sleeping for the worst-case
  // estimate. Falls back to ~3x the estimate as a hard timeout so a
  // stuck device can never deadlock the UI.
  const result = await sendRawCommandUntilMarker(writeCode, marker);
  if (!result.found) {
    // Marker never arrived — last-resort blind wait, then continue. The
    // verify pass (Layer 3) will catch a truly failed write and retry.
    termWrite(
      `[Bridge] ! No completion marker for ${destPath} (${Math.round(result.elapsedMs)}ms)\r\n`,
    );
    await sendRawCommand("", computeWaitMs(writeCode.length, payloadBytes));
  }
}

/**
 * Upload lib folder - Smart batching (silent mode)
 */
export async function uploadLib() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  if (!store.isProjectDetected()) {
    termWrite(MARKER_REMINDER);
    return;
  }

  termWrite("\r\n[Bridge] Uploading lib folder...\r\n");

  try {
    await syncRtc();
    const files = await getLibFiles();
    if (!files || files.length === 0) {
      termWrite("[Bridge] No lib files found to upload\r\n");
      return;
    }

    // Enable silent mode to suppress raw REPL output
    store.setSilentMode(true);

    // Collect all unique directories from file paths
    const directories = new Set();
    files.forEach((file) => {
      // file.path is like "/lib/launcher/__init__.py"
      const filePath = file.path.startsWith("/") ? file.path : "/" + file.path;
      const parts = filePath.split("/").filter(Boolean);
      // Build directory paths: /lib, /lib/launcher, etc.
      for (let i = 1; i < parts.length; i++) {
        directories.add("/" + parts.slice(0, i).join("/"));
      }
    });

    // Create all directories first
    if (directories.size > 0) {
      const dirArray = Array.from(directories).sort();
      const dirCode = `import os
dirs = ${JSON.stringify(dirArray)}
for d in dirs:
    try:
        os.mkdir(d)
    except:
        pass
`;
      await sendRawCommand(dirCode, 300);
    }

    // Calculate base64 size for each file. Sort LARGEST first so any
    // memory pressure surfaces while the heap is freshest, and so a
    // failure isn't hidden by lots of successful tiny files at the end.
    const filesWithSize = files
      .map((file) => {
        const b64 = btoa(unescape(encodeURIComponent(file.content)));
        const destPath = file.path.startsWith("/")
          ? file.path
          : "/" + file.path;
        return {
          name: file.name,
          path: destPath,
          content: file.content,
          b64,
          b64Size: b64.length,
          bytes: utf8ByteLength(file.content),
        };
      })
      .sort((a, b) => b.b64Size - a.b64Size);

    // Smart batching: group files up to ~4KB batch size
    const MAX_BATCH_SIZE = 4000;
    const batches = createBatches(filesWithSize, MAX_BATCH_SIZE);

    // Upload each batch silently
    let uploadedCount = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const marker = newMarker("BATCH");
      const batchCode = createBatchUploadCode(batch, marker);
      const result = await sendRawCommandUntilMarker(batchCode, marker);
      if (!result.found) {
        const payloadBytes = batch.reduce((s, f) => s + f.bytes, 0);
        await sendRawCommand("", computeWaitMs(batchCode.length, payloadBytes));
      }
      uploadedCount += batch.length;
    }

    // Disable silent mode
    store.setSilentMode(false);

    termWrite(
      `[Bridge] ✓ Uploaded ${uploadedCount} lib files (${batches.length} batches)\r\n`,
    );

    // Layer 3: verify and auto-retry any missing/short files.
    await verifyAndRetry(filesWithSize, "lib");
  } catch (err) {
    store.setSilentMode(false);
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Upload entire project - Smart batching + Silent mode
 */
export async function uploadProject() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  if (!store.isProjectDetected()) {
    termWrite(MARKER_REMINDER);
    return;
  }

  termWrite("\r\n[Bridge] Uploading project...\r\n");
  store.setSilentMode(true);

  try {
    await syncRtc();
    const projectData = await getProjectFiles();
    if (!projectData) {
      store.setSilentMode(false);
      return;
    }

    const { files, directories } = projectData;

    termWrite(`  Found ${files.length} files to upload\r\n`);

    // First, create all directories
    if (directories.length > 0) {
      const dirCode = `import os
dirs = ${JSON.stringify(directories)}
for d in dirs:
    try:
        os.mkdir(d)
    except:
        pass
`;
      await sendRawCommand(dirCode, 300);
      termWrite(`  Created ${directories.length} directories\r\n`);
    }

    // Layer 2: split critical files (main.py, boot.py) out from the
    // batched stream. They're uploaded LAST, each as their own
    // single-file write with a full payload-aware wait budget, so a race
    // or memory pressure on the busy early batches cannot eat the file
    // that runs at boot. Then sort the remainder LARGEST first so any
    // failure shows up while the heap is fresh.
    const filesWithSize = files.map((file) => {
      const b64 = btoa(unescape(encodeURIComponent(file.content)));
      return {
        ...file,
        b64,
        b64Size: b64.length,
        bytes: utf8ByteLength(file.content),
      };
    });
    const criticalFiles = filesWithSize.filter((f) => isCriticalPath(f.path));
    const batchedFiles = filesWithSize
      .filter((f) => !isCriticalPath(f.path))
      .sort((a, b) => b.b64Size - a.b64Size);

    // Smart batching
    const MAX_BATCH_SIZE = 4000;
    const batches = createBatches(batchedFiles, MAX_BATCH_SIZE);

    termWrite(
      `  Uploading in ${batches.length} batch(es)` +
        (criticalFiles.length
          ? ` + ${criticalFiles.length} critical file(s) last\r\n`
          : `\r\n`),
    );

    // Upload each batch
    let uploadedCount = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      let prefix;
      if (batch.length === 1 && batch[0].b64Size > MAX_BATCH_SIZE) {
        prefix = `  [${i + 1}/${batches.length}] ${batch[0].path} (${Math.round(
          batch[0].b64Size / 1024,
        )}KB)`;
      } else {
        prefix = `  [${i + 1}/${batches.length}] ${batch.length} file(s): ${batch
          .map((f) => f.path)
          .join(", ")}`;
      }
      const stopSpinner = startUploadSpinner(prefix);

      const marker = newMarker("BATCH");
      const batchCode = createBatchUploadCode(batch, marker);
      const payloadBytes = batch.reduce((sum, f) => sum + f.bytes, 0);
      const hardCap = Math.max(
        2000,
        computeWaitMs(batchCode.length, payloadBytes) * 3,
      );
      dbg(
        `batch ${i + 1}/${batches.length}: ${batch.length} file(s), ` +
          `code=${batchCode.length}b payload=${payloadBytes}b hardCap=${hardCap}ms`,
      );
      const tBatch = performance.now();
      try {
        const result = await sendRawCommandUntilMarker(
          batchCode,
          marker,
          hardCap,
        );
        const elapsed = Math.round(performance.now() - tBatch);
        if (result.found) {
          dbg(`  ✓ marker found in ${elapsed}ms (cap ${hardCap}ms)`);
        } else {
          dbg(
            `  ✗ marker MISSING after ${elapsed}ms (cap ${hardCap}ms); ` +
              `device output tail: ${summarizeOutput(result.output)}`,
          );
          const fallbackWait = computeWaitMs(batchCode.length, payloadBytes);
          dbg(`  falling back to fixed wait ${fallbackWait}ms`);
          await sendRawCommand("", fallbackWait);
        }
      } finally {
        stopSpinner();
      }

      uploadedCount += batch.length;
    }

    // Critical files: one-per-call, in deterministic order (boot.py before
    // main.py so a failed boot.py doesn't leave main.py orphaned at boot).
    criticalFiles.sort((a, b) => {
      const order = ["boot.py", "main.py"];
      const ai = order.indexOf(a.path.split("/").pop());
      const bi = order.indexOf(b.path.split("/").pop());
      return ai - bi;
    });
    for (const f of criticalFiles) {
      const stopSpinner = startUploadSpinner(
        `  [critical] ${f.path} (${f.bytes}b)`,
      );
      try {
        await writeSingleFile(f.path, f.content);
      } finally {
        stopSpinner();
      }
      uploadedCount++;
    }

    store.setSilentMode(false);
    termWrite(
      `[Bridge] ✓ Uploaded ${uploadedCount} files in ${batches.length} batch(es)\r\n`,
    );

    // Layer 3: verify every uploaded file exists with the right byte
    // length; auto-retry any mismatch up to VERIFY_MAX_RETRIES.
    await verifyAndRetry(filesWithSize, "project");
  } catch (err) {
    store.setSilentMode(false);
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

/**
 * Delete ALL files on Pico
 */
export async function deleteAllFiles() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  // Confirm with user
  if (
    !confirm(
      "⚠️ WARNING: This will DELETE ALL files on the Pico!\n\nAre you sure?",
    )
  ) {
    termWrite("\r\n[Bridge] Delete cancelled\r\n");
    return;
  }

  termWrite("\r\n[Bridge] Deleting all files on Pico...\r\n");

  const code = `import os
def rm_rf(path):
    try:
        for f in os.listdir(path):
            fp = path + '/' + f
            try:
                os.listdir(fp)
                rm_rf(fp)
                os.rmdir(fp)
                print('Removed dir:', fp)
            except:
                os.remove(fp)
                print('Removed:', fp)
    except:
        pass

# Delete everything in root
for f in os.listdir('/'):
    if f not in ['boot.py']:  # Keep boot.py if exists
        fp = '/' + f
        try:
            os.listdir(fp)
            rm_rf(fp)
            os.rmdir(fp)
            print('Removed dir:', fp)
        except:
            os.remove(fp)
            print('Removed:', fp)
print('Done - all files deleted')
`;

  try {
    await sendRawCommand(code);
    termWrite("[Bridge] ✓ All files deleted\r\n");
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  }
}

// === Helper Functions ===

/**
 * Create batches from files based on max batch size
 */
function createBatches(files, maxBatchSize) {
  const batches = [];
  let currentBatch = [];
  let currentBatchSize = 0;

  for (const file of files) {
    if (file.b64Size > maxBatchSize) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }
      batches.push([file]);
    } else if (currentBatchSize + file.b64Size > maxBatchSize) {
      batches.push(currentBatch);
      currentBatch = [file];
      currentBatchSize = file.b64Size;
    } else {
      currentBatch.push(file);
      currentBatchSize += file.b64Size;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Create batch upload code for multiple files. If a marker is supplied,
 * the script prints it on the final line so the host can detect
 * completion via sendRawCommandUntilMarker (Layer 4 — no blind sleep).
 */
function createBatchUploadCode(batch, marker) {
  let code = `import ubinascii
files = {
`;
  for (const file of batch) {
    code += `'${file.path}': '${file.b64}',\n`;
  }
  code += `}
for path, b64 in files.items():
    f = open(path, 'w')
    f.write(ubinascii.a2b_base64(b64).decode())
    f.close()
`;
  if (marker) {
    code += `print('${marker}')\n`;
  }
  return code;
}

/**
 * Verify every expected file exists on the Pico with the correct UTF-8
 * byte length. Any mismatches are retried as single-file writes (up to
 * VERIFY_MAX_RETRIES) and re-verified. Surfaces a clear pass/fail
 * summary in the terminal.
 *
 * @param {Array<{path:string, content:string, bytes:number}>} expected
 * @param {string} label - e.g. "project" or "lib", for log messages
 */
async function verifyAndRetry(expected, label) {
  if (!expected || expected.length === 0) return;

  termWrite(`[Bridge] Verifying ${expected.length} file(s)...\r\n`);

  let remaining = expected.slice();
  let attempt = 0;

  while (remaining.length > 0 && attempt <= VERIFY_MAX_RETRIES) {
    // verifyBatch handles its own internal retries for slow/truncated
    // device responses, so by the time it returns we know the device
    // actually answered. `bad` is the list of REAL size mismatches.
    const bad = await verifyBatch(remaining);

    if (bad === null) {
      // Device never produced a readable verify reply for the full batch.
      // This typically means the batched os.stat() reply was too big or
      // got truncated by the REPL buffer. Retry in small chunks — each
      // chunk's reply easily fits in the buffer, so even a stressed
      // device gives a deterministic answer.
      termWrite(
        `[Bridge] Batched verify reply unreadable \u2014 falling back to chunked verify (8 file(s) per chunk)...\r\n`,
      );
      const chunkSize = 8;
      const chunkedBad = [];
      let chunkedFailed = false;
      for (let i = 0; i < remaining.length; i += chunkSize) {
        const chunk = remaining.slice(i, i + chunkSize);
        const chunkResult = await verifyBatch(chunk);
        if (chunkResult === null) {
          chunkedFailed = true;
          break;
        }
        chunkedBad.push(...chunkResult);
      }

      if (chunkedFailed) {
        termWrite(
          `[Bridge] \u26a0 Device still not responding to verify. Running \ud83d\udcc1 List for an authoritative check...\r\n`,
        );
        try {
          await listPicoFiles();
        } catch (err) {
          termWrite(`[Bridge] List failed: ${err.message}\r\n`);
        }
        termWrite(
          `[Bridge] Compare the listing above against the ${expected.length} uploaded file(s) to confirm.\r\n`,
        );
        return;
      }

      if (chunkedBad.length === 0) {
        termWrite(
          `[Bridge] \u2713 Verification passed via chunked fallback (${label}, ${expected.length} file(s)).\r\n`,
        );
        return;
      }

      // Treat chunked mismatches like a normal `bad` result and fall
      // through to the retry/re-upload path below.
      remaining = chunkedBad
        .map((b) => expected.find((f) => f.path === b.path))
        .filter(Boolean);
      termWrite(
        `[Bridge] ${chunkedBad.length} file(s) had wrong size on device \u2014 re-uploading (attempt ${attempt + 1}/${VERIFY_MAX_RETRIES})...\r\n`,
      );
      for (const b of chunkedBad) {
        const file = remaining.find((f) => f.path === b.path);
        if (!file) continue;
        try {
          store.setSilentMode(true);
          await writeSingleFile(file.path, file.content);
        } catch (err) {
          termWrite(`  [retry-error] ${file.path}: ${err.message}\r\n`);
        } finally {
          store.setSilentMode(false);
        }
      }
      attempt++;
      continue;
    }

    if (bad.length === 0) {
      termWrite(`[Bridge] \u2713 Verification passed (${label}).\r\n`);
      return;
    }

    if (attempt === VERIFY_MAX_RETRIES) {
      termWrite(
        `[Bridge] \u2717 Verification failed for ${bad.length} file(s) after ${VERIFY_MAX_RETRIES} retries:\r\n`,
      );
      for (const b of bad) {
        const got = b.got < 0 ? "MISSING" : `${b.got}b`;
        termWrite(`  \u2717 ${b.path}  expected ${b.want}b, got ${got}\r\n`);
      }
      return;
    }

    termWrite(
      `[Bridge] ${bad.length} file(s) had wrong size on device \u2014 re-uploading (attempt ${attempt + 1}/${VERIFY_MAX_RETRIES})...\r\n`,
    );
    for (const b of bad) {
      const file = remaining.find((f) => f.path === b.path);
      if (!file) continue;
      try {
        store.setSilentMode(true);
        await writeSingleFile(file.path, file.content);
      } catch (err) {
        termWrite(`  [retry-error] ${file.path}: ${err.message}\r\n`);
      } finally {
        store.setSilentMode(false);
      }
    }
    remaining = bad
      .map((b) => expected.find((f) => f.path === b.path))
      .filter(Boolean);
    attempt++;
  }
}

/**
 * Ask the device for the byte size of each expected path and return the
 * list of paths whose size doesn't match (or that are missing).
 *
 * Uses the same marker-poll mechanism as the upload path
 * (`sendRawCommandUntilMarker`) instead of a blind fixed-sleep + capture.
 * This mirrors the official MicroPython raw-REPL request/response model
 * (cf. mpremote / pyboard.py): we resolve the instant the device prints
 * the `__VERIFY_DONE__` sentinel, so verify is both faster on the happy
 * path and dramatically more reliable when the device is briefly busy
 * with post-upload flash housekeeping.
 *
 * The Python side prints one line per mismatch:
 *   __VERIFY_FAIL__ <path> <expected> <actualOrMinus1>
 * and a single summary line either way (used as the completion marker):
 *   __VERIFY_DONE__ <total> <failures>
 */
async function verifyBatch(files) {
  const expectedMap = {};
  for (const f of files) expectedMap[f.path] = f.bytes;

  // JSON-encode and escape single quotes for embedding in a Python string literal.
  const expectedJson = JSON.stringify(expectedMap).replace(/'/g, "\\'");
  // Stable, parseable marker; also serves as the host's completion sentinel.
  const doneMarker = "__VERIFY_DONE__";
  const code = `import os, json
_expected = json.loads('${expectedJson}')
_fail = 0
for _p, _w in _expected.items():
    try:
        _g = os.stat(_p)[6]
    except:
        _g = -1
    if _g != _w:
        _fail += 1
        print('__VERIFY_FAIL__', _p, _w, _g)
print('${doneMarker}', len(_expected), _fail)
`;

  // Generous hard cap: stat'ing many paths on the Pico right after a
  // multi-batch upload (while LFS2 flash I/O is still settling) can be
  // noticeably slow. Allow ~80ms/file with a 15s floor — marker-poll
  // returns the moment the sentinel arrives, so this cap is only hit
  // when the device is genuinely unresponsive.
  const hardCap = Math.max(
    15000,
    computeWaitMs(code.length, 0) + files.length * 80,
  );

  let captured;
  for (let attempt = 0; attempt <= VERIFY_RESPONSE_RETRIES; attempt++) {
    let result;
    const tVerify = performance.now();
    dbg(
      `verify attempt ${attempt + 1}/${VERIFY_RESPONSE_RETRIES + 1}: ` +
        `${files.length} file(s), code=${code.length}b hardCap=${hardCap}ms`,
    );
    try {
      result = await sendRawCommandUntilMarker(code, doneMarker, hardCap);
    } catch (err) {
      dbg(`  verify call threw: ${err.message}`);
      if (attempt === VERIFY_RESPONSE_RETRIES) {
        termWrite(`[Bridge] Verify call failed: ${err.message}\r\n`);
        return null;
      }
      continue;
    }

    const elapsed = Math.round(performance.now() - tVerify);
    if (result.found) {
      dbg(`  ✓ verify marker found in ${elapsed}ms`);
      captured = result.output;
      break;
    }
    dbg(
      `  ✗ verify marker MISSING after ${elapsed}ms; ` +
        `output tail: ${summarizeOutput(result.output)}`,
    );

    if (attempt < VERIFY_RESPONSE_RETRIES) {
      termWrite(
        `[Bridge] Device still finishing up \u2014 waiting longer for verify reply (${attempt + 2}/${VERIFY_RESPONSE_RETRIES + 1})...\r\n`,
      );
    }
  }

  if (!captured) {
    // Exhausted retries without ever seeing __VERIFY_DONE__. Signal the
    // caller with `null` so it can report a soft warning instead of
    // pretending the files are bad and re-uploading everything.
    return null;
  }

  const bad = [];
  const lines = captured.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("__VERIFY_FAIL__")) {
      const parts = line.trim().split(/\s+/);
      // __VERIFY_FAIL__ <path> <expected> <actual>
      if (parts.length >= 4) {
        bad.push({
          path: parts[1],
          want: parseInt(parts[2], 10),
          got: parseInt(parts[3], 10),
        });
      }
    }
  }
  return bad;
}
