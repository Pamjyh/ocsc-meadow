/**
 * OCSC Meadow (ทุ่งหญ้าเตรียมสอบ ก.พ.) — Google Apps Script Backend
 * -------------------------------------------------------------------
 * Responsibilities:
 *  1. setupDriveStructure() : Idempotently creates Google Drive folders & OCSC_Meadow_DB Sheet.
 *  2. doGet(e)              : Serves bootstrap, study doc HTML, interactive exam details, & user progress.
 *  3. doPost(e)             : Saves user progress with LockService, schema/size/clock-skew/LWW guards.
 *
 * Security & Reliability Guards:
 *  - isFileInsideFolder_() allowlist prevents reading arbitrary Drive files via action=doc.
 *  - safeCachePut_() prevents CacheService 100 KB limit exceptions.
 *  - EQUATION safe fallback prevents Google Docs math equations from crashing HTML conversion.
 *  - LockService.getScriptLock().tryLock(10000) prevents concurrent lost updates on UserProgress.
 *  - Payload size (<45 KB), schema (version === 1), clock skew (<= now + 5 min), and LWW checks.
 */

var PROP_KEYS = {
  ROOT_FOLDER_ID: 'OCSC_ROOT_FOLDER_ID',
  STUDY_ROOT_FOLDER_ID: 'OCSC_STUDY_ROOT_FOLDER_ID',
  PDF_ROOT_FOLDER_ID: 'OCSC_PDF_ROOT_FOLDER_ID',
  DB_SHEET_ID: 'OCSC_DB_SHEET_ID',
};

var MAX_CACHE_CHARS = 95000;
var MAX_RAW_POST_CHARS = 48000;
var MAX_PROGRESS_JSON_CHARS = 45000;
var MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
var MAX_FOLDER_DEPTH = 6;

var DEFAULT_SUBJECTS = [
  {
    code: 'analytical_math',
    title: 'คิดวิเคราะห์เชิงปริมาณ (คณิตศาสตร์)',
    shortTitle: 'คณิตฯ คิดวิเคราะห์',
    officialGroup: 'analytical',
    folderName: '01_คิดวิเคราะห์_คณิต',
    order: 1,
    passPercent: 60,
  },
  {
    code: 'analytical_thai',
    title: 'คิดวิเคราะห์เชิงภาษา (ภาษาไทย)',
    shortTitle: 'ภาษาไทย',
    officialGroup: 'analytical',
    folderName: '02_คิดวิเคราะห์_ไทย',
    order: 2,
    passPercent: 60,
  },
  {
    code: 'english',
    title: 'ภาษาอังกฤษ (English)',
    shortTitle: 'ภาษาอังกฤษ',
    officialGroup: 'english',
    folderName: '03_ภาษาอังกฤษ',
    order: 3,
    passPercent: 50,
  },
  {
    code: 'law',
    title: 'ความรู้และลักษณะการเป็นข้าราชการที่ดี (กฎหมาย ก.พ.)',
    shortTitle: 'กฎหมาย ก.พ.',
    officialGroup: 'law',
    folderName: '04_กฎหมาย_ข้าราชการที่ดี',
    order: 4,
    passPercent: 60,
  },
];

/* ============================================================================
 * 1. ONE-TIME SETUP (IDEMPOTENT)
 * ============================================================================ */

/**
 * Run this function ONCE from the Apps Script Editor to create the Drive folder
 * hierarchy and the OCSC_Meadow_DB Google Sheet, then store their IDs in ScriptProperties.
 * Safe to re-run: reuses existing folders/sheet if already present.
 */
