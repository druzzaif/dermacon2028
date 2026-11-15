// ==========================================================================
// DERMACON International 2027 - Google Apps Script
//
// What this script does:
//   * doPost  : sends emails ONLY when the Next.js app asks (first email,
//               schedule update, reminder, coordinator report).
//   * onFormSubmit : when a faculty submits the Google Form it RECORDS the
//               result in the sheet and sends ONE thank-you email to that
//               faculty. It never emails coordinators or the committee.
//   * doGet   : the app reads confirmations (Sync button) and the number of
//               emails left today from here.
//
// One-time setup after pasting this code:  run authorizeAll(), then installTrigger().
// ==========================================================================

var SETTINGS = {
  sheetId: "1HUvUnGC7G9Kab-cHTW0WYAI41dK9bhuOy5tGq0f_NDM",

  formBaseUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdxz_5YnX30AkhVuTEBYiTjAU5Ps38Qa_-Fx-uQS3fbG1cWcg/viewform",
  entryName: "entry.640056832",
  entryPhone: "entry.778392849",
  entrySessions: "entry.1359171350",

  // Emails kept free for the confirmation thank-you emails. Bulk sends from the
  // app stop when only this many remain.
  quotaReserve: 5,

  // Google Drive file IDs (images must be shared: Anyone with the link = Viewer)
  images: {
    iadvl:      "1wMw8YXdv0CqtKVF1YSvCoQTzrRq9oK3R",
    dermacon:   "18O31LHEMdrDw2MGTwW_jlsI_kudIzo8P",
    sigKrina:   "1kj3CC54PbE-tixvnKu8hni1jAb14BFRs",
    sigRanjan:  "1vBnl3lg7OW_V_BKUdWEhu8LmlLJ3hFH3",
    sigJagdish: "1YnfUTVnzQ2A4GDM-csACA28KjzLnmevd",
    sigKandarp: "1qVJd9oAvZJT1SA4uo5c24yYDLt9IMHsk"
  }
};

var LOG_SHEET = "EmailLog";
var LOG_HEADERS = ["SentAt", "Name", "Email", "Phone", "Sessions", "FormLink", "Status", "ReminderSentAt", "RespondedAt", "SessionsData"];

// One row per (faculty, topic) the faculty has confirmed. Rows are only ever
// added, so a topic added later starts as NOT confirmed.
var CONFIRM_SHEET = "TopicConfirmations";
var CONFIRM_HEADERS = ["FacultyId", "TopicId", "Email", "ConfirmedAt"];

var PDF_FOLDER_NAME = "DERMACON Commitment PDFs";
var MANUAL_FACULTY_EMAIL_INTERVAL_MS = 6000;
var LAST_MANUAL_FACULTY_EMAIL_PROPERTY = "LAST_MANUAL_FACULTY_EMAIL_AT";

// ==========================================================================
// HELPERS
// ==========================================================================
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Replace {{Key}} placeholders (values are inserted as-is)
function fill(str, map) {
  for (var key in map) {
    if (map.hasOwnProperty(key)) {
      (function (k, v) {
        str = str.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), function () { return v; });
      })(key, map[key]);
    }
  }
  return str;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function driveImgUrl(fileId) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w600";
}

function buildPrefilledLink(name, phone, sessions) {
  return SETTINGS.formBaseUrl + "?usp=pp_url" +
    "&" + SETTINGS.entryName + "=" + encodeURIComponent(name || "") +
    "&" + SETTINGS.entryPhone + "=" + encodeURIComponent(phone || "") +
    "&" + SETTINGS.entrySessions + "=" + encodeURIComponent(sessions || "");
}

// Optional shared secret. If the script property SYNC_TOKEN is set, every call
// from the app must carry the same token (env var SYNC_TOKEN in the app's .env.local).
function isAuthorized(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!expected) return true;
  return String(token || '') === expected;
}

function quotaLeft() {
  return MailApp.getRemainingDailyQuota();
}

function sendManualFacultyEmail(send) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (quotaLeft() <= SETTINGS.quotaReserve) {
      throw new Error("The daily email reserve has been reached. Try again after the quota resets.");
    }

    var properties = PropertiesService.getScriptProperties();
    var lastSentAt = Number(properties.getProperty(LAST_MANUAL_FACULTY_EMAIL_PROPERTY)) || 0;
    var waitMs = lastSentAt
      ? MANUAL_FACULTY_EMAIL_INTERVAL_MS - (Date.now() - lastSentAt)
      : 0;
    if (waitMs > 0) Utilities.sleep(waitMs);

    properties.setProperty(LAST_MANUAL_FACULTY_EMAIL_PROPERTY, String(Date.now()));
    send();
  } finally {
    lock.releaseLock();
  }
}

