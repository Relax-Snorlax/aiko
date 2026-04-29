// ============================================
// Ren & Aiko Dashboard — Apps Script Backend
// Deploy: Extensions > Apps Script from the Google Sheet
// ============================================

// Replace with your Google Drive folder ID for image uploads
var DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

var EDITABLE_SHEETS = {
  'Posts':    ['author', 'title', 'body', 'image_url', 'type'],
  'Chats':    ['author', 'chat_text', 'image_urls', 'chat_when', 'notes'],
  'Timeline': ['date', 'title', 'description'],
  'Feedback': ['hearts', 'comment']
};

// Returns the sheet by name. Creates it (with the given header row) if missing.
// Uses script lock so two simultaneous callers can't both create the same sheet.
function ensureSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    return sheet;
  } finally {
    lock.releaseLock();
  }
}

var POINTS_HEADERS = ['id', 'date', 'user', 'action_type', 'source_id', 'amount'];
var FEEDBACK_HEADERS = ['id', 'date', 'author', 'target', 'hearts', 'comment'];
var COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
var POINTS_PER_ACTION = 5;
var VALID_USERS = ['Brian', 'Linh'];

function isValidUser(u) {
  return VALID_USERS.indexOf(u) >= 0;
}

function awardPointsIfEligible(user, action_type, source_id) {
  if (!isValidUser(user)) return null;

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sheet = ensureSheet('Points', POINTS_HEADERS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var userCol = headers.indexOf('user');
    var actionCol = headers.indexOf('action_type');
    var dateCol = headers.indexOf('date');

    var now = Date.now();
    var mostRecent = 0;
    for (var r = 1; r < data.length; r++) {
      if (data[r][userCol] === user && data[r][actionCol] === action_type) {
        var ts = new Date(data[r][dateCol]).getTime();
        if (!isNaN(ts) && ts > mostRecent) mostRecent = ts;
      }
    }

    if (mostRecent && (now - mostRecent) < COOLDOWN_MS) {
      return null; // on cooldown
    }

    var id = Utilities.getUuid();
    var dateIso = new Date().toISOString();
    sheet.appendRow([id, dateIso, user, action_type, source_id || '', POINTS_PER_ACTION]);
    return { amount: POINTS_PER_ACTION, awarded: true };
  } finally {
    lock.releaseLock();
  }
}

// --- Entry Points ---

function doGet(e) {
  var action = e.parameter.action;
  try {
    switch (action) {
      case 'getPosts':      return respond(getPosts());
      case 'getTimeline':   return respond(getTimeline());
      case 'getCountdown':  return respond(getCountdown());
      case 'getChats':      return respond(getChats());
      case 'getFeedback':   return respond(getFeedback());
      case 'getStats':      return respond(getStats());
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
      case 'addFeedback':      result = addFeedback(e.parameter); break;
      case 'editEntry':        result = editEntry(e.parameter); break;
      case 'deleteEntry':      result = deleteEntry(e.parameter); break;
      case 'logLogin':         result = logLogin(e.parameter); break;
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

  var headers = ['id', 'date', 'title', 'description'];
  var startRow = (data[0][0] === 'id') ? 1 : 0;

  return data.slice(startRow).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : (row[i] || '');
    });
    return obj;
  });
}

function backfillTimelineIds() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  if (!sheet) return { error: 'Timeline tab not found' };
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return { filled: 0 };
  var startRow = (data[0][0] === 'id') ? 1 : 0;
  var filled = 0;
  for (var r = startRow; r < data.length; r++) {
    if (!data[r][0]) {
      sheet.getRange(r + 1, 1).setValue(Utilities.getUuid());
      filled++;
    }
  }
  return { filled: filled };
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

  var award = awardPointsIfEligible(params.user, 'post', id);
  return {
    success: true, id: id, date: date, image_url: imageUrl,
    points_awarded: award ? award.amount : 0
  };
}

function addTimeline(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Timeline');
  var id = Utilities.getUuid();
  sheet.appendRow([id, params.date, params.title, params.description || '']);
  var award = awardPointsIfEligible(params.user, 'timeline', id);
  return { success: true, id: id, points_awarded: award ? award.amount : 0 };
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
  var award = awardPointsIfEligible(params.user, 'chat', id);
  return {
    success: true, id: id, saved_date: savedDate, image_urls: imageUrls,
    points_awarded: award ? award.amount : 0
  };
}

function addFeedback(params) {
  var user = params.user;
  if (!isValidUser(user)) return { error: 'Unknown user' };

  var hearts = parseInt(params.hearts, 10);
  if (isNaN(hearts) || hearts < 0 || hearts > 5) {
    return { error: 'Hearts must be 0-5' };
  }
  var comment = params.comment || '';
  var target = (user === 'Brian') ? 'Linh' : 'Brian';

  var sheet = ensureSheet('Feedback', FEEDBACK_HEADERS);
  var id = Utilities.getUuid();
  var date = new Date().toISOString();
  sheet.appendRow([id, date, user, target, hearts, comment]);

  var award = awardPointsIfEligible(user, 'feedback', id);
  return {
    success: true, id: id, date: date, target: target,
    points_awarded: award ? award.amount : 0
  };
}