function setupDriveStructure() {
  var props = PropertiesService.getScriptProperties();

  var rootFolder = getOrCreateFolderByProp_(
    props,
    PROP_KEYS.ROOT_FOLDER_ID,
    DriveApp.getRootFolder(),
    'OCSC_Meadow_Data'
  );

  var studyRoot = getOrCreateFolderByProp_(
    props,
    PROP_KEYS.STUDY_ROOT_FOLDER_ID,
    rootFolder,
    '01_Study_Content'
  );

  var pdfRoot = getOrCreateFolderByProp_(
    props,
    PROP_KEYS.PDF_ROOT_FOLDER_ID,
    rootFolder,
    '02_PDF_Exams'
  );

  for (var i = 0; i < DEFAULT_SUBJECTS.length; i++) {
    var subj = DEFAULT_SUBJECTS[i];
    var studySub = getOrCreateSubfolder_(studyRoot, subj.folderName);
    getOrCreateSubfolder_(pdfRoot, subj.folderName);

    // Create one starter Google Doc in Math folder if folder is empty
    if (subj.code === 'analytical_math' && !studySub.getFiles().hasNext()) {
      var doc = DocumentApp.create('01_อนุกรมและแบบรูปตัวเลข (ตัวอย่างเริ่มต้น)');
      var body = doc.getBody();
      body.appendParagraph('อนุกรมและแบบรูปตัวเลข').setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(
        'สามารถแก้ไขเอกสารนี้หรือสร้าง Google Doc ใหม่ในโฟลเดอร์นี้ได้ทันที หน้าเว็บจะดึงเนื้อหามาแสดงอัตโนมัติ'
      );
      body.appendParagraph('เทคนิคสำคัญที่ออกสอบ ก.พ. บ่อย').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendListItem('อนุกรมผลต่างหลายชั้น: ลบเลขติดกัน 2–3 ชั้นจนเห็นรูปแบบคงที่');
      body.appendListItem('อนุกรมสลับชุด: แยกดูตำแหน่งคี่กับตำแหน่งคู่เมื่อตัวเลขขึ้นลงสลับกัน');
      body.appendListItem('อนุกรมยกกำลัง: สังเกต n², n³ หรือ n² ± 1, n³ ± n');
      doc.saveAndClose();
      var docFile = DriveApp.getFileById(doc.getId());
      docFile.moveTo(studySub);
    }
  }

  var ss = getOrCreateDatabaseSheet_(props, rootFolder);
  initializeDatabaseTabs_(ss);

  Logger.log('=== OCSC Meadow Setup Complete ===');
  Logger.log('Root Folder: ' + rootFolder.getUrl());
  Logger.log('Study Content Folder: ' + studyRoot.getUrl());
  Logger.log('PDF Exams Folder: ' + pdfRoot.getUrl());
  Logger.log('Database Sheet: ' + ss.getUrl());
}

function getOrCreateFolderByProp_(props, propKey, parentFolder, folderName) {
  var savedId = props.getProperty(propKey);
  if (savedId) {
    try {
      var existing = DriveApp.getFolderById(savedId);
      if (!existing.isTrashed()) return existing;
    } catch (err) {
      // Fall through to search/create
    }
  }
  var folder = getOrCreateSubfolder_(parentFolder, folderName);
  props.setProperty(propKey, folder.getId());
  return folder;
}

function getOrCreateSubfolder_(parentFolder, folderName) {
  var it = parentFolder.getFoldersByName(folderName);
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed()) return f;
  }
  return parentFolder.createFolder(folderName);
}

function getOrCreateDatabaseSheet_(props, rootFolder) {
  var savedId = props.getProperty(PROP_KEYS.DB_SHEET_ID);
  if (savedId) {
    try {
      var existing = SpreadsheetApp.openById(savedId);
      if (!DriveApp.getFileById(savedId).isTrashed()) return existing;
    } catch (err) {
      // Fall through
    }
  }

  var files = rootFolder.getFilesByName('OCSC_Meadow_DB');
  while (files.hasNext()) {
    var file = files.next();
    if (!file.isTrashed() && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      props.setProperty(PROP_KEYS.DB_SHEET_ID, file.getId());
      return SpreadsheetApp.openById(file.getId());
    }
  }

  var ss = SpreadsheetApp.create('OCSC_Meadow_DB');
  DriveApp.getFileById(ss.getId()).moveTo(rootFolder);
  props.setProperty(PROP_KEYS.DB_SHEET_ID, ss.getId());
  return ss;
}

