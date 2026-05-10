/* ============================================================
   GOOGLE APPS SCRIPT UNTUK COBAIN.ID — FIXED VERSION

   Fungsi:
   - Menerima data pendaftaran peserta dari GitHub Pages.
   - Menyimpan data ke Google Sheets.
   - Menyimpan bukti pembayaran ke Google Drive.
   - Menyimpan bukti follow dan share ke Google Drive.
   - Menyediakan data untuk dashboard host.

   PENTING:
   - File ini ditempel di Google Sheets > Extensions > Apps Script.
   - Jangan ditempel di GitHub sebagai script.js.
   - Setelah edit, wajib Deploy > Manage deployments > Edit > New version > Deploy.
   ============================================================ */

const SHEET_NAME = 'Pendaftar';
const HOST_CODE = 'COBAINHOST';

const DRIVE_FOLDER_NAME = 'Bukti Pendaftaran COBAIN.ID';
const DRIVE_FOLDER_ID = '1LMGA9lUUcXFjJj0LIDwwUYSQ83ASGPKx'; // ID folder Drive saja, bukan link lengkap.
const SHARE_PROOF_FILE = true;

const HEADERS = [
  'id', 'createdAt', 'name', 'email', 'phone', 'school', 'grade', 'campus',
  'program', 'note',
  'paymentProofName', 'paymentProofUrl', 'paymentProofFileId',
  'followShareProofName', 'followShareProofUrl', 'followShareProofFileId'
];

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Spreadsheet tidak ditemukan. Pastikan script ini dibuat dari Google Sheets: Extensions > Apps Script.');

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headerMissing = HEADERS.some((header, index) => firstRow[index] !== header);

  if (headerMissing) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function jsonOutput_(payload, callback) {
  const safeCallback = String(callback || '').replace(/[^a-zA-Z0-9_.$]/g, '');
  const content = safeCallback
    ? `${safeCallback}(${JSON.stringify(payload)});`
    : JSON.stringify(payload);
  const mimeType = safeCallback
    ? ContentService.MimeType.JAVASCRIPT
    : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(content).setMimeType(mimeType);
}

function rowToObject_(row) {
  const object = {};
  HEADERS.forEach((header, index) => object[header] = row[index] || '');
  return object;
}

function listStudents_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows.map(rowToObject_).filter(item => item.id);
}

function getOrCreateProofFolder_() {
  const folderId = String(DRIVE_FOLDER_ID || '').trim();

  if (folderId) {
    return DriveApp.getFolderById(folderId);
  }

  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function saveProofFile_(params, id, options) {
  const dataUrl = params[options.base64Field] || '';

  if (!dataUrl) {
    return {
      name: params[options.nameField] || '',
      url: '',
      fileId: ''
    };
  }

  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = params[options.typeField] || (match ? match[1] : 'application/octet-stream');
  const base64Data = match ? match[2] : String(dataUrl);
  const originalName = params[options.nameField] || options.defaultName || 'bukti';
  const safeName = String(originalName).replace(/[^a-zA-Z0-9._-]/g, '-');
  const fileName = `${id}-${options.prefix}-${safeName}`;

  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const folder = getOrCreateProofFolder_();
  const file = folder.createFile(blob);

  if (SHARE_PROOF_FILE) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return {
    name: originalName,
    url: file.getUrl(),
    fileId: file.getId()
  };
}

function appendStudent_(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getSheet_();
    const id = params.id || Utilities.getUuid();
    const createdAt = params.createdAt || new Date().toISOString();

    const paymentProof = saveProofFile_(params, id, {
      base64Field: 'paymentProofBase64',
      nameField: 'paymentProofName',
      typeField: 'paymentProofType',
      prefix: 'bukti-pembayaran',
      defaultName: 'bukti-pembayaran'
    });

    const followShareProof = saveProofFile_(params, id, {
      base64Field: 'followShareProofBase64',
      nameField: 'followShareProofName',
      typeField: 'followShareProofType',
      prefix: 'bukti-follow-share',
      defaultName: 'bukti-follow-share'
    });

    const row = [
      id,
      createdAt,
      params.name || '',
      params.email || '',
      params.phone || '',
      params.school || '',
      params.grade || '',
      params.campus || '',
      params.program || '',
      params.note || '',
      paymentProof.name || '',
      paymentProof.url || '',
      paymentProof.fileId || '',
      followShareProof.name || '',
      followShareProof.url || '',
      followShareProof.fileId || ''
    ];

    sheet.appendRow(row);
    return rowToObject_(row);
  } finally {
    lock.releaseLock();
  }
}

function deleteStudent_(id) {
  if (!id) return false;

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(value => String(value) === String(id));
  if (index === -1) return false;

  sheet.deleteRow(index + 2);
  return true;
}

function clearStudents_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  return true;
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const callback = params.callback || '';
  const action = params.action || 'list';
  const hostCode = String(params.hostCode || '').trim();

  try {
    if (action === 'ping') {
      return jsonOutput_({ ok: true, message: 'COBAIN.ID Apps Script aktif.' }, callback);
    }

    if (action === 'list') {
      if (hostCode !== HOST_CODE) {
        return jsonOutput_({ ok: false, error: 'Kode host salah.' }, callback);
      }

      return jsonOutput_({ ok: true, students: listStudents_() }, callback);
    }

    return jsonOutput_({ ok: false, error: 'Action GET tidak dikenali.' }, callback);
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message }, callback);
  }
}

function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'create';
  const hostCode = String(params.hostCode || '').trim();

  try {
    if (action === 'create') {
      const student = appendStudent_(params);
      return jsonOutput_({ ok: true, student });
    }

    if (hostCode !== HOST_CODE) {
      return jsonOutput_({ ok: false, error: 'Kode host salah.' });
    }

    if (action === 'delete') {
      return jsonOutput_({ ok: true, deleted: deleteStudent_(params.id) });
    }

    if (action === 'clear') {
      return jsonOutput_({ ok: true, cleared: clearStudents_() });
    }

    return jsonOutput_({ ok: false, error: 'Action POST tidak dikenali.' });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}
