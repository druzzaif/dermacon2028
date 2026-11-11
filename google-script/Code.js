// ==========================================
// 1. SETTINGS
// ==========================================
var SETTINGS = {
  sheetId: "1HUvUnGC7G9Kab-cHTW0WYAI41dK9bhuOy5tGq0f_NDM",
  myEmail: "druzzaif@gmail.com",
  workshopEmail: "workshop@dermacon2027.com",
  reminderAfterDays: 5,
  coordinatorRole: "Lead Coordinator",

  formBaseUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdxz_5YnX30AkhVuTEBYiTjAU5Ps38Qa_-Fx-uQS3fbG1cWcg/viewform",
  entryName: "entry.640056832",
  entryPhone: "entry.778392849",
  entrySessions: "entry.1359171350",

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

// ==========================================
// HELPERS
// ==========================================
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Replace {{Key}} placeholders safely
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

function driveImgUrl(fileId) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w600";
}

function buildPrefilledLink(name, phone, sessions) {
  return SETTINGS.formBaseUrl + "?usp=pp_url" +
    "&" + SETTINGS.entryName + "=" + encodeURIComponent(name || "") +
    "&" + SETTINGS.entryPhone + "=" + encodeURIComponent(phone || "") +
    "&" + SETTINGS.entrySessions + "=" + encodeURIComponent(sessions || "");
}

// ==========================================
// EMAIL LOG (tracks who was emailed / confirmed)
// ==========================================
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

// Add a row, or reset the existing row if this faculty was emailed before
function logSent(data, link) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getLogSheet();
    var email = String(data.email || '').trim().toLowerCase();
    var values = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][2]).trim().toLowerCase() === email) { rowIdx = i + 1; break; }
    }
    var row = [new Date(), data.name, data.email, data.phone || '', data.sessions || '', link, "Sent", "", "", JSON.stringify(data.sessionsData || [])];    if (rowIdx > 0) {
      sh.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  } finally {
    lock.releaseLock();
  }
}

// Called when the faculty submits the Google Form
function markResponded(email, name, status) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
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