function initializeDatabaseTabs_(ss) {
  // 1. Config tab
  var configSheet = getOrCreateSheet_(ss, 'Config');
  if (configSheet.getLastRow() === 0) {
    var configRows = [
      ['key', 'value', 'note'],
      ['siteTitle', 'ทุ่งหญ้าเตรียมสอบ ก.พ.', 'ชื่อหน้าเว็บ'],
      ['learnerName', 'คนเก่ง', 'ชื่อเรียกผู้เรียนบนหน้าแรก'],
      ['examLabel', 'สอบ ก.พ. ภาค ก (ระดับปริญญาตรี)', 'ชื่อสนามสอบในการ์ดนับถอยหลัง'],
      ['examDateIso', '2027-07-04T09:00:00+07:00', 'วันสอบจริงรูปแบบ ISO +07:00'],
      [
        'encouragementMessage',
        'ค่อยๆ อ่านทีละนิด เก็บทีละข้อ เหนื่อยก็พักมองท้องฟ้าสีครามแล้วไปต่อด้วยกันนะ',
        'ข้อความให้กำลังใจบนหน้าแรก',
      ],
      ['pass_analytical', 60, 'เกณฑ์ผ่านวิชาคิดวิเคราะห์ (คณิต+ไทย) %'],
      ['pass_english', 50, 'เกณฑ์ผ่านวิชาภาษาอังกฤษ %'],
      ['pass_law', 60, 'เกณฑ์ผ่านวิชากฎหมายและข้าราชการที่ดี %'],
    ];
    configSheet.getRange(1, 1, configRows.length, 3).setValues(configRows);
    configSheet.setFrozenRows(1);
  }

  // 2. Exams tab
  var examsSheet = getOrCreateSheet_(ss, 'Exams');
  if (examsSheet.getLastRow() === 0) {
    var examRows = [
      ['id', 'subjectCode', 'title', 'description', 'durationMinutes', 'passPercent', 'order', 'published'],
      [
        'exam_math_sheet_01',
        'analytical_math',
        'ชุดตัวอย่างจาก Google Sheet: อนุกรมและร้อยละ',
        'เพิ่มชุดข้อสอบใหม่ได้ไม่จำกัดโดยเพิ่มแถวในแท็บ Exams และ Questions',
        15,
        60,
        1,
        true,
      ],
    ];
    examsSheet.getRange(1, 1, examRows.length, 8).setValues(examRows);
    examsSheet.setFrozenRows(1);
  }

  // 3. Questions tab
  var questionsSheet = getOrCreateSheet_(ss, 'Questions');
  if (questionsSheet.getLastRow() === 0) {
    var questionRows = [
      [
        'id',
        'examId',
        'order',
        'promptMd',
        'imageUrl',
        'choiceA',
        'choiceB',
        'choiceC',
        'choiceD',
        'correctChoice',
        'explanationMd',
        'explanationImageUrl',
      ],
      [
        'q_sheet_math_1',
        'exam_math_sheet_01',
        1,
        'จงหาตัวเลขถัดไปของอนุกรม: 4, 9, 19, 39, 79, ...',
        '',
        '139',
        '149',
        '159',
        '169',
        'C',
        'สังเกตผลต่างระหว่างพจน์ติดกัน: +5, +10, +20, +40 (เพิ่มขึ้นเป็น 2 เท่าทุกขั้น) ดังนั้นขั้นถัดไปคือ +80 → 79 + 80 = **159**',
        '',
      ],
    ];
    questionsSheet.getRange(1, 1, questionRows.length, 12).setValues(questionRows);
    questionsSheet.setFrozenRows(1);
  }

  // 4. UserProgress tab
  var progressSheet = getOrCreateSheet_(ss, 'UserProgress');
  if (progressSheet.getLastRow() === 0) {
    progressSheet.getRange(1, 1, 1, 3).setValues([['profileKey', 'updatedAt', 'payloadJson']]);
    progressSheet.setFrozenRows(1);
  }

  // Remove default empty Sheet1 if other tabs exist
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่นงาน1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}

function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  return ss.insertSheet(name);
}

/* ============================================================================
 * 2. HTTP GET ROUTER
 * ============================================================================ */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = String(params.action || 'bootstrap').trim();

    if (action === 'bootstrap') {
      return jsonResponse_(handleBootstrap_(params.nocache === '1'));
    }
    if (action === 'doc') {
      return jsonResponse_(handleGetStudyDoc_(String(params.id || '').trim()));
    }
    if (action === 'exam') {
      return jsonResponse_(handleGetExamDetail_(String(params.id || '').trim()));
    }
    if (action === 'progress') {
      return jsonResponse_(handleGetProgress_(sanitizeProfileKey_(params.key)));
    }
    if (action === 'clearCache') {
      CacheService.getScriptCache().remove('bootstrap_v1');
      return jsonResponse_({ ok: true, cleared: true });
    }

    return jsonResponse_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    Logger.log('doGet error: ' + err);
    return jsonResponse_({ ok: false, error: 'INTERNAL_ERROR' });
  }
}

/* ============================================================================
 * 3. HTTP POST ROUTER (PROGRESS SYNC WITH LOCK + GUARDS)
 * ============================================================================ */

