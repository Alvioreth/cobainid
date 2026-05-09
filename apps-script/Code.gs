const SHEET_NAME = 'Pendaftar';
const HOST_CODE = 'COBAINHOST';
const DRIVE_FOLDER_NAME = 'Bukti Pembayaran COBAIN.ID';
const DRIVE_FOLDER_ID = 'https://drive.google.com/drive/folders/1AqPXd5PDKzD0EJEU98gJWVPTmF29q3KI?hl=ID';
const SHARE_PROOF_FILE = true; // true = file Drive dapat dibuka lewat link oleh host dashboard.
const HEADERS = [
  'id', 'createdAt', 'name', 'email', 'phone', 'school', 'grade', 'campus',
  'program', 'note', 'proofFileName', 'proofFileUrl', 'proofFileId'
];

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
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

function getProofFolder_() {
  if (DRIVE_FOLDER_ID) return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function sanitizeFileName_(value) {
  return String(value || 'bukti-pembayaran')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function uploadProofToDrive_(params) {
  const base64 = params.proofBase64 || '';
  if (!base64) return { proofFileName: '', proofFileUrl: '', proofFileId: '' };

  const folder = getProofFolder_();
  const safeName = sanitizeFileName_(params.name || 'peserta');
  const originalName = sanitizeFileName_(params.proofFileName || 'bukti-pembayaran');
  const mimeType = params.proofMimeType || 'application/octet-stream';
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const fileName = `${timestamp} - ${safeName} - ${originalName}`;
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
  const file = folder.createFile(blob);

  if (SHARE_PROOF_FILE) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return {
    proofFileName: fileName,
    proofFileUrl: file.getUrl(),
    proofFileId: file.getId()
  };
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

function appendStudent_(params) {
  const sheet = getSheet_();
  const id = params.id || Utilities.getUuid();
  const createdAt = params.createdAt || new Date().toISOString();
  const proof = uploadProofToDrive_(params);

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
    proof.proofFileName || params.proofFileName || '',
    proof.proofFileUrl || '',
    proof.proofFileId || ''
  ];
  sheet.appendRow(row);
  return rowToObject_(row);
}

function deleteStudent_(id) {
  if (!id) return false;
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(value => String(value) === String(id));
  if (index === -1) return false;

  // File bukti di Drive tidak otomatis dihapus agar arsip pembayaran tetap aman.
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
  const params = e.parameter || {};
  const callback = params.callback || '';

  try {
    if ((params.action || 'list') === 'list') {
      if (params.hostCode !== HOST_CODE) {
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
  const params = e.parameter || {};
  const action = params.action || 'create';

  try {
    if (action === 'create') {
      const student = appendStudent_(params);
      return jsonOutput_({ ok: true, student });
    }

    if (params.hostCode !== HOST_CODE) {
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
