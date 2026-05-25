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
  const py = `
import os, uhashlib, ubinascii, json
def _walk(p, out):
    try:
        items = os.listdir(p)
    except:
        return
    for n in items:
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
                    chunk = f.read(1024)
                    if not chunk:
                        break
                    h.update(chunk)
                f.close()
                out.append({'path': fp, 'size': st[6],
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

  body.innerHTML = rows
    .map((r) => {
      const meta = STATUS_META[r.status];
      const size = r.workspace?.size ?? r.device?.size;
      const actions = [];
      if (r.status === "modified") {
        actions.push(actionBtn("diff", r.path, "View Diff"));
        actions.push(actionBtn("push", r.path, "Push →"));
        actions.push(actionBtn("pull", r.path, "← Pull"));
      } else if (r.status === "not-deployed") {
        actions.push(actionBtn("push", r.path, "Push →"));
      } else if (r.status === "orphan") {
        actions.push(actionBtn("pull", r.path, "← Pull"));
        actions.push(actionBtn("delete", r.path, "Delete", "btn-danger"));
      }
      return `
        <div class="sync-row ${meta.cls}" data-path="${escapeAttr(r.path)}">
          <span class="sync-status" title="${meta.label}">${meta.icon}</span>
          <span class="sync-path">${escapeHtml(r.path)}</span>
          <span class="sync-size">${formatBytes(size)}</span>
          <span class="sync-actions">${actions.join("")}</span>
        </div>
      `;
    })
    .join("");
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
// Bulk operations
// ---------------------------------------------------------------------------

async function pushAll() {
  if (!cachedStatus) return;
  const toPush = cachedStatus.rows.filter(
    (r) => r.status === "not-deployed" || r.status === "modified",
  );
  if (toPush.length === 0) {
    termWrite("[Sync] Nothing to push — workspace and device match\r\n");
    return;
  }
  if (
    !confirm(
      `Push ${toPush.length} file(s) to the Pico?\n\n` +
        toPush
          .slice(0, 10)
          .map((r) => `  ${r.path}`)
          .join("\n") +
        (toPush.length > 10 ? `\n  …+${toPush.length - 10} more` : ""),
    )
  ) {
    return;
  }
  termWrite(`[Sync] Pushing ${toPush.length} file(s)...\r\n`);
  for (const r of toPush) {
    try {
      const content = await fetchWorkspaceFileContent(r.path);
      await writeFileToDevice(r.path, content);
      termWrite(`[Sync] ✓ ${r.path}\r\n`);
    } catch (err) {
      termWrite(`[Sync] ✗ ${r.path}: ${err.message}\r\n`);
    }
  }
  await refreshSyncStatus();
}

async function pullAll() {
  if (!cachedStatus) return;
  const toPull = cachedStatus.rows.filter(
    (r) => r.status === "modified" || r.status === "orphan",
  );
  if (toPull.length === 0) {
    termWrite("[Sync] Nothing to pull — workspace is already up to date\r\n");
    return;
  }

  if (
    !confirm(
      `Pull ${toPull.length} file(s) from device to workspace?\n\n` +
        `This will overwrite workspace versions for modified files.\n\n` +
        toPull
          .slice(0, 10)
          .map((r) => `  ${r.path}`)
          .join("\n") +
        (toPull.length > 10 ? `\n  …+${toPull.length - 10} more` : ""),
    )
  ) {
    return;
  }

  termWrite(`[Sync] Pulling ${toPull.length} file(s) from device...\r\n`);
  for (const r of toPull) {
    try {
      const content = await readDeviceFile(r.path);
      await writeWorkspaceFileContent(r.path, content);
      termWrite(`[Sync] ✓ pull ${r.path}\r\n`);
    } catch (err) {
      termWrite(`[Sync] ✗ pull ${r.path}: ${err.message}\r\n`);
    }
  }
  await refreshSyncStatus();
}

async function mirrorAll() {
  if (!cachedStatus) return;
  const toPush = cachedStatus.rows.filter(
    (r) => r.status === "not-deployed" || r.status === "modified",
  );
  const toDelete = cachedStatus.rows.filter((r) => r.status === "orphan");
  if (toPush.length === 0 && toDelete.length === 0) {
    termWrite("[Sync] Already mirrored — nothing to do\r\n");
    return;
  }
  if (
    !confirm(
      `Mirror workspace → Pico?\n\n` +
        `Push: ${toPush.length} file(s)\n` +
        `Delete from Pico: ${toDelete.length} file(s)\n\n` +
        `This will make the Pico match the workspace exactly.`,
    )
  ) {
    return;
  }
  termWrite(
    `[Sync] Mirror: push ${toPush.length}, delete ${toDelete.length}\r\n`,
  );
  for (const r of toPush) {
    try {
      const content = await fetchWorkspaceFileContent(r.path);
      await writeFileToDevice(r.path, content);
      termWrite(`[Sync] ✓ push ${r.path}\r\n`);
    } catch (err) {
      termWrite(`[Sync] ✗ push ${r.path}: ${err.message}\r\n`);
    }
  }
  for (const r of toDelete) {
    try {
      await deleteDeviceFile(r.path);
      termWrite(`[Sync] ✓ delete ${r.path}\r\n`);
    } catch (err) {
      termWrite(`[Sync] ✗ delete ${r.path}: ${err.message}\r\n`);
    }
  }
  await refreshSyncStatus();
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export async function refreshSyncStatus() {
  if (isRefreshing) return;
  if (!store.isConnected()) {
    termWrite("[Sync] Connect to the Pico first\r\n");
    return;
  }
  isRefreshing = true;
  const refreshBtn = document.getElementById("syncRefreshBtn");
  if (refreshBtn) refreshBtn.disabled = true;

  try {
    termWrite("[Sync] Comparing workspace ↔ device...\r\n");
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
    };
    renderStatusPanel();
    termWrite(
      `[Sync] ${summary.synced} synced · ${summary.modified} modified · ${summary.notDeployed} to deploy · ${summary.orphan} stale\r\n`,
    );
  } catch (err) {
    termWrite(`[Sync] Error: ${err.message}\r\n`);
  } finally {
    isRefreshing = false;
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

export function openSyncPanel() {
  // Back-compat shim: prior versions exposed openSyncPanel() to open a
  // modal. The Sync UI is now the Files tab. Re-render in case the
  // caller wanted to ensure the panel content is fresh.
  renderStatusPanel();
}

/**
 * Wire up all DOM event listeners. Called once from main.js.
 */
export function initSyncStatus() {
  const refresh = document.getElementById("syncRefreshBtn");
  if (refresh) refresh.addEventListener("click", refreshSyncStatus);

  const pullAllBtn = document.getElementById("syncPullAllBtn");
  if (pullAllBtn) pullAllBtn.addEventListener("click", pullAll);

  const pushAllBtn = document.getElementById("syncPushAllBtn");
  if (pushAllBtn) pushAllBtn.addEventListener("click", pushAll);

  const mirrorBtn = document.getElementById("syncMirrorBtn");
  if (mirrorBtn) mirrorBtn.addEventListener("click", mirrorAll);

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