function doPost(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = String(params.action || 'progress').trim();
    if (action !== 'progress') {
      return jsonResponse_({ ok: false, error: 'UNKNOWN_ACTION' });
    }

    var rawBody = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!rawBody || rawBody.length > MAX_RAW_POST_CHARS) {
      return jsonResponse_({ ok: false, error: 'PAYLOAD_TOO_LARGE' });
    }

    var parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch (parseErr) {
      return jsonResponse_({ ok: false, error: 'INVALID_JSON' });
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.progress || typeof parsed.progress !== 'object') {
      return jsonResponse_({ ok: false, error: 'INVALID_SCHEMA' });
    }

    var progress = parsed.progress;
    if (progress.version !== 1 || typeof progress.updatedAt !== 'string') {
      return jsonResponse_({ ok: false, error: 'INVALID_SCHEMA' });
    }

    var incomingMs = Date.parse(progress.updatedAt);
    if (!isFinite(incomingMs) || incomingMs > Date.now() + MAX_FUTURE_SKEW_MS) {
      return jsonResponse_({ ok: false, error: 'INVALID_TIMESTAMP' });
    }

    var payloadJson = JSON.stringify(progress);
    if (payloadJson.length > MAX_PROGRESS_JSON_CHARS) {
      return jsonResponse_({ ok: false, error: 'PAYLOAD_TOO_LARGE' });
    }

    var profileKey = sanitizeProfileKey_(parsed.key);
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return jsonResponse_({ ok: false, error: 'LOCK_TIMEOUT' });
    }

    try {
      var ss = getDatabaseSpreadsheet_();
      var sheet = getOrCreateSheet_(ss, 'UserProgress');
      var values = sheet.getDataRange().getValues();
      var targetRow = -1;
      var existingCell = '';

      for (var r = 1; r < values.length; r++) {
        if (String(values[r][0]).trim() === profileKey) {
          targetRow = r + 1;
          existingCell = values[r][1];
          break;
        }
      }

      if (targetRow !== -1 && existingCell) {
        var existingMs =
          existingCell instanceof Date
            ? existingCell.getTime()
            : Date.parse(String(existingCell));
        if (isFinite(existingMs) && existingMs > incomingMs) {
          return jsonResponse_({
            ok: true,
            skipped: 'STALE_TIMESTAMP',
            serverUpdatedAt:
              existingCell instanceof Date ? existingCell.toISOString() : String(existingCell),
          });
        }
      }

      var rowData = [[profileKey, progress.updatedAt, payloadJson]];
      if (targetRow !== -1) {
        sheet.getRange(targetRow, 1, 1, 3).setValues(rowData);
      } else {
        sheet.appendRow(rowData[0]);
      }

      return jsonResponse_({ ok: true, updatedAt: progress.updatedAt });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonResponse_({ ok: false, error: 'INTERNAL_ERROR' });
  }
}

/* ============================================================================
 * 4. HANDLERS
 * ============================================================================ */

function handleBootstrap_(bypassCache) {
  var cache = CacheService.getScriptCache();
  if (!bypassCache) {
    var cached = cache.get('bootstrap_v1');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        // Ignore corrupt cache and rebuild
      }
    }
  }

  var ss = getDatabaseSpreadsheet_();
  var config = readConfig_(ss);
  var subjectMap = buildBaseSubjectMap_(config.passThresholds);

  var studyRoot = getRequiredFolder_(PROP_KEYS.STUDY_ROOT_FOLDER_ID);
  var pdfRoot = getRequiredFolder_(PROP_KEYS.PDF_ROOT_FOLDER_ID);

  var studyItems = scanStudyFolder_(studyRoot, subjectMap);
  var pdfExams = scanPdfFolder_(pdfRoot, subjectMap);
  var exams = readExamsMeta_(ss, subjectMap);

  var subjects = [];
  for (var key in subjectMap) {
    if (Object.prototype.hasOwnProperty.call(subjectMap, key)) {
      subjects.push(subjectMap[key]);
    }
  }
  subjects.sort(function (a, b) {
    return a.order - b.order;
  });

  var payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    config: config,
    subjects: subjects,
    studyItems: studyItems,
    exams: exams,
    pdfExams: pdfExams,
  };

  safeCachePut_(cache, 'bootstrap_v1', JSON.stringify(payload), 300);
  return payload;
}

function handleGetStudyDoc_(docId) {
  if (!docId || !/^[a-zA-Z0-9_-]{10,120}$/.test(docId)) {
    return { ok: false, error: 'INVALID_DOC_ID' };
  }

  var studyRootId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.STUDY_ROOT_FOLDER_ID);
  if (!studyRootId) {
    return { ok: false, error: 'NOT_INITIALIZED' };
  }

  var file;
  try {
    file = DriveApp.getFileById(docId);
  } catch (err) {
    return { ok: false, error: 'DOC_NOT_FOUND' };
  }

  // SECURITY ALLOWLIST GUARD: Only allow Google Docs inside 01_Study_Content
  if (
    file.isTrashed() ||
    file.getMimeType() !== MimeType.GOOGLE_DOCS ||
    !isFileInsideFolder_(file, studyRootId)
  ) {
    return { ok: false, error: 'FORBIDDEN_FILE' };
  }

  var updatedIso = file.getLastUpdated().toISOString();
  var cacheKey = 'doc_' + docId + '_' + file.getLastUpdated().getTime();
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // Rebuild below
    }
  }

  var doc = DocumentApp.openById(docId);
  var html = convertDocBodyToHtml_(doc.getBody());
  var result = {
    ok: true,
    id: docId,
    title: stripNumericPrefix_(file.getName()),
    updatedAt: updatedIso,
    html: html,
  };

  safeCachePut_(cache, cacheKey, JSON.stringify(result), 600);
  return result;
}