function venueButtonHtml(url) {
  var link = String(url || '').trim();
  var isHttpsVenueLink = /^https:\/\/[^/?#]+\/venue\/?$/i.test(link);
  var isLocalVenueLink = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/venue\/?$/i.test(link);
  if (!isHttpsVenueLink && !isLocalVenueLink) return '';
  return '<p style="margin:0 0 22px;"><a href="' + esc(link) + '" style="background:#a3196c; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:4px; font-size:13px; font-weight:bold;">Open the shared venue map</a></p>';
}

function roleLabel(role) {
  var r = String(role || 'Faculty');
  if (r === 'Chairperson') return 'Chairperson';
  if (r === 'Panel') return 'Panelist';
  return r;
}

function readTemplate(name) {
  return HtmlService.createTemplateFromFile(name).getRawContent();
}

function resolveImages(html) {
  return html.replace(/cid:(\w+)/g, function (match, key) {
    return SETTINGS.images[key] ? driveImgUrl(SETTINGS.images[key]) : match;
  });
}

// ==========================================================================
// SHEETS
// ==========================================================================
function getLogSheet() {
  var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
  var sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(LOG_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getConfirmSheet() {
  var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
  var sh = ss.getSheetByName(CONFIRM_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIRM_SHEET);
    sh.appendRow(CONFIRM_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Mark every topic in this faculty's latest email as confirmed (adds rows only).
function recordTopicConfirmations(email, sessionsData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getConfirmSheet();
    var values = sh.getDataRange().getValues();
    var seen = {};
    for (var i = 1; i < values.length; i++) {
      seen[String(values[i][0]) + '|' + String(values[i][1])] = true;
    }
    var now = new Date();
    var rows = [];
    (sessionsData || []).forEach(function (r) {
      if (!r.topic_id || !r.faculty_id) return;
      var key = String(r.faculty_id) + '|' + String(r.topic_id);
      if (seen[key]) return;
      seen[key] = true;
      rows.push([r.faculty_id, r.topic_id, email, now]);
    });
    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, CONFIRM_HEADERS.length).setValues(rows);
    }
  } finally {
    lock.releaseLock();
  }
}

// Add a row, or reset the existing row if this faculty was emailed before
function logSent(data, link) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getLogSheet();
    var email = String(data.email || '').trim().toLowerCase();
    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][2]).trim().toLowerCase() === email) { rowIdx = i + 1; break; }
    }
    var row = [new Date(), data.name, data.email, data.phone || '', data.sessions || '', link, "Sent", "", "", JSON.stringify(data.sessionsData || [])];
    if (rowIdx > 0) {
      sh.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  } finally {
    lock.releaseLock();
  }
}

// Replace the saved topic list of this faculty (log sheet, column J) without touching
// the rest of the row. Keeps the PDF file id so the thank-you email can still attach it.
function refreshSnapshot(email, sessionsData) {
  if (!sessionsData || !sessionsData.length) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getLogSheet();
    var values = sh.getDataRange().getValues();
    var e = String(email || '').trim().toLowerCase();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][2]).trim().toLowerCase() !== e) continue;
      var old = [];
      try { old = JSON.parse(values[i][9] || "[]"); } catch (x) {}
      var pdfId = '';
      old.forEach(function (r) { if (r.pdf_id && !pdfId) pdfId = r.pdf_id; });
      if (pdfId) sessionsData.forEach(function (r) { r.pdf_id = pdfId; });
      sh.getRange(i + 1, 10).setValue(JSON.stringify(sessionsData));
      break;
    }
  } finally {
    lock.releaseLock();
  }
}

// A faculty who answers "No" after an earlier "Yes": remove their confirmation rows,
// so the app's Sync turns their topics back to unconfirmed. Matches by email and by the
// faculty/topic ids saved with their last email.
function removeTopicConfirmations(email, sessionsData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getConfirmSheet();
    var values = sh.getDataRange().getValues();
    var e = String(email || '').trim().toLowerCase();
    var keys = {};
    (sessionsData || []).forEach(function (r) {
      if (r.topic_id && r.faculty_id) keys[String(r.faculty_id) + '|' + String(r.topic_id)] = true;
    });
    for (var i = values.length - 1; i >= 1; i--) {
      var rowEmail = String(values[i][2] || '').trim().toLowerCase();
      var key = String(values[i][0]) + '|' + String(values[i][1]);
      if ((e && rowEmail === e) || keys[key]) sh.deleteRow(i + 1);
    }
  } finally {
    lock.releaseLock();
  }
}

