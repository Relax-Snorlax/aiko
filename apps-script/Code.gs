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
      case 'getChats':      return respond(getChats());
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
      case 'addChat':          result = addChat(e.parameter); break;
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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  var headers = ['date', 'title', 'description'];
  var startRow = (data[0][0] === 'date') ? 1 : 0;

  return data.slice(startRow).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : (row[i] || '');
    });
    return obj;
  });
}

function getChats() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Chats');
  if (!sheet) return { error: 'Chats tab not found in sheet' };
  return sheetToObjects('Chats');
}

function getCountdown() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Countdown');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return { label: '', target_date: '', tbd_message: 'Nothing set yet' };

  // Find the data row — check if row 1 is headers or data
  var headers = ['label', 'target_date', 'tbd_message'];
  var dataRow;
  if (data[0][0] === 'label') {
    // Row 1 is headers, data is in row 2
    dataRow = data.length >= 2 ? data[1] : null;
  } else {
    // No headers — row 1 is the data
    dataRow = data[0];
  }

  if (!dataRow) return { label: '', target_date: '', tbd_message: 'Nothing set yet' };

  var obj = {};
  headers.forEach(function(h, i) {
    obj[h] = dataRow[i] instanceof Date ? dataRow[i].toISOString() : (dataRow[i] || '');
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
  var lastRow = sheet.getLastRow();

  // Ensure headers exist in row 1
  if (lastRow === 0) {
    sheet.appendRow(['label', 'target_date', 'tbd_message']);
    sheet.appendRow([params.label, params.target_date || '', params.tbd_message || '']);
  } else if (sheet.getRange(1, 1).getValue() !== 'label') {
    // Row 1 is data, not headers — insert headers above it
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1).setValue('label');
    sheet.getRange(1, 2).setValue('target_date');
    sheet.getRange(1, 3).setValue('tbd_message');
    // Now overwrite row 2 (the old data)
    sheet.getRange(2, 1).setValue(params.label);
    sheet.getRange(2, 2).setValue(params.target_date || '');
    sheet.getRange(2, 3).setValue(params.tbd_message || '');
  } else if (lastRow < 2) {
    // Headers exist but no data row
    sheet.appendRow([params.label, params.target_date || '', params.tbd_message || '']);
  } else {
    // Normal case: headers + data row exist
    sheet.getRange(2, 1).setValue(params.label);
    sheet.getRange(2, 2).setValue(params.target_date || '');
    sheet.getRange(2, 3).setValue(params.tbd_message || '');
  }
  return { success: true };
}

function addChat(params) {
  var author = params.author || '';
  var chatText = params.chat_text || '';
  var chatWhen = params.chat_when || '';
  var notes = params.notes || '';

  if (!author) {
    return { error: 'Author is required' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Chats');
  if (!sheet) {
    return { error: 'Chats tab not found in sheet' };
  }

  var id = Utilities.getUuid();
  var imageUrls = '';

  if (params.images && params.images.length > 0) {
    var images;
    try {
      images = JSON.parse(params.images);
    } catch (e) {
      return { error: 'Invalid images payload' };
    }
    if (!Array.isArray(images)) images = [];
    var urls = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img || !img.data) continue;
      var mime = img.type || 'image/jpeg';
      urls.push(uploadImage(img.data, mime, id + '-' + i));
    }
    imageUrls = urls.join(',');
  }

  if (!chatText && !imageUrls) {
    return { error: 'Provide chat text or at least one screenshot' };
  }

  var savedDate = new Date().toISOString();
  sheet.appendRow([id, savedDate, author, chatText, imageUrls, chatWhen, notes]);
  return { success: true, id: id, saved_date: savedDate, image_urls: imageUrls };
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