function handleGetExamDetail_(examId) {
  if (!examId) {
    return { ok: false, error: 'INVALID_EXAM_ID' };
  }

  var ss = getDatabaseSpreadsheet_();
  var config = readConfig_(ss);
  var subjectMap = buildBaseSubjectMap_(config.passThresholds);
  var allExams = readExamsMeta_(ss, subjectMap);
  var exam = null;

  for (var i = 0; i < allExams.length; i++) {
    if (allExams[i].id === examId) {
      exam = allExams[i];
      break;
    }
  }

  if (!exam) {
    return { ok: false, error: 'EXAM_NOT_FOUND' };
  }

  var questions = readQuestionsForExam_(ss, examId);
  exam.questionCount = questions.length;

  return {
    ok: true,
    exam: exam,
    questions: questions,
  };
}

function handleGetProgress_(profileKey) {
  var ss = getDatabaseSpreadsheet_();
  var sheet = ss.getSheetByName('UserProgress');
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: true, progress: null };
  }

  var values = sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === profileKey) {
      var raw = String(values[r][2] || '').trim();
      if (!raw) return { ok: true, progress: null };
      try {
        return { ok: true, progress: JSON.parse(raw) };
      } catch (err) {
        return { ok: true, progress: null };
      }
    }
  }
  return { ok: true, progress: null };
}

/* ============================================================================
 * 5. DATA READERS & DRIVE SCANNERS
 * ============================================================================ */

function readConfig_(ss) {
  var sheet = ss.getSheetByName('Config');
  var kv = {};
  if (sheet && sheet.getLastRow() >= 2) {
    var rows = sheet.getDataRange().getValues();
    for (var r = 1; r < rows.length; r++) {
      var k = String(rows[r][0] || '').trim();
      if (k) kv[k] = rows[r][1];
    }
  }

  return {
    siteTitle: String(kv.siteTitle || 'ทุ่งหญ้าเตรียมสอบ ก.พ.'),
    learnerName: String(kv.learnerName || 'คนเก่ง'),
    examLabel: String(kv.examLabel || 'สอบ ก.พ. ภาค ก (ระดับปริญญาตรี)'),
    examDateIso:
      kv.examDateIso instanceof Date
        ? kv.examDateIso.toISOString()
        : String(kv.examDateIso || '2027-07-04T09:00:00+07:00').trim(),
    encouragementMessage: String(
      kv.encouragementMessage ||
        'ค่อยๆ อ่านทีละนิด เก็บทีละข้อ เหนื่อยก็พักมองท้องฟ้าสีครามแล้วไปต่อด้วยกันนะ'
    ),
    passThresholds: {
      analytical: parsePercent_(kv.pass_analytical, 60),
      english: parsePercent_(kv.pass_english, 50),
      law: parsePercent_(kv.pass_law, 60),
    },
  };
}

function buildBaseSubjectMap_(thresholds) {
  var map = {};
  for (var i = 0; i < DEFAULT_SUBJECTS.length; i++) {
    var s = DEFAULT_SUBJECTS[i];
    var pass =
      s.officialGroup === 'english'
        ? thresholds.english
        : s.officialGroup === 'law'
        ? thresholds.law
        : thresholds.analytical;
    map[s.code] = {
      code: s.code,
      title: s.title,
      shortTitle: s.shortTitle,
      officialGroup: s.officialGroup,
      folderName: s.folderName,
      order: s.order,
      passPercent: pass,
    };
  }
  return map;
}

function resolveSubjectFromFolder_(folderName, subjectMap) {
  for (var code in subjectMap) {
    if (
      Object.prototype.hasOwnProperty.call(subjectMap, code) &&
      subjectMap[code].folderName === folderName
    ) {
      return code;
    }
  }
  // Custom subject folder fallback (slugified, default 60% pass threshold)
  var slug = slugifyFolderName_(folderName);
  if (!subjectMap[slug]) {
    var cleanTitle = stripNumericPrefix_(folderName);
    subjectMap[slug] = {
      code: slug,
      title: cleanTitle,
      shortTitle: cleanTitle,
      officialGroup: 'analytical',
      folderName: folderName,
      order: Object.keys(subjectMap).length + 1,
      passPercent: 60,
    };
  }
  return slug;
}