// Called when the faculty submits the Google Form
function markResponded(email, name, status) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getLogSheet();
    var values = sh.getDataRange().getValues();
    var e = String(email || '').trim().toLowerCase();
    var n = String(name || '').trim().toLowerCase();
    if (n === 'doctor') n = '';
    for (var i = 1; i < values.length; i++) {
      var rowEmail = String(values[i][2]).trim().toLowerCase();
      var rowName  = String(values[i][1]).trim().toLowerCase();
      if ((e && rowEmail === e) || (n && rowName === n)) {
        sh.getRange(i + 1, 7).setValue(status);
        sh.getRange(i + 1, 9).setValue(new Date());
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ==========================================================================
// PDF (ONE pdf per faculty, made by the app, one page per session)
// ==========================================================================
function getPdfFolder() {
  var it = DriveApp.getFoldersByName(PDF_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PDF_FOLDER_NAME);
}

// Trash the PDF saved for this faculty's previous email (no piles of old copies)
function trashOldPdfs(email) {
  try {
    var values = getLogSheet().getDataRange().getValues();
    var e = String(email || '').trim().toLowerCase();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][2]).trim().toLowerCase() !== e) continue;
      var old = [];
      try { old = JSON.parse(values[i][9] || "[]"); } catch (x) {}
      var done = {};
      old.forEach(function (r) {
        if (r.pdf_id && !done[r.pdf_id]) {
          done[r.pdf_id] = true;
          try { DriveApp.getFileById(r.pdf_id).setTrashed(true); } catch (y) {}
        }
      });
      break;
    }
  } catch (err) { Logger.log("trashOldPdfs failed: " + err); }
}

// Decode the PDF sent by the app, keep a copy in Drive, remember its file id on
// every topic row (row.pdf_id) so the confirmation email can attach the same file.
function savePdfs(data) {
  var blobs = [];
  var list = data.pdfs || [];
  if (!list.length) return blobs;
  trashOldPdfs(data.email);
  var folder = null;
  try { folder = getPdfFolder(); } catch (err) { Logger.log("PDF folder failed: " + err); }
  list.forEach(function (p) {
    try {
      var blob = Utilities.newBlob(Utilities.base64Decode(p.base64), 'application/pdf', p.name);
      blobs.push(blob);
      if (folder) {
        var file = folder.createFile(blob);
        (data.sessionsData || []).forEach(function (row) { row.pdf_id = file.getId(); });
      }
    } catch (err2) { Logger.log("PDF save failed for " + p.name + ": " + err2); }
  });
  return blobs;
}

function pdfsFromSnapshot(sessionsData) {
  var blobs = [];
  var done = {};
  (sessionsData || []).forEach(function (r) {
    if (!r.pdf_id || done[r.pdf_id]) return;
    done[r.pdf_id] = true;
    try { blobs.push(DriveApp.getFileById(r.pdf_id).getBlob()); }
    catch (err) { Logger.log("PDF missing " + r.pdf_id + ": " + err); }
  });
  return blobs;
}

// ==========================================================================
// LETTER BUILDING (Template.html = the faculty letter, ReportTemplate.html = shell)
// ==========================================================================
function extraRows(r) {
  var speakers = r.speakers || [];
  var out = '';
  function row(label, names) {
    return '<tr><td style="border:1px solid #222; padding:3px 6px; font-weight:bold;">' + label + '</td>' +
           '<td colspan="3" style="border:1px solid #222; padding:3px 6px;">' + esc(names.join(', ')) + '</td></tr>';
  }
  if (r.role === 'Chairperson' && speakers.length) out += row('Speakers', speakers);
  // Panel / debate: the moderator and the other panelists / debaters (the reader is left out)
  var p = r.panel;
  if (p) {
    if (p.moderators && p.moderators.length) out += row(p.moderators.length > 1 ? 'Moderators' : 'Moderator', p.moderators);
    if (p.panelists && p.panelists.length) out += row('Panelists', p.panelists);
    if (p.debaters && p.debaters.length) out += row('Debaters', p.debaters);
  }
  return out;
}

function changesBox(changes) {
  if (!changes || !changes.length) return '';
  var items = changes.map(function (c) {
    return '<li style="margin:0 0 4px;">' + esc(c) + '</li>';
  }).join('');
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8c36a; border-radius:6px; background:#fff8e6; margin:0 0 22px;">' +
         '<tr><td style="padding:12px 18px; font-size:13px; line-height:1.5;">' +
         '<div style="font-size:15px; font-weight:bold; color:#7a4b00; margin-bottom:6px;">What has changed</div>' +
         '<ul style="margin:0; padding-left:18px;">' + items + '</ul></td></tr></table>';
}

