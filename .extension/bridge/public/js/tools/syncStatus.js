/**
 * Sync Status Module
 *
 * In-browser panel that compares the workspace project files (as
 * reported by the bridge server) against the files on the connected
 * Pico, and offers per-file Push / Pull / Delete / Diff actions plus
 * bulk Push-All and Mirror operations.
 *
 * Architecture:
 *   workspace files  ──► /api/workspace/sync-status (server, SHA-256)
 *   device files     ──► raw REPL `uhashlib.sha256` walk
 *   classify         ──► by joining on Pico-style path "/main.py" etc.
 *
 * Status taxonomy:
 *   "synced"      both sides, same SHA-256
 *   "modified"    both sides, different content
 *   "not-deployed" workspace only (needs Push)
 *   "orphan"      device only (Pull-to-rescue or Delete)
 */

import {
  computeWaitMs,
  newMarker,
  sendRawCommandAndCapture,
  sendRawCommandUntilMarker,
} from "../serial/rawRepl.js";
import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";
import { releaseFocus, trapFocus } from "../ui/focusTrap.js";
import { diffLines, renderDiffHtml } from "./diff.js";

const MAX_PULL_BYTES = 256 * 1024;

let cachedStatus = null;
let isRefreshing = false;

// ---------------------------------------------------------------------------
// Device-side helpers
// ---------------------------------------------------------------------------

/**
 * Walk the Pico filesystem and emit one JSON object per file with size
 * and SHA-256. Output is bracketed by sentinels so the host can pluck
 * the JSON out of REPL chatter reliably.
 */
function buildDeviceListingScript() {
  const start = "__BRIDGE_SYNC_START__";
  const end = "__BRIDGE_SYNC_END__";
  // Important: keep the script tight — every byte travels over USB.
  // uhashlib.sha256 ships with every modern MicroPython port.
  //
  // Performance notes:
  //  * Reading in 4 KiB chunks (was 1 KiB) roughly quarters the Python
  //    loop overhead during hashing, which dominates on the Pico.
  //  * Skipping `__pycache__` saves walking the bytecode cache that the
  //    workspace never produces, so it never matches anything anyway.
  const py = `
import os, uhashlib, ubinascii, json
def _walk(p, out):
    try:
        items = os.listdir(p)
    except:
        return
    for n in items:
        if n == '__pycache__':
            continue
        fp = (p if p == '/' else p + '/') + n
        try:
            st = os.stat(fp)
        except:
            continue
        mode = st[0]
        if mode & 0x4000:
            _walk(fp, out)
        else:
            h = uhashlib.sha256()
            try:
                f = open(fp, 'rb')
                while True:
                    chunk = f.read(4096)
                    if not chunk:
                        break
                    h.update(chunk)
                f.close()
                out.append({'path': fp, 'size': st[6], 'mtime': st[8],
                            'sha256': ubinascii.hexlify(h.digest()).decode()})
            except:
                pass
_o = []
_walk('/', _o)
print('${start}')
print(json.dumps(_o))
print('${end}')
`;
  return { code: py, start, end };
}

/**
 * Run the device listing script and parse the JSON envelope.
 * @returns {Promise<Array<{path:string,size:number,sha256:string}>>}
 */
async function listDeviceFilesWithHash() {
  const { code, start, end } = buildDeviceListingScript();
  // Hashing every file on a Pico with a few dozen scripts takes a couple
  // of seconds. Give a generous wait budget; the device prints the END
  // marker as soon as it's done, so we won't usually need the whole cap.
  const waitMs = Math.max(8000, computeWaitMs(code.length, 64 * 1024));
  const output = await sendRawCommandAndCapture(code, waitMs);

  const a = output.indexOf(start);
  const b = output.indexOf(end);
  if (a === -1 || b === -1 || b <= a) {
    throw new Error(
      "Device did not return a complete file listing (uhashlib.sha256 supported?)",
    );
  }

  // Between the two sentinels there's a single JSON line, possibly with
  // trailing/leading \r\n and stray raw-REPL prompt bytes — extract the
  // first balanced [...] block we can find.
  const slice = output.slice(a + start.length, b);
  const lb = slice.indexOf("[");
  const rb = slice.lastIndexOf("]");
  if (lb === -1 || rb === -1) {
    throw new Error("Device listing missing JSON array");
  }
  const json = slice.slice(lb, rb + 1);
  try {
    return JSON.parse(json);
  } catch (err) {
    throw new Error(`Failed to parse device listing JSON: ${err.message}`);
  }
}