function scanStudyFolder_(studyRoot, subjectMap) {
  var items = [];
  var folders = studyRoot.getFolders();
  while (folders.hasNext()) {
    var folder = folders.next();
    if (folder.isTrashed()) continue;
    var subjectCode = resolveSubjectFromFolder_(folder.getName(), subjectMap);
    var files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
    while (files.hasNext()) {
      var file = files.next();
      if (file.isTrashed()) continue;
      var rawName = file.getName();
      items.push({
        id: file.getId(),
        subjectCode: subjectCode,
        title: stripNumericPrefix_(rawName),
        summary: String(file.getDescription() || '').trim(),
        order: extractLeadingNumber_(rawName, 999),
        updatedAt: file.getLastUpdated().toISOString(),
      });
    }
  }
  items.sort(compareByOrderAndTitle_);
  return items;
}

function scanPdfFolder_(pdfRoot, subjectMap) {
  var items = [];
  var folders = pdfRoot.getFolders();
  while (folders.hasNext()) {
    var folder = folders.next();
    if (folder.isTrashed()) continue;
    var subjectCode = resolveSubjectFromFolder_(folder.getName(), subjectMap);
    var files = folder.getFilesByType(MimeType.PDF);
    while (files.hasNext()) {
      var file = files.next();
      if (file.isTrashed()) continue;
      var id = file.getId();
      var rawName = file.getName().replace(/\.pdf$/i, '');
      items.push({
        id: id,
        subjectCode: subjectCode,
        title: stripNumericPrefix_(rawName),
        description: String(file.getDescription() || 'ข้อสอบ PDF พร้อมเฉลยท้ายชุด').trim(),
        order: extractLeadingNumber_(rawName, 999),
        previewUrl: 'https://drive.google.com/file/d/' + id + '/preview',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + id,
        updatedAt: file.getLastUpdated().toISOString(),
      });
    }
  }
  items.sort(compareByOrderAndTitle_);
  return items;
}

function readExamsMeta_(ss, subjectMap) {
  var examsSheet = ss.getSheetByName('Exams');
  if (!examsSheet || examsSheet.getLastRow() < 2) return [];

  var questionCounts = {};
  var qSheet = ss.getSheetByName('Questions');
  if (qSheet && qSheet.getLastRow() >= 2) {
    var qRows = qSheet.getDataRange().getValues();
    for (var q = 1; q < qRows.length; q++) {
      var qExamId = String(qRows[q][1] || '').trim();
      var qPrompt = String(qRows[q][3] || '').trim();
      if (qExamId && qPrompt) {
        questionCounts[qExamId] = (questionCounts[qExamId] || 0) + 1;
      }
    }
  }

  var rows = examsSheet.getDataRange().getValues();
  var exams = [];
  for (var r = 1; r < rows.length; r++) {
    var id = String(rows[r][0] || '').trim();
    var subjectCode = String(rows[r][1] || '').trim();
    var title = String(rows[r][2] || '').trim();
    if (!id || !subjectCode || !title) continue;

    var publishedRaw = rows[r][7];
    if (publishedRaw === false || String(publishedRaw).toLowerCase() === 'false' || publishedRaw === 0) {
      continue;
    }

    var defaultPass = subjectMap[subjectCode] ? subjectMap[subjectCode].passPercent : 60;
    exams.push({
      id: id,
      subjectCode: subjectCode,
      title: title,
      description: String(rows[r][3] || '').trim(),
      durationMinutes: Math.max(1, Number(rows[r][4]) || 15),
      passPercent: parsePercent_(rows[r][5], defaultPass),
      questionCount: questionCounts[id] || 0,
      order: Number(rows[r][6]) || r,
    });
  }

  exams.sort(function (a, b) {
    return a.order - b.order;
  });
  return exams;
}