// Small tag after a topic title: "new" (not confirmed yet) or "already confirmed"
function statusTag(status) {
  if (status === 'new') return ' <span style="color:#b45309; font-weight:bold;">(new &ndash; please confirm)</span>';
  if (status === 'confirmed') return ' <span style="color:#1a7f37;">(already confirmed)</span>';
  return '';
}

// o: { name, role, title, greeting, intro, formLink, changes, venueUrl }
function buildLetterHtml(rows, o) {
  var template = readTemplate('Template');
  var sm = /<!--\s*SESSION_START\s*-->/i.exec(template);
  var em = /<!--\s*SESSION_END\s*-->/i.exec(template);
  if (!sm || !em) throw new Error("Markers not found. Template starts with: " + template.substring(0, 200));

  var block = template.substring(sm.index + sm[0].length, em.index);
  var blocks = '';
  (rows || []).forEach(function (r, i) {
    blocks += fill(block, {
      SessionNumber: String(i + 1),
      RoleLabel:     esc(roleLabel(r.role)),
      Topic:         esc(r.topic || '') + statusTag(r.status),
      Timing:        esc(r.time || ''),
      SessionName:   esc(((r.session_code || '') + ' ' + (r.session_name || '')).trim()),
      Hall:          esc(r.session_hall || 'TBD'),
      Date:          esc(r.date || ''),
      SessionTime:   esc(r.session_time || ''),
      ExtraRows:     extraRows(r),
      CoordName:     esc(r.coordName || ''),
      CoordPhone:    esc(r.coordPhone || ''),
      CoordEmail:    esc(r.coordEmail || '')
    });
  });

  var html = template.substring(0, sm.index) + blocks + template.substring(em.index + em[0].length);
  html = fill(html, {
    FacultyName: esc(o.name),
    Role:        esc(o.role || 'Faculty'),
    LetterDate:  Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy"),
    EmailTitle:  o.title,
    Greeting:    o.greeting,
    IntroText:   o.intro,
    ChangesBox:  changesBox(o.changes),
    VenueButton: venueButtonHtml(o.venueUrl)
  });
  html = html.replace('https://forms.gle/REPLACE_WITH_YOUR_GOOGLE_FORM_LINK', function () { return o.formLink || '#'; });
  return resolveImages(html);
}

// Letterhead shell for short emails (reminder, report, thank-you)
function buildShellHtml(title, bodyHtml) {
  var html = readTemplate('ReportTemplate');
  html = fill(html, {
    Title: esc(title),
    Body: bodyHtml,
    LetterDate: Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy")
  });
  return resolveImages(html);
}

function confirmButton(label, link) {
  return '<a href="' + link + '" style="background:#4a2c6e; color:#ffffff; padding:10px 18px; text-decoration:none; border-radius:4px; font-size:13px; font-weight:bold;">' + esc(label) + '</a>';
}

// Link the faculty can use to change their form answers. Needs the Forms
// permission (authorizeAll) and "Allow response editing" on the form (switched on here).
function getEditResponseUrl(email, fallbackLink) {
  try {
    var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
    var formUrl = ss.getFormUrl();
    if (!formUrl) return fallbackLink;
    var form = FormApp.openByUrl(formUrl);
    if (!form.canEditResponse()) form.setAllowResponseEdits(true);
    var responses = form.getResponses();
    var e = String(email || '').trim().toLowerCase();
    if (!e) return fallbackLink;
    // Newest first. Match the collected respondent email, or an answer that is
    // exactly this email (forms that ask for it as a question). Never fall back
    // to "the latest response": that can be someone else's answers.
    for (var i = responses.length - 1; i >= 0; i--) {
      var re = String(responses[i].getRespondentEmail() || '').trim().toLowerCase();
      if (re && re === e) return responses[i].getEditResponseUrl();
      var answers = responses[i].getItemResponses();
      for (var j = 0; j < answers.length; j++) {
        if (String(answers[j].getResponse() || '').trim().toLowerCase() === e) return responses[i].getEditResponseUrl();
      }
    }
  } catch (err) {
    Logger.log("getEditResponseUrl failed: " + err);
  }
  return fallbackLink;
}