// ==========================================
// 2. DO POST (Called from Next.js)
// ==========================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === "sendFormLink" || data.action === "sendScheduleUpdate") {
      var isUpdate = (data.action === "sendScheduleUpdate");

      // 1. Pre-filled Google Form link
      var prefilledLink = isUpdate ? "" : buildPrefilledLink(data.name, data.phone, data.sessions);

      // 2. Load the HTML template (raw text)
      var template = HtmlService.createTemplateFromFile('Template').getRawContent();

      // 3. Find the loop markers
      var startMatch = /<!--\s*SESSION_START\s*-->/i.exec(template);
      var endMatch   = /<!--\s*SESSION_END\s*-->/i.exec(template);
      if (!startMatch || !endMatch) {
        throw new Error("Markers not found. Template starts with: " + template.substring(0, 200));
      }
      var startIndex = startMatch.index;
      var endIndex   = endMatch.index;

      // 4. Build the block for each session
      var blockTemplate = template.substring(startIndex + startMatch[0].length, endIndex);
      var sessionBlocksHtml = '';

      if (data.sessionsData && data.sessionsData.length > 0) {
        for (var i = 0; i < data.sessionsData.length; i++) {
          var row = data.sessionsData[i];
          sessionBlocksHtml += fill(blockTemplate, {
            SessionNumber: String(i + 1),
            Topic:         esc(row.topic || ''),
            Timing:        esc(row.time || ''),
            SessionName:   esc(((row.session_code || '') + ' ' + (row.session_name || '')).trim()),
            Hall:          esc(row.session_hall || 'TBD'),
            Date:          esc(row.date || ''),
            SessionTime:   esc(row.session_time || ''),
            CoordName:     esc(row.coordName || ''),
            CoordPhone:    esc(row.coordPhone || ''),
            CoordEmail:    esc(row.coordEmail || '')
          });
        }
      }

      // 5. Assemble the final email
      var htmlBody = template.substring(0, startIndex) +
                     sessionBlocksHtml +
                     template.substring(endIndex + endMatch[0].length);

      htmlBody = fill(htmlBody, {
        FacultyName: esc(data.name),
        Role:        esc(data.role || 'Faculty'),
        LetterDate:  new Date().toLocaleDateString('en-GB'),
        EmailTitle:  isUpdate ? "Schedule Update – DERMACON International 2027" : "Faculty Scientific Commitment – DERMACON International 2027",
        Greeting:    "Greetings from the Scientific Committee of <strong>DERMACON International 2027</strong>.",
        IntroText:   "We are delighted to welcome you as <strong>" + esc(data.role || 'Faculty') + "</strong>. Your scientific commitment details are below."
      });
            // Always replace the link. If it's an update, use your specific dialog link.
      var finalLink = isUpdate ? "https://docs.google.com/forms/d/e/1FAIpQLSdxz_5YnX30AkhVuTEBYiTjAU5Ps38Qa_-Fx-uQS3fbG1cWcg/viewform?usp=dialog" : prefilledLink;
      htmlBody = htmlBody.replace('https://forms.gle/REPLACE_WITH_YOUR_GOOGLE_FORM_LINK', function () { return finalLink; });

      // 6. Point every cid:name image at its public Drive URL
      htmlBody = htmlBody.replace(/cid:(\w+)/g, function (match, key) {
        return SETTINGS.images[key] ? driveImgUrl(SETTINGS.images[key]) : match;
      });

      // 7. Send to faculty
      MailApp.sendEmail({
        to: data.email,
        subject: "[DERMACON International 2027] Scientific Commitments - " + data.name,
        body: "Dear " + data.name + ",\n\nYour scientific commitment details are included in this email.\n\nConfirm your attendance here: " + prefilledLink,
        htmlBody: htmlBody
      });

      // 8. Record it (used for the 5-day reminder). A failure here must not break the response.
      try { logSent(data, prefilledLink); }
      catch (err1) { Logger.log("logSent failed: " + err1); }

      // 9. Tell the coordinators that the faculty was emailed
      try { notifyCoordinatorsSent(data); }
      catch (err2) { Logger.log("notifyCoordinatorsSent failed: " + err2); }

      return ContentService.createTextOutput(JSON.stringify({ status: "Success" })).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === "syncCoordinators") {
      var expected = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
      if (!expected || data.token !== expected) {
        return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: "Unauthorized" })).setMimeType(ContentService.MimeType.JSON);
      }

      var out = [];
      (data.rows || []).forEach(function (r) {
        var code = String(r.code || '').trim();
        var em = String(r.email || '').trim();
        if (code && em.indexOf('@') > 0) out.push([code, em, String(r.name || '').trim()]);
      });

      // Safety: never wipe the tab if nothing was received
      if (!out.length) {
        return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: "No rows received. The tab was NOT changed." })).setMimeType(ContentService.MimeType.JSON);
      }

      var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
      var sh = ss.getSheetByName("CoordinatorList") || ss.insertSheet("CoordinatorList");
      sh.clearContents();
      sh.getRange(1, 1, 1, 3).setValues([["SessionCode", "Email", "Name"]]);
      sh.getRange(2, 1, out.length, 3).setValues(out);

      return ContentService.createTextOutput(JSON.stringify({ status: "Success", count: out.length })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 2b. COORDINATOR: "we have emailed your faculty"
// ==========================================
function notifyCoordinatorsSent(data) {
  var coordSheet = SpreadsheetApp.openById(SETTINGS.sheetId).getSheetByName("CoordinatorList");
  if (!coordSheet) return;                       // no tab: nothing is sent

  var coordData = coordSheet.getDataRange().getValues();   // A = session code, B = email, C = name
  var facultyEmail = String(data.email || '').trim().toLowerCase();
  var byCoord = {};

  (data.sessionsData || []).forEach(function (r) {
    var code = String(r.session_code || '').trim();
    if (!code) return;

    for (var k = 1; k < coordData.length; k++) {
      if (String(coordData[k][0]).trim() !== code) continue;

      var cEmail = String(coordData[k][1] || '').trim();
      var cName  = String(coordData[k][2] || '').trim();
      var key = cEmail.toLowerCase();

      if (cEmail.indexOf('@') < 1) continue;     // no email: nothing is sent
      if (key === facultyEmail) continue;

      if (!byCoord[key]) byCoord[key] = { email: cEmail, name: cName, rows: [], seen: {} };

      // avoid listing the same topic twice for the same coordinator
      var rowKey = code + '|' + (r.topic || '') + '|' + (r.time || '');
      if (byCoord[key].seen[rowKey]) continue;
      byCoord[key].seen[rowKey] = true;
      byCoord[key].rows.push(r);
    }
  });

  Object.keys(byCoord).forEach(function (key) {
    var c = byCoord[key];
    var codes = [];
    var rowsHtml = '';
    var rowsText = '';
    var cell = "border:1px solid #999; padding:4px 8px;";

    c.rows.forEach(function (r) {
      var sess = ((r.session_code || '') + ' ' + (r.session_name || '')).trim();
      if (r.session_code && codes.indexOf(r.session_code) === -1) codes.push(r.session_code);

      rowsHtml += "<tr>" +
        "<td style='" + cell + "'>" + esc(sess) + "</td>" +
        "<td style='" + cell + "'>" + esc(r.topic || '') + "</td>" +
        "<td style='" + cell + "'>" + esc(r.time || '') + "</td>" +
        "<td style='" + cell + "'>" + esc(r.session_hall || '') + "</td>" +
        "<td style='" + cell + "'>" + esc(r.date || '') + "</td>" +
        "<td style='" + cell + "'>" + esc(r.session_time || '') + "</td>" +
        "</tr>";

      rowsText += "- " + sess + " | " + (r.topic || '') + " | " + (r.time || '') + " | Hall " + (r.session_hall || '') +
                  " | " + (r.date || '') + " | " + (r.session_time || '') + "\n";
    });

    var html = "<div style='font-family: Arial, sans-serif; font-size:13px; line-height:1.5; color:#333;'>" +
      "<p><strong>Dear " + esc(c.name || 'Coordinator') + ",</strong></p>" +
      "<p>Faculty <strong>" + esc(data.name) + "</strong> has been invited for your session(s).</p>" +
      "<table style='border-collapse:collapse; font-size:12px;'>" +
        "<tr style='background:#e8eef7; font-weight:bold;'>" +
          "<td style='" + cell + "'>Session</td>" +
          "<td style='" + cell + "'>Topic</td>" +
          "<td style='" + cell + "'>Timing</td>" +
          "<td style='" + cell + "'>Hall</td>" +
          "<td style='" + cell + "'>Date</td>" +
          "<td style='" + cell + "'>Session time</td>" +
        "</tr>" + rowsHtml +
      "</table>" +
      "<p>Warm regards,<br><strong>DERMACON International 2027</strong></p></div>";

    MailApp.sendEmail({
      to: c.email,
      subject: "[DERMACON International 2027] Faculty invited: " + data.name + " (" + codes.join(', ') + ")",
      body: "Dear " + (c.name || 'Coordinator') + ",\n\nFaculty " + data.name + " has been invited for your session(s).\n\n" + rowsText,
      htmlBody: html
    });
  });
}

// ==========================================
// 3. ON FORM SUBMIT (Triggered by Google Form)
// ==========================================
function onFormSubmit(e) {
  var sheet = e.range.getSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = e.values;

  function getCol(name) {
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).toLowerCase().indexOf(name.toLowerCase()) !== -1) return i;
    }
    return -1;
  }

  var iName     = getCol("Full Name");
  var iStatus   = getCol("Attendance Status");
  var iPhone    = getCol("Mobile");
  var iEmail    = getCol("Email address");
  var iSessions = getCol("Sessions");

  var name        = iName     >= 0 ? String(row[iName]     || "Doctor").trim() : "Doctor";
  var status      = iStatus   >= 0 ? String(row[iStatus]   || "").trim() : "";
  var phone       = iPhone    >= 0 ? String(row[iPhone]    || "").trim() : "";
  var email       = iEmail    >= 0 ? String(row[iEmail]    || "").trim() : "";
  var sessionsStr = iSessions >= 0 ? String(row[iSessions] || "").trim() : "";

  if (!email) return;
  
  // Stop reminders for this faculty
  try {
    markResponded(email, name, /no/i.test(status) ? "Declined" : (/yes/i.test(status) ? "Confirmed" : "Responded"));
  } catch (errLog) {
    Logger.log("markResponded failed: " + errLog);
  }

  if (/no/i.test(status)) {
    MailApp.sendEmail({
      to: email,
      subject: "[DERMACON International 2027] Response Received",
      body: "Dear " + name + ",\n\nThank you for your response. We have noted your unavailability.",
      htmlBody: "<p>Dear <strong>" + name + "</strong>,</p><p>Thank you for your response. We have noted your unavailability.</p>"
    });
    return;
  }

  if (/yes/i.test(status)) {
    // 1. Fetch the saved sessionsData from the EmailLog
    var logSheet = getLogSheet();
    var logData = logSheet.getDataRange().getValues();
    var sessionsData = [];
    for (var i = 1; i < logData.length; i++) {
      if (String(logData[i][2]).trim().toLowerCase() === email.toLowerCase()) {
        try { sessionsData = JSON.parse(logData[i][9] || "[]"); } catch(e) {}
        break;
      }
    }

    // 2. Build the full HTML using the template
    var template = HtmlService.createTemplateFromFile('Template').getRawContent();
    var startMatch = /<!--\s*SESSION_START\s*-->/i.exec(template);
    var endMatch   = /<!--\s*SESSION_END\s*-->/i.exec(template);
    var sessionBlocksHtml = '';

    if (startMatch && endMatch && sessionsData.length > 0) {
      var blockTemplate = template.substring(startMatch.index + startMatch[0].length, endMatch.index);
      for (var i = 0; i < sessionsData.length; i++) {
        var row = sessionsData[i];
        sessionBlocksHtml += fill(blockTemplate, {
          SessionNumber: String(i + 1),
          Topic:         esc(row.topic || ''),
          Timing:        esc(row.time || ''),
          SessionName:   esc(((row.session_code || '') + ' ' + (row.session_name || '')).trim()),
          Hall:          esc(row.session_hall || 'TBD'),
          Date:          esc(row.date || ''),
          SessionTime:   esc(row.session_time || ''),
          CoordName:     esc(row.coordName || ''),
          CoordPhone:    esc(row.coordPhone || ''),
          CoordEmail:    esc(row.coordEmail || '')
        });
      }
      
      var htmlBody = template.substring(0, startMatch.index) + sessionBlocksHtml + template.substring(endMatch.index + endMatch[0].length);
      
      // 3. Fill global variables for the confirmation email
      htmlBody = fill(htmlBody, {
        FacultyName: esc(name),
        Role:        "Faculty",
        LetterDate:  new Date().toLocaleDateString('en-GB'),
        EmailTitle:  "Participation Confirmed – DERMACON International 2027",
        Greeting:    "Thank you for confirming your participation for <strong>DERMACON International 2027</strong>.",
        IntroText:   "Your confirmed scientific commitment details are below."
      });
      htmlBody = htmlBody.replace(/cid:(\w+)/g, function (match, key) {
        return SETTINGS.images[key] ? driveImgUrl(SETTINGS.images[key]) : match;
      });

      // 4. Remove the Confirm box
      var confirmStart = htmlBody.indexOf('<!-- CONFIRM_BOX_START -->');
      var confirmEnd = htmlBody.indexOf('<!-- CONFIRM_BOX_END -->');
      if (confirmStart !== -1 && confirmEnd !== -1) {
        htmlBody = htmlBody.substring(0, confirmStart) + htmlBody.substring(confirmEnd + '<!-- CONFIRM_BOX_END -->'.length);
      }

      // 5. Send the beautifully formatted email
      MailApp.sendEmail({
        to: email,
        subject: "✅ Confirmed: DERMACON International 2027",
        body: "Thank you for confirming, " + name,
        htmlBody: htmlBody
      });

    } else {
      // Fallback if data is missing
      var htmlFaculty = "<div style='font-family: Arial, sans-serif;'>";
      htmlFaculty += "<p><strong>Dear " + name + ",</strong></p>";
      htmlFaculty += "<p>Thank you for confirming your participation for DERMACON International 2027.</p>";
      htmlFaculty += "<p>Warm regards,<br><strong>DERMACON International 2027</strong></p></div>";
      MailApp.sendEmail({
        to: email,
        subject: "✅ Confirmed: DERMACON International 2027",
        body: "Thank you for confirming, " + name,
        htmlBody: htmlFaculty
      });
    }
    var htmlFaculty = "<div style='font-family: Arial, sans-serif;'>";
    htmlFaculty += "<p><strong>Dear " + name + ",</strong></p>";
    htmlFaculty += "<p>Thank you for confirming your participation for DERMACON International 2027.</p>";
    htmlFaculty += "<p>Warm regards,<br><strong>DERMACON International 2027</strong></p></div>";

    MailApp.sendEmail({
      to: email,
      subject: "✅ Confirmed: DERMACON International 2027",
      body: "Thank you for confirming, " + name,
      htmlBody: htmlFaculty
    });

    // Workshop team (your Gmail on cc)
    MailApp.sendEmail({
      to: SETTINGS.workshopEmail,
      cc: SETTINGS.myEmail,
      subject: "✅ Faculty Confirmed: " + name,
      body: name + " has confirmed their attendance.\n\nPhone: " + phone + "\nEmail: " + email + "\nSessions: " + sessionsStr
    });

    // Coordinators (from the CoordinatorList tab)
    if (sessionsStr) {
      var sessionArray = sessionsStr.split(",");
      var coordSheet = SpreadsheetApp.openById(SETTINGS.sheetId).getSheetByName("CoordinatorList");

      if (coordSheet) {
        var coordData = coordSheet.getDataRange().getValues();
        var emailed = [];

        for (var j = 0; j < sessionArray.length; j++) {
          var sessId = sessionArray[j].trim();

          for (var k = 1; k < coordData.length; k++) {
            if (String(coordData[k][0]).trim() === sessId) {
              var cEmail = String(coordData[k][1] || "").trim();
              var cName = String(coordData[k][2] || "Coordinator").trim();

              if (cEmail && cEmail.indexOf("@") > 0 && emailed.indexOf(cEmail) === -1) {
                var coordHtml = "<div style='font-family: Arial, sans-serif;'>";
                coordHtml += "<p><strong>Dear " + cName + ",</strong></p>";
                coordHtml += "<p><strong>" + name + "</strong> has successfully confirmed their participation for your session: <strong>" + sessId + "</strong>.</p>";
                coordHtml += "<p>Phone: " + phone + "<br>Email: " + email + "</p>";

                MailApp.sendEmail({
                  to: cEmail,
                  subject: "✅ Faculty Confirmed: " + name + " (" + sessId + ")",
                  body: name + " has confirmed for your session: " + sessId,
                  htmlBody: coordHtml
                });
                emailed.push(cEmail);
              }
            }
          }
        }
      }
    }
  }
}