function readQuestionsForExam_(ss, examId) {
  var sheet = ss.getSheetByName('Questions');
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rows = sheet.getDataRange().getValues();
  var questions = [];
  for (var r = 1; r < rows.length; r++) {
    var rowExamId = String(rows[r][1] || '').trim();
    if (rowExamId !== examId) continue;

    var id = String(rows[r][0] || '').trim() || examId + '_q_' + r;
    var promptMd = String(rows[r][3] || '').trim();
    if (!promptMd) continue;

    var correct = String(rows[r][9] || 'A').trim().toUpperCase();
    if (correct !== 'A' && correct !== 'B' && correct !== 'C' && correct !== 'D') {
      correct = 'A';
    }

    var qObj = {
      id: id,
      examId: examId,
      order: Number(rows[r][2]) || questions.length + 1,
      promptMd: promptMd,
      choices: {
        A: String(rows[r][5] || '').trim(),
        B: String(rows[r][6] || '').trim(),
        C: String(rows[r][7] || '').trim(),
        D: String(rows[r][8] || '').trim(),
      },
      correctChoice: correct,
      explanationMd: String(rows[r][10] || '').trim(),
    };

    var imageUrl = sanitizeExternalUrl_(String(rows[r][4] || '').trim());
    if (imageUrl) qObj.imageUrl = imageUrl;

    var expImageUrl = sanitizeExternalUrl_(String(rows[r][11] || '').trim());
    if (expImageUrl) qObj.explanationImageUrl = expImageUrl;

    questions.push(qObj);
  }

  questions.sort(function (a, b) {
    return a.order - b.order;
  });
  return questions;
}

/* ============================================================================
 * 6. GOOGLE DOCS -> CLEAN HTML CONVERTER (WITH EQUATION SAFE FALLBACK)
 * ============================================================================ */

function convertDocBodyToHtml_(body) {
  var parts = [];
  var numChildren = body.getNumChildren();
  var activeListTag = null;

  function closeList_() {
    if (activeListTag) {
      parts.push('</' + activeListTag + '>');
      activeListTag = null;
    }
  }

  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    var type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      closeList_();
      var para = child.asParagraph();
      var innerHtml = renderParagraphChildren_(para);
      if (!innerHtml.trim()) continue;
      var tag = headingToTag_(para.getHeading());
      parts.push('<' + tag + '>' + innerHtml + '</' + tag + '>');
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var listItem = child.asListItem();
      var glyph = listItem.getGlyphType();
      var isOrdered =
        glyph === DocumentApp.GlyphType.NUMBER ||
        glyph === DocumentApp.GlyphType.LATIN_LOWER ||
        glyph === DocumentApp.GlyphType.LATIN_UPPER ||
        glyph === DocumentApp.GlyphType.ROMAN_LOWER ||
        glyph === DocumentApp.GlyphType.ROMAN_UPPER;
      var neededTag = isOrdered ? 'ol' : 'ul';
      if (activeListTag !== neededTag) {
        closeList_();
        activeListTag = neededTag;
        parts.push('<' + activeListTag + '>');
      }
      parts.push('<li>' + renderParagraphChildren_(listItem) + '</li>');
    } else if (type === DocumentApp.ElementType.TABLE) {
      closeList_();
      parts.push(renderTable_(child.asTable()));
    } else if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      closeList_();
      parts.push('<hr>');
    }
  }

  closeList_();
  return parts.join('\n');
}

function renderParagraphChildren_(container) {
  var out = [];
  var count = container.getNumChildren();
  for (var i = 0; i < count; i++) {
    var el = container.getChild(i);
    var t = el.getType();
    if (t === DocumentApp.ElementType.TEXT) {
      out.push(renderStyledText_(el.asText()));
    } else if (t === DocumentApp.ElementType.EQUATION) {
      // Safe fallback: extract plain text inside Google Docs Equation objects
      out.push('<code>' + escapeHtml_(extractEquationText_(el)) + '</code>');
    } else if (t === DocumentApp.ElementType.INLINE_IMAGE) {
      // Skip oversized inline images to keep payload & cache fast
      out.push('<em>[ภาพประกอบในเอกสารต้นฉบับ]</em>');
    }
  }
  return out.join('');
}

function renderStyledText_(textEl) {
  var full = textEl.getText();
  if (!full) return '';

  var indices = textEl.getTextAttributeIndices();
  var out = [];
  for (var i = 0; i < indices.length; i++) {
    var start = indices[i];
    var end = i + 1 < indices.length ? indices[i + 1] : full.length;
    var slice = full.substring(start, end);
    if (!slice) continue;

    var chunk = escapeHtml_(slice).replace(/\n/g, '<br>');
    var bold = textEl.isBold(start);
    var italic = textEl.isItalic(start);
    var underline = textEl.isUnderline(start);
    var link = sanitizeExternalUrl_(textEl.getLinkUrl(start) || '');

    if (bold) chunk = '<strong>' + chunk + '</strong>';
    if (italic) chunk = '<em>' + chunk + '</em>';
    if (underline && !link) chunk = '<u>' + chunk + '</u>';
    if (link) {
      chunk =
        '<a href="' +
        escapeHtml_(link) +
        '" target="_blank" rel="noopener noreferrer">' +
        chunk +
        '</a>';
    }
    out.push(chunk);
  }
  return out.join('');
}