// ==========================================================================
// doPost : called by the Next.js app
// ==========================================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (!isAuthorized(data.token)) return json({ status: "Error", message: "Unauthorized (token mismatch)." });

    // ---- first email / schedule update -------------------------------------
    if (data.action === "sendFormLink" || data.action === "sendScheduleUpdate") {
      var isUpdate = (data.action === "sendScheduleUpdate");

      if (quotaLeft() <= SETTINGS.quotaReserve) {
        return json({ status: "Error", quotaLeft: quotaLeft(),
          message: "Only " + quotaLeft() + " emails left today. " + SETTINGS.quotaReserve + " are kept for faculty confirmations. Try again after the daily limit resets." });
      }

      var prefilledLink = buildPrefilledLink(data.name, data.phone, data.formSessions || data.sessions);
      var roleText = esc(data.role || 'Faculty');
      var htmlBody = buildLetterHtml(data.sessionsData, {
        name: data.name,
        role: data.role,
        title: isUpdate ? "Schedule Update – DERMACON International 2027" : "Faculty Scientific Commitment – DERMACON International 2027",
        greeting: "Greetings from the Scientific Committee of <strong>DERMACON International 2027</strong>.",
        intro: isUpdate
          ? "There has been a change in your scientific commitment. Your current details are below, with the changes listed first."
          : "We are delighted to welcome you as <strong>" + roleText + "</strong>. Your scientific commitment details are below.",
        formLink: prefilledLink,
        changes: isUpdate ? data.changes : [],
        venueUrl: data.venueUrl
      });

      var pdfBlobs = savePdfs(data);

      sendManualFacultyEmail(function () {
        MailApp.sendEmail({
          to: data.email,
          subject: (isUpdate ? "[DERMACON International 2027] Schedule Update - " : "[DERMACON International 2027] Scientific Commitments - ") + data.name,
          body: "Dear " + data.name + ",\n\nYour scientific commitment details are included in this email (PDF attached).\n\nConfirm your attendance here: " + prefilledLink + (data.venueUrl ? "\n\nShared venue map: " + data.venueUrl : ''),
          htmlBody: htmlBody,
          attachments: pdfBlobs
        });
      });

      try { logSent(data, prefilledLink); }
      catch (err1) { Logger.log("logSent failed: " + err1); }

      return json({ status: "Success", pdfsReceived: (data.pdfs || []).length, pdfsAttached: pdfBlobs.length, quotaLeft: quotaLeft() });
    }

    // ---- reminder ----------------------------------------------------------
    if (data.action === "sendReminder") {
      if (quotaLeft() <= SETTINGS.quotaReserve) {
        return json({ status: "Error", quotaLeft: quotaLeft(), message: "Not enough emails left today." });
      }
      var link = buildPrefilledLink(data.name, data.phone, data.formSessions || data.sessions);
      // Keep the saved topic list current, so "Yes" confirms the topics shown in this reminder
      try { refreshSnapshot(data.email, data.sessionsData); }
      catch (errSnap) { Logger.log("refreshSnapshot failed: " + errSnap); }
      var pending = data.pendingTopics || [];
      var pendingHtml = pending.length
        ? '<p style="font-size:14px; margin:0 0 6px;"><strong>Topics awaiting your confirmation:</strong></p><ul style="font-size:14px; margin:0 0 12px; padding-left:20px;">' +
          pending.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
        : '';
      var body =
        '<p style="font-size:14px; font-weight:bold; margin:0 0 12px;">Dear ' + esc(data.name) + ',</p>' +
        '<p style="font-size:14px; line-height:1.6; margin:0 0 12px;">This is a gentle reminder. We have emailed you your scientific commitment details for <strong>DERMACON International 2027</strong> and have not yet received your confirmation' + (pending.length ? ' for the topic(s) below' : '') + '.</p>' +
        (pendingHtml || (data.sessions ? '<p style="font-size:14px; margin:0 0 12px;"><strong>Your session(s):</strong> ' + esc(String(data.sessions).replace(/,/g, ', ')) + '</p>' : '')) +
        venueButtonHtml(data.venueUrl) +
        '<p style="font-size:14px; margin:0 0 16px;">Please confirm your participation. It takes less than a minute.</p>' +
        '<p style="margin:0 0 20px;">' + confirmButton('Confirm participation', link) + '</p>' +
        '<p style="font-size:14px; margin:0;">Warm regards,<br><strong>DERMACON International 2027</strong></p>';
      sendManualFacultyEmail(function () {
        MailApp.sendEmail({
          to: data.email,
          subject: "[Reminder] [DERMACON International 2027] Please confirm your participation - " + data.name,
          body: "Dear " + data.name + ",\n\nThis is a gentle reminder. Please confirm your participation: " + link + (data.venueUrl ? "\n\nShared venue map: " + data.venueUrl : ''),
          htmlBody: buildShellHtml("Reminder – please confirm your participation", body)
        });
      });
      return json({ status: "Success", quotaLeft: quotaLeft() });
    }

    // ---- report to the coordinators of one session -------------------------
    if (data.action === "sendCoordinatorReport") {
      var coords = (data.coordinators || []).filter(function (c) { return c.email && String(c.email).indexOf('@') > 0; });
      if (!coords.length) return json({ status: "Error", message: "No coordinator with an email address." });
      if (quotaLeft() - coords.length < SETTINGS.quotaReserve) {
        return json({ status: "Error", quotaLeft: quotaLeft(), message: "Not enough emails left today for " + coords.length + " coordinator(s)." });
      }

      var s = data.session || {};
      var tbl =
        '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px; line-height:1.4;">' +
        '<tr style="background:#4a2c6e; color:#ffffff;">' +
        '<th align="left" style="border:1px solid #222; padding:4px 6px;">Time</th>' +
        '<th align="left" style="border:1px solid #222; padding:4px 6px;">Topic</th>' +
        '<th align="left" style="border:1px solid #222; padding:4px 6px;">Faculty / role</th>' +
        '<th align="left" style="border:1px solid #222; padding:4px 6px;">Status</th></tr>';
      (data.rows || []).forEach(function (r) {
        var people = r.people && r.people.length ? r.people : [{ name: '— no faculty yet —', role: '', confirmed: null }];
        people.forEach(function (p, i) {
          var status = p.confirmed === null ? '' :
            (p.confirmed ? '<span style="color:#1a7f37; font-weight:bold;">Confirmed</span>' : '<span style="color:#b45309;">Pending</span>');
          tbl += '<tr>' +
            (i === 0 ? '<td rowspan="' + people.length + '" valign="top" style="border:1px solid #222; padding:4px 6px; white-space:nowrap;">' + esc(r.time) + '</td>' +
                       '<td rowspan="' + people.length + '" valign="top" style="border:1px solid #222; padding:4px 6px; font-weight:bold;">' + esc(r.topic) + '</td>' : '') +
            '<td style="border:1px solid #222; padding:4px 6px;">' + esc(p.name) + (p.role ? ' <span style="color:#666;">(' + esc(roleLabel(p.role)) + ')</span>' : '') + '</td>' +
            '<td style="border:1px solid #222; padding:4px 6px;">' + status + '</td></tr>';
        });
      });
      tbl += '</table>';

      var sent = 0;
      coords.forEach(function (c, idx) {
        var rep =
          '<p style="font-size:14px; font-weight:bold; margin:0 0 12px;">Dear ' + esc(c.name || 'Coordinator') + ',</p>' +
          '<p style="font-size:14px; line-height:1.6; margin:0 0 12px;">Here is the current status of your session <strong>' + esc((s.code || '') + ' ' + (s.name || '')) + '</strong>.</p>' +
          '<p style="font-size:13px; margin:0 0 14px;"><strong>Date:</strong> ' + esc(s.date) + ' &nbsp; <strong>Hall:</strong> ' + esc(s.hall || 'TBD') + ' &nbsp; <strong>Time:</strong> ' + esc(s.time) + '</p>' +
          tbl +
          '<p style="font-size:12px; color:#666; margin:12px 0 16px;">Status is as of the last sync' + (data.syncedAt ? ' (' + esc(data.syncedAt) + ')' : '') + '.</p>' +
          '<p style="font-size:14px; margin:0;">Warm regards,<br><strong>DERMACON International 2027</strong></p>';
        MailApp.sendEmail({
          to: c.email,
          subject: "[DERMACON International 2027] Session report - " + (s.code || '') + " " + (s.name || ''),
          body: "Session report for " + (s.code || '') + ". Please view this email in HTML.",
          htmlBody: buildShellHtml("Session report – " + (s.code || ''), rep)
        });
        sent++;
        if (idx < coords.length - 1) Utilities.sleep(1500);
      });
      return json({ status: "Success", sent: sent, quotaLeft: quotaLeft() });
    }

    // ---- confirmations removed in the app, sent in one batch by Sync --------
    // items: [{ facultyId, topicId, removedAt }]. Deletes those rows from
    // TopicConfirmations in ONE write. A row confirmed on the form AFTER the
    // removal (ConfirmedAt later than removedAt) is kept: that is a new "Yes".
    if (data.action === "removeConfirmations") {
      var items = data.items || [];
      var removeAt = {};
      items.forEach(function (it) {
        if (!it.facultyId || !it.topicId) return;
        var t = it.removedAt ? new Date(it.removedAt).getTime() : Date.now();
        var k = String(it.facultyId) + '|' + String(it.topicId);
        if (!removeAt[k] || t > removeAt[k]) removeAt[k] = t;
      });
      var removed = 0;
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        var sh = getConfirmSheet();
        var values = sh.getDataRange().getValues();
        var keep = [values[0]];
        for (var i = 1; i < values.length; i++) {
          var k2 = String(values[i][0]) + '|' + String(values[i][1]);
          var confirmedAt = values[i][3] ? new Date(values[i][3]).getTime() : 0;
          if (removeAt[k2] && confirmedAt <= removeAt[k2]) { removed++; continue; }
          keep.push(values[i]);
        }
        if (removed > 0) {
          sh.getRange(1, 1, keep.length, values[0].length).setValues(keep);
          sh.deleteRows(keep.length + 1, values.length - keep.length);
        }
      } finally {
        lock.releaseLock();
      }
      return json({ status: "Success", removed: removed });
    }

    return json({ status: "Error", message: "Unknown action" });
  } catch (err) {
    return json({ status: "Error", message: err.toString() });
  }
}

