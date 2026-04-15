// ============================================
// Ren & Aiko Dashboard — Apps Script Backend
// Deploy: Extensions > Apps Script from the Google Sheet
// ============================================

// Replace with your Google Drive folder ID for image uploads
var DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

// --- Entry Points ---

function doGet(e) {
  var action = e.parameter.action;
  try {
    switch (action) {
      case 'getPosts':      return respond(getPosts());
      case 'getTimeline':   return respond(getTimeline());
      case 'getCountdown':  return respond(getCountdown());
      default:              return respond({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return respond({ error: err.toString() });
  }
}

function doPost(e) {
  var action = e.parameter.action;
  var result;
  try {
    switch (action) {
      case 'addPost':          result = addPost(e.parameter); break;
      case 'addTimeline':      result = addTimeline(e.parameter); break;
      case 'updateCountdown':  result = updateCountdown(e.parameter); break;
      default:                 result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  // Return HTML that posts result back to the parent window via postMessage
  var json = JSON.stringify(result);
  var safe = JSON.stringify(json);
  return HtmlService.createHtmlOutput(
    '<script>try{top.postMessage(' + safe + ',"*")}catch(e){try{parent.postMessage(' + safe + ',"*")}catch(e2){}}</script>'
  );
}

// --- Helpers ---

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return obj;
  });
}

// --- Read Operations ---

function getPosts() {
  return sheetToObjects('Posts');
}

function getTimeline() {
  return sheetToObjects('Timeline');
}

function getCountdown() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Countdown');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { label: '', target_date: '', tbd_message: 'Nothing set yet' };
  var headers = data[0];
  var obj = {};
  headers.forEach(function(h, i) {
    obj[h] = data[1][i] instanceof Date ? data[1][i].toISOString() : data[1][i];
  });
  return obj;
}

// --- Write Operations ---

function addPost(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Posts');
  var id = Utilities.getUuid();
  var date = new Date().toISOString();
  var imageUrl = '';

  if (params.image && params.image.length > 0) {
    var mimeType = params.image_type || 'image/jpeg';
    imageUrl = uploadImage(params.image, mimeType, id);
  }

  sheet.appendRow([
    id, date, params.author || '', params.title || '',
    params.body || '', imageUrl, params.type || 'post'
  ]);
  return { success: true, id: id, date: date, image_url: imageUrl };
}

function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  sheet.appendRow([params.date, params.title, params.description || '']);
  return { success: true };
}

function updateCountdown(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Countdown');
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([params.label, params.target_date || '', params.tbd_message || '']);
  } else {
    sheet.getRange(2, 1).setValue(params.label);
    sheet.getRange(2, 2).setValue(params.target_date || '');
    sheet.getRange(2, 3).setValue(params.tbd_message || '');
  }
  return { success: true };
}

// --- Image Upload ---

function uploadImage(base64Data, mimeType, filename) {
  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var decoded = Utilities.base64Decode(base64Data);
  var ext = mimeType.split('/')[1] || 'jpg';
  var blob = Utilities.newBlob(decoded, mimeType, filename + '.' + ext);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}
