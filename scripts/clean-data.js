/**
 * Clean all student/teacher data except teacher1 and 米奇.
 * Run with: node scripts/clean-data.js
 *
 * Keeps:
 *   teacher1: user-1784783759910
 *   米奇:     user-1784775111202
 *
 * Safe to re-run — idempotent.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEEP_IDS = new Set([
  'user-1784783759910', // teacher1
  'user-1784775111202', // 米奇
]);

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  if (typeof data === 'string') {
    fs.writeFileSync(tmp, data, 'utf-8');
  } else {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  }
  fs.renameSync(tmp, filePath);
}

function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`  ERROR reading ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

function backupFile(filePath) {
  const bakPath = filePath + '.bak';
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, bakPath);
    console.log(`  Backed up: ${path.basename(filePath)} -> ${path.basename(bakPath)}`);
  }
}

// ===== 1. users.json =====
console.log('\n1. Processing users.json...');
const usersFile = path.join(DATA_DIR, 'users.json');
backupFile(usersFile);
const users = readJSON(usersFile);
if (users) {
  const cleaned = users.filter(u => KEEP_IDS.has(u.id));
  console.log(`  Before: ${users.length} users  →  After: ${cleaned.length} users`);
  cleaned.forEach(u => console.log(`    Keeping: ${u.username} (${u.id}, ${u.role})`));
  atomicWrite(usersFile, cleaned);
}

// ===== 2. bindings.json =====
console.log('\n2. Processing bindings.json...');
const bindingsFile = path.join(DATA_DIR, 'bindings.json');
backupFile(bindingsFile);
const bindings = readJSON(bindingsFile);
if (bindings) {
  const cleaned = {};
  for (const [teacherId, studentIds] of Object.entries(bindings)) {
    if (KEEP_IDS.has(teacherId)) {
      const keptStudents = studentIds.filter(sid => KEEP_IDS.has(sid));
      if (keptStudents.length > 0) {
        cleaned[teacherId] = keptStudents;
      }
    }
  }
  console.log(`  Before: ${Object.keys(bindings).length} teachers  →  After: ${Object.keys(cleaned).length} teachers`);
  for (const [tid, sids] of Object.entries(cleaned)) {
    console.log(`    Keeping: ${tid} -> [${sids.join(', ')}]`);
  }
  atomicWrite(bindingsFile, cleaned);
}

// ===== 3. sessions.json =====
console.log('\n3. Processing sessions.json...');
const sessionsFile = path.join(DATA_DIR, 'sessions.json');
backupFile(sessionsFile);
const sessions = readJSON(sessionsFile);
if (sessions) {
  const beforeCount = Object.keys(sessions).length;
  const cleaned = {};
  for (const [token, session] of Object.entries(sessions)) {
    if (KEEP_IDS.has(session.userId)) {
      cleaned[token] = session;
    }
  }
  const afterCount = Object.keys(cleaned).length;
  console.log(`  Before: ${beforeCount} sessions  →  After: ${afterCount} sessions`);
  atomicWrite(sessionsFile, cleaned);
}

// ===== 4. history.json =====
console.log('\n4. Processing history.json...');
const historyFile = path.join(DATA_DIR, 'history.json');
backupFile(historyFile);
const history = readJSON(historyFile);
if (history) {
  const beforeCount = history.length;
  const cleaned = history.filter(h => KEEP_IDS.has(h.userId));
  const afterCount = cleaned.length;
  console.log(`  Before: ${beforeCount} entries  →  After: ${afterCount} entries`);

  if (cleaned.length === 0) {
    // writeHistory in app.js won't write empty arrays, but we're directly editing the file
    console.log('  WARNING: No history entries remain! writeHistory() will refuse to save later.');
  }
  atomicWrite(historyFile, cleaned);
}

// ===== 5. journal.json =====
console.log('\n5. Processing journal.json...');
const journalFile = path.join(DATA_DIR, 'journal.json');
backupFile(journalFile);
const journal = readJSON(journalFile);
if (journal) {
  const beforeCount = journal.length;
  const cleaned = journal.filter(j => KEEP_IDS.has(j.userId));
  const afterCount = cleaned.length;
  console.log(`  Before: ${beforeCount} entries  →  After: ${afterCount} entries`);
  atomicWrite(journalFile, cleaned);
}

// ===== 6. teacher-insight-reviews.json =====
console.log('\n6. Processing teacher-insight-reviews.json...');
const reviewsFile = path.join(DATA_DIR, 'teacher-insight-reviews.json');
backupFile(reviewsFile);
const reviews = readJSON(reviewsFile);
if (reviews) {
  const beforeCount = reviews.length;
  const cleaned = reviews.filter(r =>
    KEEP_IDS.has(r.studentId) && KEEP_IDS.has(r.teacherId)
  );
  const afterCount = cleaned.length;
  console.log(`  Before: ${beforeCount} entries  →  After: ${afterCount} entries`);
  atomicWrite(reviewsFile, cleaned);
}

// ===== 7. teacher-report-narratives.json =====
console.log('\n7. Processing teacher-report-narratives.json...');
const narrativesFile = path.join(DATA_DIR, 'teacher-report-narratives.json');
backupFile(narrativesFile);
const narratives = readJSON(narrativesFile);
if (narratives) {
  const beforeCount = narratives.length;
  const cleaned = narratives.filter(n => KEEP_IDS.has(n.studentId));
  const afterCount = cleaned.length;
  console.log(`  Before: ${beforeCount} entries  →  After: ${afterCount} entries`);
  cleaned.forEach(n => console.log(`    Keeping: studentId=${n.studentId}, versions=${n.aiGeneratedVersions?.length || 0}`));
  atomicWrite(narrativesFile, cleaned);
}

// ===== 8. teacher-binding-invitations.json =====
console.log('\n8. Processing teacher-binding-invitations.json...');
const invFile = path.join(DATA_DIR, 'teacher-binding-invitations.json');
backupFile(invFile);
const invs = readJSON(invFile);
if (invs) {
  console.log(`  Before: ${invs.length} entries  →  After: 0 entries`);
  atomicWrite(invFile, []);
}

// ===== 9. teacher-binding-audit.jsonl =====
console.log('\n9. Processing teacher-binding-audit.jsonl...');
const auditFile = path.join(DATA_DIR, 'teacher-binding-audit.jsonl');
backupFile(auditFile);
if (fs.existsSync(auditFile)) {
  const lines = fs.readFileSync(auditFile, 'utf-8').split('\n').filter(l => l.trim());
  const beforeCount = lines.length;
  // Keep only audit lines involving teacher1 or 米奇
  const cleaned = lines.filter(line => {
    try {
      const entry = JSON.parse(line);
      const ids = [entry.actorId, entry.studentId, entry.teacherId].filter(Boolean);
      return ids.some(id => KEEP_IDS.has(id));
    } catch { return false; }
  });
  const afterCount = cleaned.length;
  console.log(`  Before: ${beforeCount} lines  →  After: ${afterCount} lines`);
  atomicWrite(auditFile, cleaned.join('\n') + (cleaned.length > 0 ? '\n' : ''));
}

// ===== 10. tip-favorites.json =====
console.log('\n10. Processing tip-favorites.json...');
const favFile = path.join(DATA_DIR, 'tip-favorites.json');
backupFile(favFile);
const favs = readJSON(favFile);
if (favs) {
  console.log(`  Before: ${Object.keys(favs).length} users with favorites  →  After: 0`);
  atomicWrite(favFile, {});
}

// ===== 11. chat-log.jsonl =====
console.log('\n11. Processing chat-log.jsonl...');
const chatLogFile = path.join(DATA_DIR, 'chat-log.jsonl');
backupFile(chatLogFile);
if (fs.existsSync(chatLogFile)) {
  const size = fs.statSync(chatLogFile).size;
  console.log(`  Deleting chat-log.jsonl (${size} bytes) — no user IDs to filter`);
  atomicWrite(chatLogFile, '');
}

// ===== 12. v2-grace-log.jsonl =====
console.log('\n12. Processing v2-grace-log.jsonl...');
const graceLogFile = path.join(DATA_DIR, 'v2-grace-log.jsonl');
if (fs.existsSync(graceLogFile)) {
  backupFile(graceLogFile);
  console.log(`  Deleting v2-grace-log.jsonl`);
  atomicWrite(graceLogFile, '');
} else {
  console.log('  File does not exist, skipping.');
}

console.log('\n===== Cleanup complete! =====');
console.log('Backup files (.bak) created for all modified files.');
console.log('Run verification: node app.js');