// ==========================================================================
// doGet : the app's Sync button and the quota display
//   ?action=quota  -> { quota }
//   (default)      -> { topics: [{facultyId, topicId, confirmedAt}] }
// ==========================================================================
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!isAuthorized(p.token)) return json({ error: "Unauthorized (token mismatch)." });

  if (p.action === 'quota') return json({ quota: quotaLeft(), reserve: SETTINGS.quotaReserve });

  var out = { topics: [] };
  var cs = SpreadsheetApp.openById(SETTINGS.sheetId).getSheetByName(CONFIRM_SHEET);
  if (cs) {
    var cv = cs.getDataRange().getValues();
    for (var j = 1; j < cv.length; j++) {
      if (!cv[j][0] || !cv[j][1]) continue;
      out.topics.push({
        facultyId: String(cv[j][0]),
        topicId: String(cv[j][1]),
        confirmedAt: cv[j][3] ? new Date(cv[j][3]).toISOString() : null
      });
    }
  }
  return json(out);
}

// ==========================================================================
// onFormSubmit : faculty submitted the Google Form
//   1. store the result  2. send ONE thank-you email to the faculty. Nothing else.
// ==========================================================================
function onFormSubmit(e) {
  var sheet = e.range.getSheet();

  // Guard: never process the same response twice (duplicate triggers, retries)
  var cache = CacheService.getScriptCache();
  var guardKey = 'resp_' + sheet.getSheetId() + '_' + e.range.getRow();
  if (cache.get(guardKey)) return;
  cache.put(guardKey, '1', 21600);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = e.values;

  function getCol(name) {
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).toLowerCase().indexOf(name.toLowerCase()) !== -1) return i;
    }
    return -1;
  }
  var iName   = getCol("Full Name");
  var iStatus = getCol("Attendance Status");
  var iEmail  = getCol("Email address");

  var name   = iName   >= 0 ? String(row[iName]   || "Doctor").trim() : "Doctor";
  var status = iStatus >= 0 ? String(row[iStatus] || "").trim() : "";
  var email  = iEmail  >= 0 ? String(row[iEmail]  || "").trim() : "";
  if (!email) return;

  // Whole words only: /no/ alone also matched "know", "not sure", "announce"...
  // and turned a "Yes" answer into a decline.
  var accepted = /\byes\b/i.test(status);
  var declined = !accepted && /\bno\b/i.test(status);

  // 1. STORE THE RESULT (before any email, so it is kept even if emailing fails)
  try {
    markResponded(email, name, declined ? "Declined" : (accepted ? "Confirmed" : "Responded"));
  } catch (errLog) { Logger.log("markResponded failed: " + errLog); }

  var sessionsData = [];
  var savedLink = "";
  if (declined) {
    try {
      var declData = getLogSheet().getDataRange().getValues();
      var declSessions = [];
      for (var d = 1; d < declData.length; d++) {
        if (String(declData[d][2]).trim().toLowerCase() === email.toLowerCase()) {
          try { declSessions = JSON.parse(declData[d][9] || "[]"); } catch (errP) {}
          break;
        }
      }
      removeTopicConfirmations(email, declSessions);
    } catch (errDecl) { Logger.log("removeTopicConfirmations failed: " + errDecl); }
  }
  if (accepted) {
    var logData = getLogSheet().getDataRange().getValues();
    for (var i = 1; i < logData.length; i++) {
      if (String(logData[i][2]).trim().toLowerCase() === email.toLowerCase()) {
        try { sessionsData = JSON.parse(logData[i][9] || "[]"); } catch (errParse) {}
        savedLink = String(logData[i][5] || "");
        break;
      }
    }
    try { recordTopicConfirmations(email, sessionsData); }
    catch (errConf) { Logger.log("recordTopicConfirmations failed: " + errConf); }
  }

  // 2. ONE thank-you email to the faculty. If the daily limit is reached the
  //    result is already stored; only the thank-you is skipped.
  if (quotaLeft() < 1) {
    Logger.log("Daily email limit reached: thank-you for " + email + " not sent. Result IS stored.");
    return;
  }

  try {
    if (declined) {
      var nb = '<p style="font-size:14px; font-weight:bold; margin:0 0 12px;">Dear ' + esc(name) + ',</p>' +
               '<p style="font-size:14px; line-height:1.6; margin:0 0 12px;">Thank you for your response. We have noted your unavailability.</p>' +
               '<p style="font-size:14px; margin:0;">Warm regards,<br><strong>DERMACON International 2027</strong></p>';
      MailApp.sendEmail({
        to: email,
        subject: "[DERMACON International 2027] Response Received",
        body: "Dear " + name + ",\n\nThank you for your response. We have noted your unavailability.",
        htmlBody: buildShellHtml("Response received", nb)
      });
      return;
    }

    if (accepted && sessionsData.length > 0) {
      var htmlBody = buildLetterHtml(sessionsData, {
        name: name,
        role: sessionsData[0].role || "Faculty",
        title: "Participation Confirmed – DERMACON International 2027",
        greeting: "Thank you for confirming your participation for <strong>DERMACON International 2027</strong>.",
        intro: "Your participation is confirmed for the following scientific commitment(s).",
        formLink: savedLink,
        changes: []
      });

      // Replace the "Confirm participation" box with an "Edit your response" box
      var editLink = getEditResponseUrl(email, savedLink);
      var editBox =
        '<!-- CONFIRM_BOX_START -->' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #cfe0ee; border-radius:6px; background:#f7fbff; margin:0 0 22px;">' +
        '<tr><td style="padding:16px 20px;">' +
        '<div style="font-size:15px; font-weight:bold; margin-bottom:6px;">Your participation is confirmed</div>' +
        '<div style="font-size:13px; margin-bottom:12px;">Need to change something? You can edit your response below.</div>' +
        (editLink ? confirmButton('Edit your response', editLink) : '') +
        '</td></tr></table>' +
        '<!-- CONFIRM_BOX_END -->';
      var a = htmlBody.indexOf('<!-- CONFIRM_BOX_START -->');
      var b = htmlBody.indexOf('<!-- CONFIRM_BOX_END -->');
      if (a !== -1 && b !== -1) {
        htmlBody = htmlBody.substring(0, a) + editBox + htmlBody.substring(b + '<!-- CONFIRM_BOX_END -->'.length);
      }

      MailApp.sendEmail({
        to: email,
        subject: "✅ Confirmed: DERMACON International 2027",
        body: "Thank you for confirming, " + name + ". Your confirmed sessions and topics are listed in the HTML version of this email (PDF attached).",
        htmlBody: htmlBody,
        attachments: pdfsFromSnapshot(sessionsData)
      });
      return;
    }

    // Accepted, but no saved schedule was found for this email
    var fb = '<p style="font-size:14px; font-weight:bold; margin:0 0 12px;">Dear ' + esc(name) + ',</p>' +
             '<p style="font-size:14px; line-height:1.6; margin:0 0 12px;">Thank you for confirming your participation for <strong>DERMACON International 2027</strong>.</p>' +
             '<p style="font-size:14px; margin:0;">Warm regards,<br><strong>DERMACON International 2027</strong></p>';
    MailApp.sendEmail({
      to: email,
      subject: "✅ Confirmed: DERMACON International 2027",
      body: "Thank you for confirming, " + name,
      htmlBody: buildShellHtml("Participation confirmed", fb)
    });
  } catch (errMail) {
    Logger.log("Thank-you email failed for " + email + ": " + errMail);
  }
}

