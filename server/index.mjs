import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseItbText, splitIntoParts } from './itbParser.mjs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'quiz.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setId TEXT NOT NULL,
    fileName TEXT NOT NULL DEFAULT '',
    dataUrl TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS itb_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS itb_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    q_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    option_a TEXT NOT NULL DEFAULT '',
    option_b TEXT NOT NULL DEFAULT '',
    option_c TEXT NOT NULL DEFAULT '',
    option_d TEXT NOT NULL DEFAULT '',
    option_e TEXT NOT NULL DEFAULT '',
    answers_json TEXT NOT NULL DEFAULT '[]',
    weight REAL NOT NULL DEFAULT 1,
    explanation TEXT NOT NULL DEFAULT ''
  );
`);

// ---------- Seed bo de ITB tu file txt (chi 1 lan) ----------
function stripDiacritics(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function findItbTextFile() {
  const projectRoot = path.join(__dirname, '..');
  const entries = readdirSync(projectRoot);
  const file = entries.find((f) => {
    const low = stripDiacritics(f.toLowerCase());
    return low.endsWith('.txt') && /(bo de|itb)/.test(low);
  });
  return file ? path.join(projectRoot, file) : null;
}

function seedItb() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM itb_parts').get();
  if (existing && existing.c > 0) return;

  const filePath = findItbTextFile();
  if (!filePath) {
    console.warn('Khong tim thay file bo de (txt) de seed ITB - bo qua.');
    return;
  }

  const text = readFileSync(filePath, 'utf8');
  const questions = parseItbText(text);
  const parts = splitIntoParts(questions, 70);

  const insertPart = db.prepare(
    'INSERT INTO itb_parts (part_no, name, question_count) VALUES (?, ?, ?)'
  );
  const insertQuestion = db.prepare(
    `INSERT INTO itb_questions
      (part_id, q_index, content, option_a, option_b, option_c, option_d, option_e, answers_json, weight, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec('BEGIN');
  try {
    parts.forEach((qs, pIdx) => {
      const partNo = pIdx + 1;
      const partInfo = insertPart.run(partNo, `ITB - Phan ${partNo}`, qs.length);
      const partId = Number(partInfo.lastInsertRowid);
      qs.forEach((q, qIdx) => {
        insertQuestion.run(
          partId,
          qIdx + 1,
          q.content,
          q.options.A || '',
          q.options.B || '',
          q.options.C || '',
          q.options.D || '',
          q.options.E || '',
          JSON.stringify(q.answers),
          1,
          ''
        );
      });
    });
    db.exec('COMMIT');
    console.log(`Seeded ITB: ${questions.length} cau, ${parts.length} phan (tu "${path.basename(filePath)}")`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Seed ITB that bai:', err);
  }
}

seedItb();

const app = express();
app.use(express.json({ limit: '50mb' }));

// CORS (cho phep dev frontend goi tu port khac)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Danh sach anh cua mot bo cau hoi
app.get('/api/images', (req, res) => {
  const setId = req.query.setId;
  if (!setId) return res.status(400).json({ error: 'Thieu setId' });
  const rows = db
    .prepare('SELECT id, setId, fileName, createdAt FROM images WHERE setId = ? ORDER BY id ASC')
    .all(String(setId));
  res.json(rows);
});

// Lay chi tiet mot anh (kem dataUrl)
app.get('/api/images/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Khong tim thay anh' });
  res.json(row);
});

// Phuc vu anh goc (binary) cho the <img>
app.get('/api/images/:id/data', (req, res) => {
  const row = db
    .prepare('SELECT * FROM images WHERE id = ?')
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Khong tim thay anh' });
  const commaIdx = row.dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? row.dataUrl.slice(0, commaIdx) : '';
  const base64 = commaIdx >= 0 ? row.dataUrl.slice(commaIdx + 1) : row.dataUrl;
  const mime = header.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const buf = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(buf);
});

