// ==========================================
// 1. SETTINGS
// ==========================================
var SETTINGS = {
  sheetId: "1HUvUnGC7G9Kab-cHTW0WYAI41dK9bhuOy5tGq0f_NDM",
  myEmail: "druzzaif@gmail.com",
  formBaseUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdxz_5YnX30AkhVuTEBYiTjAU5Ps38Qa_-Fx-uQS3fbG1cWcg/viewform",
  entryName: "entry.640056832",
  entryPhone: "entry.778392849",
  entrySessions: "entry.1359171350",

  // Google Drive file IDs of the images (used as inline images in the email)
  images: {
    iadvl:    "1wMw8YXdv0CqtKVF1YSvCoQTzrRq9oK3R",  // IADVL logo
    dermacon: "18O31LHEMdrDw2MGTwW_jlsI_kudIzo8P",  // DERMACON logo
    sigKrina: "1kj3CC54PbE-tixvnKu8hni1jAb14BFRs",  // Dr Krina Patel
    sigRanjan:"1vBnl3lg7OW_V_BKUdWEhu8LmlLJ3hFH3",  // Dr Ranjan Raval
    sigJagdish:"1YnfUTVnzQ2A4GDM-csACA28KjzLnmevd", // Dr Jagdish Sakhiya
    sigKandarp:"1qVJd9oAvZJT1SA4uo5c24yYDLt9IMHsk"  // Dr Kandarp Pandya
  }
};

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

// Replace {{Key}} placeholders safely (values are not treated as regex patterns)
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
// Public image URL for a Drive file (no attachment needed)
function driveImgUrl(fileId) {
  return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w600";
}
// Load all Drive images as inline-image blobs. One bad image will not stop the email.
function loadInlineImages() {
  var out = {};
  for (var key in SETTINGS.images) {
    if (!SETTINGS.images.hasOwnProperty(key)) continue;
    try {
      out[key] = DriveApp.getFileById(SETTINGS.images[key]).getBlob().setName(key);
    } catch (err) {
      Logger.log("Image failed: " + key + " -> " + err);
    }
  }
  return out;
}

// ==========================================
// 2. DO POST (Called from Next.js)
// ==========================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === "sendFormLink") {

      // 1. Build the pre-filled Google Form link
      var prefilledLink = SETTINGS.formBaseUrl + "?usp=pp_url" +
        "&" + SETTINGS.entryName + "=" + encodeURIComponent(data.name) +
        "&" + SETTINGS.entryPhone + "=" + encodeURIComponent(data.phone) +
        "&" + SETTINGS.entrySessions + "=" + encodeURIComponent(data.sessions);

      // 2. Load the HTML template (raw text)
      var template = HtmlService.createTemplateFromFile('Template').getRawContent();

      // 3. Find the loop markers (tolerant of spaces/case)
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
            CoordName:     esc(row.coordName || 'Scientific Committee'),
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
        LetterDate:  new Date().toLocaleDateString('en-GB')
      });

      htmlBody = htmlBody.replace('https://forms.gle/REPLACE_WITH_YOUR_GOOGLE_FORM_LINK', function () { return prefilledLink; });

      // 6. Point every cid:name image at its public Drive URL
      htmlBody = htmlBody.replace(/cid:(\w+)/g, function (match, key) {
        return SETTINGS.images[key] ? driveImgUrl(SETTINGS.images[key]) : match;
      });

      // 7. Send
            MailApp.sendEmail({
        to: data.email,
        subject: "[DERMACON International 2027] Scientific Commitments - " + data.name,
        body: "Dear " + data.name + ",\n\nYour scientific commitment details are included in this email.\n\nConfirm your attendance here: " + prefilledLink,
        htmlBody: htmlBody
      });

      return ContentService.createTextOutput(JSON.stringify({ status: "Success" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "Error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
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

    MailApp.sendEmail({
      to: SETTINGS.myEmail,
      subject: "✅ Faculty Confirmed: " + name,
      body: name + " (" + phone + ") has confirmed their attendance."
    });

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
// 4. ONE-TIME SETUP HELPERS (run once, then you may delete)
// ==========================================
// Run this once from the editor to grant Drive permission.
// Load all Drive images as inline-image blobs. Failures are collected, not hidden.
function loadInlineImages(errors) {
  var out = {};
  for (var key in SETTINGS.images) {
    if (!SETTINGS.images.hasOwnProperty(key)) continue;
    try {
      var blob = DriveApp.getFileById(SETTINGS.images[key]).getBlob();
      var type = blob.getContentType();
      if (!/^image\//.test(type)) {
        throw new Error("Not an image, type is " + type);
      }
      out[key] = blob.setName(key);
    } catch (err) {
      if (errors) errors.push(key + ": " + err);
      Logger.log("Image failed: " + key + " -> " + err);
    }
  }
  return out;
}

// Run this from the editor. It shows what loaded and what failed.
function authDrive() {
  var errors = [];
  var imgs = loadInlineImages(errors);
  Logger.log("LOADED: " + Object.keys(imgs).join(", "));
  Logger.log("FAILED: " + (errors.length ? errors.join(" | ") : "none"));
}

// Sends a small test email to yourself with all six images.
function testImageEmail() {
  var errors = [];
  var imgs = loadInlineImages(errors);
  var html = '<p>Image test</p>';
  for (var k in SETTINGS.images) {
    html += '<p>' + k + '<br><img src="cid:' + k + '" width="120"></p>';
  }
  MailApp.sendEmail({
    to: SETTINGS.myEmail,
    subject: "Image test",
    body: "Image test",
    htmlBody: html,
    inlineImages: imgs
  });
  Logger.log("Sent. Failed: " + (errors.length ? errors.join(" | ") : "none"));
}