// ==========================================================================
// ONE-TIME SETUP (run these from the Apps Script editor, in this order)
// ==========================================================================

// 1. Makes Google show the permission screen for everything this script uses.
//    Approve it. (Needed again whenever the permissions in appsscript.json change.)
function authorizeAll() {
  DriveApp.getFoldersByName(PDF_FOLDER_NAME);
  var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
  var url = ss.getFormUrl();
  if (url) FormApp.openByUrl(url);
  CacheService.getScriptCache().put('auth_test', '1', 5);
  LockService.getScriptLock();
  ScriptApp.getProjectTriggers();
  Logger.log("Authorized. Emails left today: " + quotaLeft());
}

// 2. Removes EVERY trigger of this project (old reminder triggers, duplicate
//    form triggers, triggers created before the Forms permission existed) and
//    creates one clean form-submit trigger with the current permissions.
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  Logger.log("Done: one onFormSubmit trigger installed. Automatic reminders are OFF. Emails left today: " + quotaLeft());
}

// Optional: shows the triggers and today's remaining email quota
function checkTriggers() {
  var list = ScriptApp.getProjectTriggers();
  list.forEach(function (t) { Logger.log("Trigger: " + t.getHandlerFunction() + " | " + t.getEventType()); });
  Logger.log(list.length + " trigger(s). Emails left today: " + quotaLeft());
}
