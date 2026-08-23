// Parser cho file "Bo de.txt": tach cau hoi, options (A-E) va dap an dung.
// Dap an dung la cac dong LAP LAI sau block options cua moi cau (co the nhieu dong
// doi voi cau "Select all that apply"). So thu tu cau co the reset nhieu lan.

const OPTION_RE = /^([A-E])\.\s*(.*)$/;
const QUESTION_START_RE = /^(\d+)\.\s?(.*)$/;

function isNoise(line) {
  return /^\s*Correct\s*:/i.test(line);
}

// Tra ve: { content, options: {A..E}, answers: string[] }
function parseQuestionBlock(blockLines) {
  const stem = [];
  const options = {};
  const order = [];
  const counts = {};

  for (const raw of blockLines) {
    const line = raw.trim();
    if (!line) continue;

    if (isNoise(line)) continue;

    const om = line.match(OPTION_RE);
    if (om) {
      const letter = om[1];
      let text = om[2].trim();
      // Dong nguon gioi thieu kieu "Correct: ..." khong phai option that
      if (/^Correct\s*:/i.test(text)) continue;
      // Bo dau cham/thua o cuoi option de ghep dap an nhan dien gan giong
      text = text.replace(/[.\s]+$/, '');
      if (letter in options) {
        counts[letter] = (counts[letter] || 1) + 1;
      } else {
        options[letter] = text;
        order.push(letter);
        counts[letter] = 1;
      }
      continue;
    }

    stem.push(line);
  }

  const content = stem.join(' ').replace(/\s+/g, ' ').trim();
  const answers = order.filter((l) => counts[l] > 1).sort();

  return { content, options, answers };
}

// text: noi dung toan bo file
// Tra ve: mang cau hoi hoan chinh
export function parseItbText(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const qm = line.match(QUESTION_START_RE);
    if (qm) {
      if (current) blocks.push(current);
      current = [line];
    } else {
      if (current) current.push(line);
    }
  }
  if (current) blocks.push(current);

  const questions = blocks.map((block) => {
    const first = block[0].match(QUESTION_START_RE);
    const parsed = parseQuestionBlock(block);
    const stemFirst = first ? first[2].trim() : '';
    // Neu dong dau cua block chua noi dung (>=0 ky tu), dung lam phan dau cau hoi
    let content = parsed.content;
    if (!content || first) {
      const rest = block.slice(1);
      const prefix = first ? first[2].trim() : '';
      const body = parseQuestionBlock([prefix, ...rest]).content;
      content = body || content;
      // Neu prefix doc lap co the da duoc cong don; dam bao khong trung
      content = content.replace(new RegExp('^' + escapeRegExp(stemFirst)), '').trim();
      if (stemFirst && body.startsWith(stemFirst)) {
        content = body;
      } else if (stemFirst) {
        content = body ? `${stemFirst} ${body}`.replace(/\s+/g, ' ').trim() : stemFirst;
      }
    }
    return {
      content,
      options: parsed.options,
      answers: parsed.answers,
    };
  });

  return questions;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Chia mang cau hoi thanh cac phan moi phan toi da `perPart` cau
export function splitIntoParts(questions, perPart = 70) {
  const parts = [];
  for (let i = 0; i < questions.length; i += perPart) {
    parts.push(questions.slice(i, i + perPart));
  }
  return parts;
}