/**
 * Read a single file off the Pico as UTF-8 text. Used by the Diff modal
 * and by Pull. We cap at MAX_PULL_BYTES so a user accidentally
 * diff-clicking a huge log file doesn't hang the REPL for minutes.
 */
async function readDeviceFile(picoPath) {
  const escaped = picoPath.replace(/'/g, "\\'");
  const start = "__BRIDGE_FILE_START__";
  const end = "__BRIDGE_FILE_END__";
  const py = `
import ubinascii
try:
    f = open('${escaped}', 'rb')
    _d = f.read(${MAX_PULL_BYTES + 1})
    f.close()
    if len(_d) > ${MAX_PULL_BYTES}:
        print('__BRIDGE_TOO_BIG__')
    else:
        print('${start}')
        print(ubinascii.b2a_base64(_d).decode().strip())
        print('${end}')
except Exception as _e:
    print('__BRIDGE_READ_ERR__:' + str(_e))
`;
  const waitMs = Math.max(2000, computeWaitMs(py.length, MAX_PULL_BYTES));
  const output = await sendRawCommandAndCapture(py, waitMs);

  if (output.includes("__BRIDGE_TOO_BIG__")) {
    throw new Error(`File exceeds ${MAX_PULL_BYTES} byte cap`);
  }
  const errIdx = output.indexOf("__BRIDGE_READ_ERR__:");
  if (errIdx !== -1) {
    const tail = output.slice(errIdx).split(/\r?\n/)[0];
    throw new Error(tail.replace("__BRIDGE_READ_ERR__:", "Device: "));
  }
  const a = output.indexOf(start);
  const b = output.indexOf(end);
  if (a === -1 || b === -1) {
    throw new Error("Device did not return file content");
  }
  const b64 = output
    .slice(a + start.length, b)
    .replace(/[\r\n]+/g, "")
    .trim();
  // atob → binary string → UTF-8 decode.
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Remove a file on the Pico. Caller is expected to refresh the panel
 * afterwards.
 */
async function deleteDeviceFile(picoPath) {
  const escaped = picoPath.replace(/'/g, "\\'");
  const marker = newMarker("DEL");
  const py = `
import os
try:
    os.remove('${escaped}')
    print('${marker}:ok')
except Exception as _e:
    print('${marker}:err:' + str(_e))
`;
  const result = await sendRawCommandUntilMarker(py, marker);
  if (!result.found) {
    throw new Error("Delete confirmation marker did not arrive");
  }
  if (result.output.includes(`${marker}:err`)) {
    const errLine = result.output
      .split(/\r?\n/)
      .find((l) => l.includes(`${marker}:err`));
    throw new Error(errLine || "Device delete failed");
  }
}

// ---------------------------------------------------------------------------
// Workspace-side helpers
// ---------------------------------------------------------------------------

async function fetchWorkspaceSnapshot() {
  const res = await fetch("/api/workspace/sync-status");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Workspace snapshot failed");
  return data;
}

async function fetchWorkspaceFileContent(picoPath) {
  const res = await fetch(
    `/api/workspace/file?path=${encodeURIComponent(picoPath)}`,
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Workspace read failed");
  return data.content;
}

async function writeWorkspaceFileContent(picoPath, content) {
  const res = await fetch("/api/workspace/file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: picoPath, content }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Workspace write failed");
  return data;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classify(workspaceFiles, deviceFiles) {
  const wsMap = new Map(workspaceFiles.map((f) => [f.path, f]));
  const devMap = new Map(deviceFiles.map((f) => [f.path, f]));

  const rows = [];
  for (const [p, w] of wsMap) {
    const d = devMap.get(p);
    if (!d) {
      rows.push({
        path: p,
        status: "not-deployed",
        workspace: w,
        device: null,
      });
    } else if (w.sha256 === d.sha256) {
      rows.push({ path: p, status: "synced", workspace: w, device: d });
    } else {
      rows.push({ path: p, status: "modified", workspace: w, device: d });
    }
  }
  for (const [p, d] of devMap) {
    if (!wsMap.has(p)) {
      rows.push({ path: p, status: "orphan", workspace: null, device: d });
    }
  }

  rows.sort((a, b) => {
    const rank = { modified: 0, "not-deployed": 1, orphan: 2, synced: 3 };
    const r = rank[a.status] - rank[b.status];
    return r !== 0 ? r : a.path.localeCompare(b.path);
  });

  const summary = {
    synced: rows.filter((r) => r.status === "synced").length,
    modified: rows.filter((r) => r.status === "modified").length,
    notDeployed: rows.filter((r) => r.status === "not-deployed").length,
    orphan: rows.filter((r) => r.status === "orphan").length,
    total: rows.length,
  };

  return { rows, summary };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const STATUS_META = {
  synced: { icon: "✅", label: "in sync", cls: "sync-row-ok" },
  modified: { icon: "🟡", label: "differs", cls: "sync-row-mod" },
  "not-deployed": { icon: "🔵", label: "not deployed", cls: "sync-row-new" },
  orphan: { icon: "🔴", label: "only on device", cls: "sync-row-orphan" },
};

function formatBytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

// MicroPython bare-metal ports (rp2, stm32, esp32 without RTC sync) use
// an epoch of 2000-01-01 instead of 1970-01-01. Detect that by checking
// for an implausibly old date and shift forward by 30 years.
const EPOCH_2000_OFFSET = 946684800; // seconds between 1970-01-01 and 2000-01-01

function formatMtime(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  let s = seconds;
  // If the timestamp lands before the year 2000 in unix-epoch terms,
  // it's almost certainly a 2000-epoch value from a bare-metal port.
  if (s < EPOCH_2000_OFFSET) s += EPOCH_2000_OFFSET;
  const d = new Date(s * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const absDiff = Math.abs(diffMs);
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  let rel;
  if (absDiff < MIN) rel = "just now";
  else if (absDiff < HOUR) rel = `${Math.round(absDiff / MIN)}m ago`;
  else if (absDiff < DAY) rel = `${Math.round(absDiff / HOUR)}h ago`;
  else if (absDiff < 7 * DAY) rel = `${Math.round(absDiff / DAY)}d ago`;
  else rel = d.toLocaleDateString();
  const abs = d.toLocaleString();
  return `<span class="sync-mtime" title="${escapeAttr(abs)}">🕒 ${escapeHtml(rel)}</span>`;
}

function renderStatusPanel() {
  const body = document.getElementById("syncBody");
  const summaryEl = document.getElementById("syncSummary");
  const projEl = document.getElementById("syncProjectRoot");
  if (!body || !summaryEl) return;

  if (!cachedStatus) {
    body.innerHTML = `<div class="sync-empty">Click <strong>Refresh</strong> to compare your workspace against the connected Pico.</div>`;
    summaryEl.textContent = "";
    if (projEl) projEl.textContent = "";
    return;
  }

  const { rows, summary, projectRoot, projectDetected } = cachedStatus;

  if (projEl) {
    if (!projectDetected) {
      projEl.innerHTML = `<span class="sync-warn">⚠ No <code>.micropico</code> marker — scanning workspace root</span>`;
    } else {
      projEl.textContent = `Project: ${projectRoot}`;
    }
  }

  summaryEl.innerHTML = `
    <span class="sync-pill sync-pill-ok">✅ ${summary.synced} synced</span>
    <span class="sync-pill sync-pill-mod">🟡 ${summary.modified} modified</span>
    <span class="sync-pill sync-pill-new">🔵 ${summary.notDeployed} to deploy</span>
    <span class="sync-pill sync-pill-orphan">🔴 ${summary.orphan} stale</span>
  `;

  if (rows.length === 0) {
    body.innerHTML = `<div class="sync-empty">No deployable files found in workspace or on device.</div>`;
    return;
  }

  body.innerHTML = renderGroupedRows(rows);
}

/**
 * Render the rows grouped by directory. Each group gets a header
 * showing the folder path, file count, and (if the folder exists only
 * on the device, never in the workspace) a "← Pull folder" button that
 * recreates the folder + every orphan file beneath it in one click.
 */
function renderGroupedRows(rows) {
  // Bucket rows by their parent directory (Pico-style, e.g. "/" or
  // "/lib/launcher"). Within each bucket we keep the existing rank
  // order from `classify()`.
  const groups = new Map();
  for (const r of rows) {
    const dir = dirnamePico(r.path);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(r);
  }

  // Sort groups by path so parents render above children. Root ("/")
  // first, then alphabetical.
  const dirs = Array.from(groups.keys()).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

  return dirs
    .map((dir) => {
      const groupRows = groups.get(dir);

      // A directory "exists in the workspace" if any row inside it
      // (or any deeper row in `rows`) carries a workspace side. If
      // every row at-or-below this directory is orphan-only, the
      // folder is missing locally and we offer a bulk pull.
      const prefix = dir === "/" ? "/" : dir + "/";
      const anyWorkspaceUnder = rows.some(
        (r) => r.workspace && (r.path === dir || r.path.startsWith(prefix)),
      );
      const orphansUnder = rows.filter(
        (r) =>
          r.status === "orphan" &&
          (r.path === dir || r.path.startsWith(prefix)),
      );
      const folderMissingLocally =
        !anyWorkspaceUnder && orphansUnder.length > 0;

      // Per-group counts for the header pill.
      const counts = groupRows.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        { synced: 0, modified: 0, "not-deployed": 0, orphan: 0 },
      );

      const headerPills = [];
      if (counts.modified)
        headerPills.push(
          `<span class="sync-group-pill sync-pill-mod">🟡 ${counts.modified}</span>`,
        );
      if (counts["not-deployed"])
        headerPills.push(
          `<span class="sync-group-pill sync-pill-new">🔵 ${counts["not-deployed"]}</span>`,
        );
      if (counts.orphan)
        headerPills.push(
          `<span class="sync-group-pill sync-pill-orphan">🔴 ${counts.orphan}</span>`,
        );
      if (counts.synced)
        headerPills.push(
          `<span class="sync-group-pill sync-pill-ok">✅ ${counts.synced}</span>`,
        );

      const headerActions = folderMissingLocally
        ? `<button class="sync-action" data-action="pull-folder" data-path="${escapeAttr(dir)}" title="Create ${escapeAttr(dir)}/ in the workspace and pull all ${orphansUnder.length} file(s)">← Pull folder</button>`
        : "";

      const headerNote = folderMissingLocally
        ? `<span class="sync-group-note" title="This folder does not exist in your workspace yet">📁 missing locally</span>`
        : "";

      const displayDir = dir === "/" ? "/ (root)" : dir;

      const rowsHtml = groupRows.map(renderRow).join("");

      return `
        <div class="sync-group" data-dir="${escapeAttr(dir)}">
          <div class="sync-group-header">
            <span class="sync-group-icon">📁</span>
            <span class="sync-group-dir" title="${escapeAttr(dir)}">${escapeHtml(displayDir)}</span>
            <span class="sync-group-counts">${headerPills.join(" ")}</span>
            ${headerNote}
            ${headerActions ? `<div class="sync-group-actions">${headerActions}</div>` : ""}
          </div>
          <div class="sync-group-rows">${rowsHtml}</div>
        </div>
      `;
    })
    .join("");
}

function renderRow(r) {
  const meta = STATUS_META[r.status];
  const size = r.workspace?.size ?? r.device?.size;
  // Prefer the device's mtime when present (it's what's actually on
  // the Pico right now); fall back to the workspace mtime for files
  // that haven't been deployed yet.
  const mtime = r.device?.mtime ?? r.workspace?.mtime;
  const mtimeHtml = formatMtime(mtime);
  const actions = [];
  if (r.status === "modified") {
    actions.push(actionBtn("diff", r.path, "Diff"));
    actions.push(actionBtn("push", r.path, "Push →"));
    actions.push(actionBtn("pull", r.path, "← Pull"));
  } else if (r.status === "not-deployed") {
    actions.push(actionBtn("push", r.path, "Push →"));
  } else if (r.status === "orphan") {
    actions.push(actionBtn("pull", r.path, "← Pull"));
    actions.push(actionBtn("delete", r.path, "Delete", "btn-danger"));
  }
  // 'synced' rows intentionally have no buttons — there's no diff.
  const fileName = basenamePico(r.path);
  return `
    <div class="sync-row ${meta.cls}" data-path="${escapeAttr(r.path)}">
      <div class="sync-path-line">
        <span class="sync-status" title="${meta.label}">${meta.icon}</span>
        <span class="sync-path" title="${escapeAttr(r.path)}">${escapeHtml(fileName)}</span>
        <span class="sync-size">${formatBytes(size)}</span>
      </div>
      ${mtimeHtml ? `<div class="sync-meta-line">${mtimeHtml}</div>` : ""}
      ${actions.length ? `<div class="sync-actions">${actions.join("")}</div>` : ""}
    </div>
  `;
}

function dirnamePico(p) {
  if (!p || p === "/") return "/";
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return "/";
  return p.slice(0, idx);
}

function basenamePico(p) {
  if (!p) return "";
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function actionBtn(action, path, label, extra = "") {
  return `<button class="sync-action ${extra}" data-action="${action}" data-path="${escapeAttr(path)}">${label}</button>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function actionPush(picoPath) {
  // Reuse the existing single-file upload path so we get the same
  // marker-based completion + verify behaviour as the toolbar Upload.
  const { uploadFileByPicoPath } = await import("./picoSync.js");
  if (typeof uploadFileByPicoPath === "function") {
    await uploadFileByPicoPath(picoPath);
  } else {
    // Fallback: write directly using fetch + raw REPL.
    const content = await fetchWorkspaceFileContent(picoPath);
    await writeFileToDevice(picoPath, content);
  }
}

/**
 * Minimal device-write fallback (used when picoSync doesn't expose a
 * path-keyed upload). We keep it small — it doesn't do batching or
 * critical-last ordering, because Sync Status pushes one file at a time.
 */
async function writeFileToDevice(picoPath, content) {
  const escaped = picoPath.replace(/'/g, "\\'");
  const dir = picoPath.substring(0, picoPath.lastIndexOf("/"));
  const ensureDir =
    dir && dir !== ""
      ? `
import os
_parts = '${dir}'.strip('/').split('/')
_p = ''
for _x in _parts:
    if not _x: continue
    _p += '/' + _x
    try: os.mkdir(_p)
    except OSError: pass
`
      : "";
  const b64 = btoa(unescape(encodeURIComponent(content)));
  const marker = newMarker("PUSH");
  const py = `${ensureDir}
import ubinascii
_f = open('${escaped}', 'w')
_f.write(ubinascii.a2b_base64('${b64}').decode())
_f.close()
print('${marker}')
`;
  const r = await sendRawCommandUntilMarker(py, marker);
  if (!r.found) throw new Error("Push marker did not arrive");
}

async function actionPull(picoPath) {
  const content = await readDeviceFile(picoPath);
  await writeWorkspaceFileContent(picoPath, content);
  termWrite(`[Sync] ✓ Pulled ${picoPath} → workspace\r\n`);
}

/**
 * Pull every orphan file under `dir` (and any nested subdirectories)
 * into the workspace. Each `writeWorkspaceFile` call already creates
 * the parent directories via `fs.mkdirSync({recursive:true})`, so the
 * folder structure materialises as a side effect of writing the files.
 */
async function actionPullFolder(dir) {
  if (!cachedStatus) throw new Error("Run a sync refresh first");
  const prefix = dir === "/" ? "/" : dir + "/";
  const targets = cachedStatus.rows.filter(
    (r) =>
      r.status === "orphan" && (r.path === dir || r.path.startsWith(prefix)),
  );
  if (targets.length === 0) {
    termWrite(`[Sync] No orphan files under ${dir} to pull\r\n`);
    return;
  }
  termWrite(`[Sync] Pulling ${targets.length} file(s) from ${dir}…\r\n`);
  let ok = 0;
  let failed = 0;
  for (const r of targets) {
    try {
      // Sequential on purpose: the raw REPL is single-threaded and
      // overlapping reads will corrupt each other's marker capture.
      const content = await readDeviceFile(r.path);
      await writeWorkspaceFileContent(r.path, content);
      ok += 1;
    } catch (err) {
      failed += 1;
      termWrite(`[Sync]   ✗ ${r.path}: ${err.message}\r\n`);
    }
  }
  termWrite(
    `[Sync] ✓ Pulled ${ok}/${targets.length} file(s) from ${dir}${failed ? ` (${failed} failed)` : ""}\r\n`,
  );
}

async function actionDelete(picoPath) {
  if (!confirm(`Delete ${picoPath} from the Pico?\n\nThis cannot be undone.`)) {
    return;
  }
  await deleteDeviceFile(picoPath);
  termWrite(`[Sync] ✓ Deleted ${picoPath} from device\r\n`);
}

async function actionDiff(picoPath) {
  const [wsContent, devContent] = await Promise.all([
    fetchWorkspaceFileContent(picoPath).catch(() => ""),
    readDeviceFile(picoPath).catch((err) => `<!-- ${err.message} -->`),
  ]);
  showDiffModal(picoPath, wsContent, devContent);
}

function showDiffModal(picoPath, workspaceContent, deviceContent) {
  const modal = document.getElementById("syncDiffModal");
  const title = document.getElementById("syncDiffTitle");
  const body = document.getElementById("syncDiffBody");
  if (!modal || !title || !body) return;

  title.textContent = `Diff: ${picoPath}`;
  const ops = diffLines(deviceContent, workspaceContent);
  body.innerHTML = `
    <div class="sync-diff-legend">
      <span class="diff-key diff-del">−</span> on device only &nbsp;
      <span class="diff-key diff-add">+</span> in workspace only
    </div>
    <pre class="sync-diff-pre">${renderDiffHtml(ops)}</pre>
  `;
  modal.style.display = "flex";
  trapFocus(modal, hideDiffModal);
}

function hideDiffModal() {
  const modal = document.getElementById("syncDiffModal");
  if (modal) {
    modal.style.display = "none";
    releaseFocus(modal);
  }
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Reflect the in-flight state into the side panel header so users get
 * visible feedback without us spamming the terminal on auto-refresh.
 */
function setRefreshingUI(refreshing) {
  const btn = document.getElementById("syncRefreshBtn");
  const title = document.querySelector("#device-files-panel .side-panel-title");
  if (btn) {
    btn.disabled = refreshing;
    btn.classList.toggle("is-spinning", refreshing);
  }
  if (title) {
    title.textContent = refreshing
      ? "📟 Device Files — syncing…"
      : "📟 Device Files";
  }
}

/**
 * Compare workspace ↔ device and update the panel.
 *
 * @param {{silent?: boolean}} [opts]
 *   silent=true suppresses informational "[Sync] …" lines in the
 *   terminal (errors are still surfaced). Used for auto-refresh on
 *   connect / after file actions so the terminal stays clean.
 */
export async function refreshSyncStatus(opts = {}) {
  const { silent = false } = opts;
  if (isRefreshing) return;
  if (!store.isConnected()) {
    if (!silent) termWrite("[Sync] Connect to the Pico first\r\n");
    return;
  }
  isRefreshing = true;
  setRefreshingUI(true);

  try {
    if (!silent) termWrite("[Sync] Comparing workspace ↔ device…\r\n");
    const [workspace, deviceFiles] = await Promise.all([
      fetchWorkspaceSnapshot(),
      listDeviceFilesWithHash(),
    ]);
    const { rows, summary } = classify(workspace.files, deviceFiles);
    cachedStatus = {
      rows,
      summary,
      projectRoot: workspace.projectRoot,
      projectDetected: workspace.projectDetected,
      hasLib: Boolean(workspace.hasLib),
    };
    renderStatusPanel();
    // Let the toolbar disable buttons that need a lib/ folder when
    // there isn't one (instead of letting the user click and error).
    try {
      const { updateToolButtons } = await import("../ui/status.js");
      updateToolButtons(store.isConnected());
    } catch {
      /* status module optional */
    }
    if (!silent) {
      termWrite(
        `[Sync] ${summary.synced} synced · ${summary.modified} modified · ${summary.notDeployed} to deploy · ${summary.orphan} stale\r\n`,
      );
    }
  } catch (err) {
    termWrite(`[Sync] Error: ${err.message}\r\n`);
  } finally {
    isRefreshing = false;
    setRefreshingUI(false);
  }
}

/**
 * Debounced auto-refresh. Coalesces bursts of file-mutating actions
 * (e.g. an Upload-All that pushes 30 files) into a single device walk.
 *
 * @param {{silent?: boolean, delay?: number}} [opts]
 */
let scheduledTimer = null;
export function scheduleSyncRefresh(opts = {}) {
  const { silent = true, delay = 600 } = opts;
  if (!store.isConnected()) return;
  if (scheduledTimer) clearTimeout(scheduledTimer);
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null;
    refreshSyncStatus({ silent }).catch(() => {
      /* errors already surfaced */
    });
  }, delay);
}

export function openSyncPanel() {
  // Back-compat shim: prior versions opened a modal here. The Sync UI
  // now lives in the Device Files side panel and re-renders on demand.
  renderStatusPanel();
}

/**
 * Whether the last sync detected a top-level `lib/` folder in the
 * workspace project. `null` means "we haven't checked yet" — callers
 * should treat that as "don't disable" so the UI doesn't lock buttons
 * on initial page load before the first refresh.
 *
 * @returns {boolean|null}
 */
export function hasLibFolder() {
  if (!cachedStatus) return null;
  return Boolean(cachedStatus.hasLib);
}

/**
 * Wire up all DOM event listeners. Called once from main.js.
 */
export function initSyncStatus() {
  const refresh = document.getElementById("syncRefreshBtn");
  if (refresh) refresh.addEventListener("click", () => refreshSyncStatus());

  // Event delegation for per-row action buttons.
  const body = document.getElementById("syncBody");
  if (body) {
    body.addEventListener("click", async (evt) => {
      const btn = evt.target.closest(".sync-action");
      if (!btn) return;
      const action = btn.dataset.action;
      const path = btn.dataset.path;
      btn.disabled = true;
      try {
        if (action === "push") await actionPush(path);
        else if (action === "pull") await actionPull(path);
        else if (action === "delete") await actionDelete(path);
        else if (action === "pull-folder") await actionPullFolder(path);
        else if (action === "diff") {
          await actionDiff(path);
          return; // diff doesn't change state — no refresh
        }
        await refreshSyncStatus();
      } catch (err) {
        termWrite(`[Sync] ${action} failed: ${err.message}\r\n`);
      } finally {
        btn.disabled = false;
      }
    });
  }

  const diffClose = document.getElementById("syncDiffCloseBtn");
  if (diffClose) diffClose.addEventListener("click", hideDiffModal);

  // ESC closes the diff modal when it's open.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const diff = document.getElementById("syncDiffModal");
    if (diff && diff.style.display === "flex") {
      hideDiffModal();
    }
  });
}