function getFeedback() {
  var sheet = ensureSheet('Feedback', FEEDBACK_HEADERS);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return obj;
  });
}

function getStats() {
  var pointsSheet = ensureSheet('Points', POINTS_HEADERS);
  var feedbackSheet = ensureSheet('Feedback', FEEDBACK_HEADERS);

  var stats = {};
  VALID_USERS.forEach(function (u) {
    stats[u] = { points: 0, avg_hearts: 0, count: 0 };
  });

  // Sum points
  var pData = pointsSheet.getDataRange().getValues();
  if (pData.length > 1) {
    var pHeaders = pData[0];
    var uCol = pHeaders.indexOf('user');
    var aCol = pHeaders.indexOf('amount');
    for (var r = 1; r < pData.length; r++) {
      var u = pData[r][uCol];
      var amt = parseInt(pData[r][aCol], 10) || 0;
      if (stats[u]) stats[u].points += amt;
    }
  }

  // Average hearts (by target)
  var fData = feedbackSheet.getDataRange().getValues();
  if (fData.length > 1) {
    var fHeaders = fData[0];
    var tCol = fHeaders.indexOf('target');
    var hCol = fHeaders.indexOf('hearts');
    var totals = {};
    VALID_USERS.forEach(function (u) { totals[u] = { sum: 0, n: 0 }; });
    for (var r = 1; r < fData.length; r++) {
      var t = fData[r][tCol];
      var h = parseInt(fData[r][hCol], 10);
      if (totals[t] && !isNaN(h)) {
        totals[t].sum += h;
        totals[t].n += 1;
      }
    }
    VALID_USERS.forEach(function (u) {
      stats[u].count = totals[u].n;
      stats[u].avg_hearts = totals[u].n
        ? Math.round((totals[u].sum / totals[u].n) * 10) / 10
        : 0;
    });
  }

  return stats;
}

function editEntry(params) {
  var sheetName = params.sheet;
  var id = params.id;
  var allowed = EDITABLE_SHEETS[sheetName];
  if (!allowed) return { error: 'Unknown sheet: ' + sheetName };
  if (!id) return { error: 'Missing id' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + ' tab not found' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return { error: sheetName + ' sheet missing id column' };

  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) { rowIndex = r; break; }
  }
  if (rowIndex < 0) return { error: 'Entry not found' };

  // Fresh image uploads (Posts single, Chats multi).
  var newImageUrls = null;
  if (sheetName === 'Posts' && params.image && params.image.length > 0) {
    var mime = params.image_type || 'image/jpeg';
    newImageUrls = uploadImage(params.image, mime, id + '-edit-' + Date.now());
  }
  if (sheetName === 'Chats' && params.images && params.images.length > 0) {
    var images;
    try { images = JSON.parse(params.images); } catch (e) { return { error: 'Invalid images payload' }; }
    var urls = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img || !img.data) continue;
      var mime2 = img.type || 'image/jpeg';
      urls.push(uploadImage(img.data, mime2, id + '-edit-' + Date.now() + '-' + i));
    }
    var kept = params.image_urls ? String(params.image_urls).split(',').filter(Boolean) : [];
    newImageUrls = kept.concat(urls).join(',');
  }

  // Apply allowlist edits (only fields the client explicitly sent).
  allowed.forEach(function (field) {
    if (params[field] === undefined) return;
    var colIndex = headers.indexOf(field);
    if (colIndex < 0) return;
    sheet.getRange(rowIndex + 1, colIndex + 1).setValue(params[field]);
  });

  // Apply computed image URL AFTER allowlist so fresh uploads win.
  if (newImageUrls !== null) {
    var imgField = (sheetName === 'Posts') ? 'image_url' : 'image_urls';
    var imgCol = headers.indexOf(imgField);
    if (imgCol >= 0) sheet.getRange(rowIndex + 1, imgCol + 1).setValue(newImageUrls);
  }

  return { success: true, id: id };
}

function deleteEntry(params) {
  var sheetName = params.sheet;
  var id = params.id;
  if (!EDITABLE_SHEETS[sheetName]) return { error: 'Unknown sheet: ' + sheetName };
  if (!id) return { error: 'Missing id' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + ' tab not found' };

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol < 0) return { error: sheetName + ' sheet missing id column' };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      sheet.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { error: 'Entry not found' };
}

function logLogin(params) {
  var user = params.user || '';
  if (!user) return { error: 'Missing user' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
  if (!sheet) return { error: 'Log tab not found' };

  sheet.appendRow([
    new Date().toISOString(),
    user,
    params.ip || '',
    params.city || '',
    params.region || '',
    params.country || '',
    params.user_agent || ''
  ]);
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
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w2000';
}