// Luu anh moi vao DB
app.post('/api/images', (req, res) => {
  const { setId, fileName, dataUrl } = req.body || {};
  if (!setId || !dataUrl) {
    return res.status(400).json({ error: 'Thieu setId hoac dataUrl' });
  }
  const info = db
    .prepare('INSERT INTO images (setId, fileName, dataUrl, createdAt) VALUES (?, ?, ?, ?)')
    .run(String(setId), String(fileName || ''), String(dataUrl), Date.now());
  res.json({
    id: Number(info.lastInsertRowid),
    setId: String(setId),
    fileName: String(fileName || ''),
    createdAt: Date.now(),
  });
});

// Xoa anh
app.delete('/api/images/:id', (req, res) => {
  const info = db.prepare('DELETE FROM images WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: Number(info.changes) > 0 });
});

// Xoa toan bo anh cua mot bo
app.delete('/api/sets/:setId/images', (req, res) => {
  db.prepare('DELETE FROM images WHERE setId = ?').run(String(req.params.setId));
  res.json({ ok: true });
});

// ---------- API bo de ITB ----------
// Danh sach cac phan (moc ~70 cau cua bo de)
app.get('/api/itb/parts', (req, res) => {
  const rows = db
    .prepare('SELECT id, part_no AS partNo, name, question_count AS questionCount FROM itb_parts ORDER BY part_no ASC')
    .all();
  res.json(rows);
});

// Chi tiet cau hoi cua mot phan
app.get('/api/itb/parts/:partId/questions', (req, res) => {
  const part = db
    .prepare('SELECT id, part_no AS partNo, name FROM itb_parts WHERE id = ?')
    .get(Number(req.params.partId));
  if (!part) return res.status(404).json({ error: 'Khong tim thay phan ITB' });

  const rows = db
    .prepare(
      `SELECT q_index AS qIndex, content, option_a AS opA, option_b AS opB,
              option_c AS opC, option_d AS opD, option_e AS opE,
              answers_json AS answersJson, weight, explanation
       FROM itb_questions WHERE part_id = ? ORDER BY q_index ASC`
    )
    .all(Number(req.params.partId));

  const questions = rows.map((r) => {
    let answers = [];
    try {
      answers = JSON.parse(r.answersJson || '[]');
    } catch {
      answers = [];
    }
    const options = { A: r.opA || '', B: r.opB || '', C: r.opC || '', D: r.opD || '', E: r.opE || '' };
    return {
      index: r.qIndex,
      content: r.content,
      options,
      answers,
      weight: r.weight,
      explanation: r.explanation || '',
    };
  });

  res.json({ part, questions });
});

// Toan bo cau hoi ITB (de dung cho viec nap vao bo cau hoi)
app.get('/api/itb/all-questions', (req, res) => {
  const rows = db
    .prepare(
      `SELECT Q.id, Q.part_id AS partId, P.part_no AS partNo,
              Q.content, Q.option_a AS opA, Q.option_b AS opB,
              Q.option_c AS opC, Q.option_d AS opD, Q.option_e AS opE,
              Q.answers_json AS answersJson, Q.weight, Q.explanation
       FROM itb_questions Q JOIN itb_parts P ON P.id = Q.part_id
       ORDER BY Q.part_id ASC, Q.q_index ASC`
    )
    .all();

  const questions = rows.map((r) => {
    let answers = [];
    try {
      answers = JSON.parse(r.answersJson || '[]');
    } catch {
      answers = [];
    }
    const options = { A: r.opA || '', B: r.opB || '', C: r.opC || '', D: r.opD || '', E: r.opE || '' };
    return {
      id: String(r.id),
      partNo: r.partNo,
      content: r.content,
      options,
      answers,
      weight: r.weight,
      explanation: r.explanation || '',
    };
  });

  res.json(questions);
});

const PORT = Number(process.env.PORT) || 4300;
app.listen(PORT, () => {
  console.log(`Server chay tai http://localhost:${PORT}`);
});
