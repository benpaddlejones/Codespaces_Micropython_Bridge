/**
 * Pico Sync Module
 * Handles file operations on the Pico (list, upload, delete).
 */

import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";
import { sendRawCommand, ensureDirectory } from "../serial/rawRepl.js";
import { sleep } from "../serial/connection.js";
import { getFileContent, getLibFiles, getProjectFiles } from "./fileManager.js";

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
            size = os.stat(fp)[6]
            print(indent + f + ' (' + str(size) + 'b)')
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

  termWrite(`\r\n[Bridge] Uploading ${filePath}...\r\n`);

  try {
    const data = await getFileContent(filePath);
    if (!data) return;

    // Use destPath from server (preserves folder structure)
    const destPath = data.destPath || "/" + data.filename;

    // Extract directory from path and ensure it exists
    const dirPath = destPath.substring(0, destPath.lastIndexOf("/"));
    if (dirPath && dirPath !== "/") {
      await ensureDirectory(dirPath);
    }

    // Upload using base64 to handle special chars
    const b64 = btoa(unescape(encodeURIComponent(data.content)));

    const writeCode = `import ubinascii
f = open('${destPath}', 'w')
f.write(ubinascii.a2b_base64('${b64}').decode())
f.close()
print('Saved: ${destPath}')
`;

    await sendRawCommand(writeCode);
    termWrite(`[Bridge] ✓ Uploaded: ${destPath}\r\n`);
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
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

  termWrite("\r\n[Bridge] Uploading lib folder...\r\n");

  try {
    const files = await getLibFiles();
    if (!files) return;

    // Enable silent mode to suppress raw REPL output
    store.setSilentMode(true);

    // Create lib directory first
    await sendRawCommand(
      `import os
try:
    os.mkdir('/lib')
except:
    pass
`,
      200
    );

    // Calculate base64 size for each file and sort by size
    const filesWithSize = files
      .map((file) => {
        const b64 = btoa(unescape(encodeURIComponent(file.content)));
        return {
          name: file.name,
          path: `/lib/${file.name}`,
          b64,
          b64Size: b64.length,
        };
      })
      .sort((a, b) => a.b64Size - b.b64Size);

    // Smart batching: group files up to ~4KB batch size
    const MAX_BATCH_SIZE = 4000;
    const batches = createBatches(filesWithSize, MAX_BATCH_SIZE);

    // Upload each batch silently
    let uploadedCount = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchCode = createBatchUploadCode(batch);
      const waitTime = 200 + batch.length * 100;
      await sendRawCommand(batchCode, waitTime);
      uploadedCount += batch.length;
    }

    // Disable silent mode
    store.setSilentMode(false);

    termWrite(
      `[Bridge] ✓ Uploaded ${uploadedCount} lib files (${batches.length} batches)\r\n`
    );
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

  termWrite("\r\n[Bridge] Uploading project...\r\n");
  store.setSilentMode(true);

  try {
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

    // Calculate base64 size for each file and sort by size
    const filesWithSize = files
      .map((file) => {
        const b64 = btoa(unescape(encodeURIComponent(file.content)));
        return { ...file, b64, b64Size: b64.length };
      })
      .sort((a, b) => a.b64Size - b.b64Size);

    // Smart batching
    const MAX_BATCH_SIZE = 4000;
    const batches = createBatches(filesWithSize, MAX_BATCH_SIZE);

    termWrite(`  Uploading in ${batches.length} batch(es)...\r\n`);

    // Upload each batch
    let uploadedCount = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (batch.length === 1 && batch[0].b64Size > MAX_BATCH_SIZE) {
        termWrite(
          `  [${i + 1}/${batches.length}] ${batch[0].path} (${Math.round(
            batch[0].b64Size / 1024
          )}KB)\r\n`
        );
      } else {
        termWrite(
          `  [${i + 1}/${batches.length}] ${batch.length} file(s): ${batch
            .map((f) => f.path)
            .join(", ")}\r\n`
        );
      }

      const batchCode = createBatchUploadCode(batch);
      const batchSize = batch.reduce((sum, f) => sum + f.b64Size, 0);
      const waitTime = 200 + batch.length * 100 + Math.round(batchSize / 100);
      await sendRawCommand(batchCode, waitTime);

      uploadedCount += batch.length;
    }

    store.setSilentMode(false);
    termWrite(
      `[Bridge] ✓ Uploaded ${uploadedCount} files in ${batches.length} batch(es)\r\n`
    );
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
      "⚠️ WARNING: This will DELETE ALL files on the Pico!\n\nAre you sure?"
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
 * Create batch upload code for multiple files
 */
function createBatchUploadCode(batch) {
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
  return code;
}