// ==========================================
// 4. REMINDERS (run daily by a time trigger)
// ==========================================
function sendReminders() {
  var sh = getLogSheet();
  var values = sh.getDataRange().getValues();
  var now = new Date().getTime();
  var limitMs = SETTINGS.reminderAfterDays * 24 * 60 * 60 * 1000;

  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var status = String(r[6]).trim();
    if (status !== "Sent") continue;     // already confirmed / declined
    if (r[7]) continue;                  // reminder already sent

    var sentAt = new Date(r[0]);
    if (isNaN(sentAt.getTime()) || (now - sentAt.getTime()) < limitMs) continue;

    if (MailApp.getRemainingDailyQuota() < 1) {
      Logger.log("Daily email quota reached. Remaining reminders will go out tomorrow.");
      break;
    }

    try {
      sendReminderEmail(String(r[1]), String(r[2]), String(r[4]), String(r[5]), sentAt);
      sh.getRange(i + 1, 8).setValue(new Date());
    } catch (err) {
      Logger.log("Reminder failed for " + r[2] + ": " + err);
    }
  }
}

function sendReminderEmail(name, email, sessions, link, sentAt) {
  var sentStr = Utilities.formatDate(sentAt, Session.getScriptTimeZone(), "dd MMM yyyy");

  var html = "<div style='font-family: Arial, sans-serif; font-size:14px; line-height:1.6; color:#333;'>" +
    "<p><strong>Dear " + esc(name) + ",</strong></p>" +
    "<p>This is a gentle reminder. We emailed you your scientific commitment details for " +
    "<strong>DERMACON International 2027</strong> on " + esc(sentStr) + ", and we have not yet received your confirmation.</p>" +
    (sessions ? "<p><strong>Your session(s):</strong> " + esc(sessions.replace(/,/g, ', ')) + "</p>" : "") +
    "<p>Please confirm your participation using the button below. It takes less than a minute.</p>" +
    "<p style='margin:22px 0;'><a href='" + link + "' style='background:#4a2c6e; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:4px; font-weight:bold;'>Confirm participation</a></p>" +
    "<p>If you have any difficulty, please reply to this email.</p>" +
    "<p>Warm regards,<br><strong>DERMACON International 2027</strong></p></div>";

  MailApp.sendEmail({
    to: email,
    subject: "[Reminder] [DERMACON International 2027] Please confirm your participation - " + name,
    body: "Dear " + name + ",\n\nThis is a gentle reminder. We have not yet received your confirmation for DERMACON International 2027.\n\nPlease confirm here: " + link,
    htmlBody: html
  });
}

// Run this ONCE from the editor to schedule the daily reminder check (10 AM)
function createReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(10).create();
  Logger.log("Daily reminder trigger created.");
}
function createFormSubmitTrigger() {
  var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
  var triggers = ScriptApp.getUserTriggers(ss);
  
  // Check if the trigger already exists to prevent duplicates
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      Logger.log("Trigger already exists.");
      return;
    }
  }
  
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
    
  Logger.log("Successfully created onFormSubmit trigger.");
}
function doGet(e) {
  var ss = SpreadsheetApp.openById(SETTINGS.sheetId);
  var sheet = ss.getSheetByName("EmailLog");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({ confirmed: [] }));

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return ContentService.createTextOutput(JSON.stringify({ confirmed: [] }));

  // Find column indexes dynamically
  var headers = data[0];
  var iEmail = headers.indexOf("Email");
  var iStatus = headers.indexOf("Status");

  var confirmed = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iStatus]).trim().toLowerCase() === "confirmed") {
      confirmed.push(String(data[i][iEmail]).trim().toLowerCase());
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ confirmed: confirmed }))
    .setMimeType(ContentService.MimeType.JSON);
}