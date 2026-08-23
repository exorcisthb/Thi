// Script để parse file "Bộ đề.txt" thành JSON cho Vercel serverless functions
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItbText, splitIntoParts } from '../server/itbParser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Đọc file Bộ đề.txt
const textFile = path.join(projectRoot, 'Bộ đề.txt');
const text = readFileSync(textFile, 'utf8');

// Parse câu hỏi
const questions = parseItbText(text);
const parts = splitIntoParts(questions, 70);

// Chuẩn bị data
const allQuestions = [];
parts.forEach((qs, pIdx) => {
  const partNo = pIdx + 1;
  qs.forEach((q, qIdx) => {
    const id = `${partNo}-${qIdx + 1}`;
    allQuestions.push({
      id,
      partNo,
      content: q.content,
      options: q.options,
      answers: q.answers,
      weight: 1,
      explanation: '',
    });
  });
});

// Tạo data structure cho API
const data = {
  parts: parts.map((qs, idx) => ({
    id: idx + 1,
    partNo: idx + 1,
    name: `ITB - Phần ${idx + 1}`,
    questionCount: qs.length,
  })),
  questions: allQuestions,
};

// Tạo thư mục public/data nếu chưa có
const dataDir = path.join(projectRoot, 'public', 'data');
mkdirSync(dataDir, { recursive: true });

// Lưu file JSON
const outputPath = path.join(dataDir, 'itb-questions.json');
writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`✅ Đã tạo file: ${outputPath}`);
console.log(`📊 Tổng số câu hỏi: ${allQuestions.length}`);
console.log(`📦 Số phần: ${data.parts.length}`);