function extractEquationText_(element) {
  try {
    if (typeof element.getText === 'function') {
      return element.getText() || '';
    }
    if (typeof element.getNumChildren === 'function') {
      var parts = [];
      for (var i = 0; i < element.getNumChildren(); i++) {
        parts.push(extractEquationText_(element.getChild(i)));
      }
      return parts.join('');
    }
  } catch (err) {
    return '[สมการ]';
  }
  return '';
}

function renderTable_(table) {
  var rowsHtml = [];
  var numRows = table.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var row = table.getRow(r);
    var cellsHtml = [];
    var cellTag = r === 0 ? 'th' : 'td';
    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      var cellParts = [];
      for (var p = 0; p < cell.getNumChildren(); p++) {
        var child = cell.getChild(p);
        var childType = child.getType();
        if (childType === DocumentApp.ElementType.PARAGRAPH) {
          cellParts.push(renderParagraphChildren_(child.asParagraph()));
        } else if (childType === DocumentApp.ElementType.LIST_ITEM) {
          cellParts.push('• ' + renderParagraphChildren_(child.asListItem()));
        }
      }
      cellsHtml.push('<' + cellTag + '>' + cellParts.join('<br>') + '</' + cellTag + '>');
    }
    rowsHtml.push('<tr>' + cellsHtml.join('') + '</tr>');
  }
  return '<table><tbody>' + rowsHtml.join('') + '</tbody></table>';
}

function headingToTag_(heading) {
  if (heading === DocumentApp.ParagraphHeading.TITLE || heading === DocumentApp.ParagraphHeading.HEADING1) {
    return 'h2';
  }
  if (heading === DocumentApp.ParagraphHeading.HEADING2) return 'h3';
  if (heading === DocumentApp.ParagraphHeading.HEADING3 || heading === DocumentApp.ParagraphHeading.HEADING4) {
    return 'h4';
  }
  return 'p';
}

/* ============================================================================
 * 7. SECURITY & UTILITY HELPERS
 * ============================================================================ */

/**
 * Walks parent folders upward (up to MAX_FOLDER_DEPTH) to guarantee that `file`
 * lives strictly inside `allowedFolderId`. Prevents arbitrary Drive ID access.
 */
function isFileInsideFolder_(file, allowedFolderId) {
  var visited = {};
  var queue = [];
  var parents = file.getParents();
  while (parents.hasNext()) {
    queue.push({ folder: parents.next(), depth: 1 });
  }

  while (queue.length > 0) {
    var current = queue.shift();
    var folderId = current.folder.getId();
    if (folderId === allowedFolderId) return true;
    if (visited[folderId] || current.depth >= MAX_FOLDER_DEPTH) continue;
    visited[folderId] = true;

    var up = current.folder.getParents();
    while (up.hasNext()) {
      queue.push({ folder: up.next(), depth: current.depth + 1 });
    }
  }
  return false;
}

function safeCachePut_(cache, key, value, ttlSeconds) {
  if (!value || value.length > MAX_CACHE_CHARS) return;
  try {
    cache.put(key, value, ttlSeconds);
  } catch (err) {
    // Non-fatal: skip caching when payload exceeds Apps Script quota
  }
}

function getDatabaseSpreadsheet_() {
  var sheetId = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.DB_SHEET_ID);
  if (!sheetId) {
    throw new Error('OCSC_DB_SHEET_ID not initialized. Run setupDriveStructure() first.');
  }
  return SpreadsheetApp.openById(sheetId);
}

function getRequiredFolder_(propKey) {
  var id = PropertiesService.getScriptProperties().getProperty(propKey);
  if (!id) {
    throw new Error(propKey + ' not initialized. Run setupDriveStructure() first.');
  }
  return DriveApp.getFolderById(id);
}

function sanitizeProfileKey_(raw) {
  var cleaned = String(raw || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.slice(0, 64) || 'default';
}

function sanitizeExternalUrl_(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return '';
}

function parsePercent_(val, fallback) {
  var num = Number(val);
  if (!isFinite(num) || num < 1 || num > 100) return fallback;
  return Math.round(num);
}

function stripNumericPrefix_(name) {
  return String(name || '')
    .replace(/^\d+[\s._-]+/, '')
    .trim();
}

function extractLeadingNumber_(name, fallback) {
  var match = String(name || '').match(/^(\d+)/);
  return match ? Number(match[1]) : fallback;
}

function slugifyFolderName_(name) {
  var clean = stripNumericPrefix_(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'custom_subject';
}

function compareByOrderAndTitle_(a, b) {
  if (a.order !== b.order) return a.order - b.order;
  return String(a.title).localeCompare(String(b.title), 'th');
}

function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
