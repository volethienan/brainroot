import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_HINT_MODEL = process.env.GEMINI_HINT_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_SPEECH_MODEL = process.env.GEMINI_SPEECH_MODEL || GEMINI_HINT_MODEL;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const CATEGORIES = {
  'tai-chinh': 'Tài chính cá nhân',
  'khoi-nghiep': 'Khởi nghiệp',
  startup: 'Startup',
  'cong-nghe': 'Tech / AI',
  'the-hinh': 'Thể hình',
  'dinh-duong': 'Dinh dưỡng',
  'nang-suat': 'Năng suất',
  'lich-su': 'Lịch sử',
  'van-hoc': 'Văn học',
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request, maxSize) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxSize) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  const body = await readRequestBody(request, 64 * 1024);
  return JSON.parse(body.toString('utf8') || '{}');
}

function extractText(interaction) {
  if (typeof interaction.output_text === 'string') return interaction.output_text;

  const modelOutput = [...(interaction.steps || [])]
    .reverse()
    .find((step) => step.type === 'model_output');

  if (modelOutput) {
    return (modelOutput.content || [])
      .filter((item) => item.type === 'text')
      .map((item) => item.text || '')
      .join('');
  }

  for (const output of interaction.outputs || []) {
    const text = (output.content || [])
      .filter((item) => item.type === 'text')
      .map((item) => item.text || '')
      .join('');
    if (text) return text;
  }

  return '';
}

function normalizeTopic(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function normalizeHintText(value, maxLength = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeQuestion(value) {
  const question = normalizeHintText(value, 500).replace(/[.]+$/, '');
  if (!question) return '';
  return /[?!]$/.test(question) ? question : `${question}?`;
}

function hasSufficientVietnameseDiacritics(value) {
  const text = String(value || '');
  const letters = (text.match(/[a-zA-ZÀ-ỹĐđ]/g) || []).length;
  const diacritics = (text.match(/[ÀÁẠẢÃĂẰẮẶẲẴÂẦẤẬẨẪÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐàáạảãăằắặẳẵâầấậẩẫèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g) || []).length;
  return letters < 80 || diacritics >= Math.max(3, Math.floor(letters * 0.015));
}

async function callGeminiJson(prompt, schema, options = {}) {
  if (!GEMINI_API_KEY) {
    const error = new Error('MISSING_API_KEY');
    error.statusCode = 503;
    throw error;
  }

  const apiResponse = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: options.model || GEMINI_MODEL,
      input: prompt,
      generation_config: { thinking_level: options.thinkingLevel || 'low' },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
    }),
  });

  const interaction = await apiResponse.json();
  if (!apiResponse.ok) {
    const message = interaction?.error?.message || `Gemini trả về HTTP ${apiResponse.status}`;
    const error = new Error(message);
    error.statusCode = apiResponse.status;
    throw error;
  }

  const text = extractText(interaction);
  if (!text) throw new Error('Gemini không trả về nội dung.');
  return JSON.parse(text);
}

async function callGeminiGenerateContentJson(prompt, schema, model) {
  if (!GEMINI_API_KEY) {
    const error = new Error('MISSING_API_KEY');
    error.statusCode = 503;
    throw error;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const apiResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        maxOutputTokens: 550,
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    }),
  });

  const result = await apiResponse.json();
  if (!apiResponse.ok) {
    const message = result?.error?.message || `Gemini trả về HTTP ${apiResponse.status}`;
    const error = new Error(message);
    error.statusCode = apiResponse.status;
    throw error;
  }

  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('');
  if (!text) throw new Error('Gemini không trả về nội dung.');
  return JSON.parse(text);
}

async function generateTopics({ mode, categoryId, existingTopics }) {

  const isGeneral = categoryId === 'general';
  const categoryIds = isGeneral ? Object.keys(CATEGORIES) : [categoryId];
  if (!categoryIds.every((id) => CATEGORIES[id])) {
    const error = new Error('INVALID_CATEGORY');
    error.statusCode = 400;
    throw error;
  }

  const safeExistingTopics = Array.isArray(existingTopics)
    ? existingTopics.map(normalizeTopic).filter(Boolean).slice(0, 250)
    : [];
  const modeInstruction = mode === 'deep'
    ? 'Mỗi chủ đề là một câu hỏi hoặc luận đề đủ chiều sâu để người dùng nghiên cứu rồi trình bày.'
    : 'Mỗi chủ đề là một cụm từ ngắn, rõ ràng, phù hợp để luyện phản xạ nói ngay.';
  const categoryInstruction = isGeneral
    ? `Phân bổ đa dạng giữa các danh mục: ${categoryIds.map((id) => `${id} (${CATEGORIES[id]})`).join(', ')}.`
    : `Tất cả chủ đề phải thuộc danh mục ${categoryId} (${CATEGORIES[categoryId]}).`;

  const prompt = [
    'Bạn là bộ tạo chủ đề luyện nói tiếng Việt.',
    'Hãy tạo đúng 12 chủ đề mới, tự nhiên, hữu ích và không trùng ý với danh sách đã có.',
    modeInstruction,
    categoryInstruction,
    'Không thêm đánh số, giải thích hoặc markdown.',
    `Các chủ đề cần tránh: ${JSON.stringify(safeExistingTopics)}`,
  ].join('\n');

  const parsed = await callGeminiJson(prompt, {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        minItems: 12,
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            categoryId: { type: 'string', enum: categoryIds },
          },
          required: ['word', 'categoryId'],
          additionalProperties: false,
        },
      },
    },
    required: ['topics'],
    additionalProperties: false,
  });
  const seen = new Set(safeExistingTopics.map((topic) => topic.toLocaleLowerCase('vi')));
  const topics = (parsed.topics || [])
    .map((topic) => ({ word: normalizeTopic(topic.word), categoryId: topic.categoryId }))
    .filter((topic) => {
      const key = topic.word.toLocaleLowerCase('vi');
      if (!topic.word || !categoryIds.includes(topic.categoryId) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (topics.length === 0) throw new Error('Gemini không tạo được chủ đề hợp lệ.');
  return topics;
}

async function generateHint({ topic, categoryId, mode }) {
  const safeTopic = normalizeTopic(topic);
  if (!safeTopic) {
    const error = new Error('INVALID_TOPIC');
    error.statusCode = 400;
    throw error;
  }

  const categoryName = CATEGORIES[categoryId] || 'Tổng hợp';
  const modeName = mode === 'deep' ? 'Tư duy sâu' : 'Phản xạ nhanh';
  const prompt = [
    'Bạn là trợ lý gợi ý nghiên cứu và luyện phản biện bằng tiếng Việt.',
    'BẮT BUỘC viết tiếng Việt có dấu đầy đủ. Tuyệt đối không viết tiếng Việt không dấu.',
    `Chủ đề: ${safeTopic}`,
    `Danh mục: ${categoryName}. Chế độ: ${modeName}.`,
    'Viết định nghĩa thật đơn giản trong đúng 1 câu, tối đa khoảng 30 từ.',
    'Đưa ra đúng 4 từ khóa hoặc hướng tìm kiếm cụ thể để người dùng tự research.',
    'Đưa ra đúng 3 câu hỏi phản biện mở, mỗi câu khoảng 12-20 từ, tập trung vào bằng chứng, giả định, góc nhìn đối lập hoặc đánh đổi và kết thúc bằng dấu hỏi.',
    'Không kết luận thay người dùng và không dùng markdown.',
  ].join('\n');

  const schema = {
    type: 'object',
    properties: {
      definition: { type: 'string' },
      researchKeys: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: { type: 'string' },
      },
      criticalQuestions: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string' },
      },
    },
    required: ['definition', 'researchKeys', 'criticalQuestions'],
    additionalProperties: false,
  };
  let parsed = await callGeminiGenerateContentJson(prompt, schema, GEMINI_HINT_MODEL);
  const combinedText = [
    parsed.definition,
    ...(parsed.researchKeys || []),
    ...(parsed.criticalQuestions || []),
  ].join(' ');

  if (!hasSufficientVietnameseDiacritics(combinedText)) {
    const correctionPrompt = [
      'Hãy phục hồi dấu tiếng Việt cho nội dung JSON dưới đây.',
      'Giữ nguyên ý nghĩa, số lượng mục và cấu trúc. BẮT BUỘC mọi câu tiếng Việt phải có dấu đầy đủ.',
      'Không thêm markdown hoặc giải thích.',
      JSON.stringify(parsed),
    ].join('\n');
    parsed = await callGeminiGenerateContentJson(correctionPrompt, schema, GEMINI_HINT_MODEL);
  }

  return {
    definition: normalizeHintText(parsed.definition, 600),
    researchKeys: (parsed.researchKeys || []).map((item) => normalizeHintText(item, 180)).filter(Boolean).slice(0, 4),
    criticalQuestions: (parsed.criticalQuestions || []).map(normalizeQuestion).filter(Boolean).slice(0, 3),
  };
}

function normalizeAudioMimeType(contentType) {
  const mimeType = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  const supported = new Set([
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
  ]);
  if (!supported.has(mimeType)) {
    const error = new Error('INVALID_AUDIO_TYPE');
    error.statusCode = 415;
    throw error;
  }
  return mimeType === 'audio/x-wav' ? 'audio/wav' : mimeType;
}

async function generateSpeechFeedback({ audio, mimeType, topic, categoryId, durationSeconds }) {
  if (!GEMINI_API_KEY) {
    const error = new Error('MISSING_API_KEY');
    error.statusCode = 503;
    throw error;
  }

  const safeTopic = normalizeTopic(topic);
  if (!safeTopic) {
    const error = new Error('INVALID_TOPIC');
    error.statusCode = 400;
    throw error;
  }

  const categoryName = CATEGORIES[categoryId] || 'Tổng hợp';
  const prompt = [
    'Bạn là một người phản biện khó tính nhưng công bằng, đồng thời là huấn luyện viên kỹ năng nói bằng tiếng Việt.',
    `Người dùng vừa nói về chủ đề: ${safeTopic}.`,
    `Danh mục: ${categoryName}. Thời lượng dự kiến: ${durationSeconds || 60} giây.`,
    'Hãy nghe bản ghi và đánh giá cách trình bày, không đánh giá giọng vùng miền hay đặc điểm cá nhân.',
    'Chấm điểm nghiêm khắc dựa trên độ rõ ràng, cấu trúc, lập luận và cách truyền đạt; không cho điểm cao chỉ vì nói trôi chảy.',
    'Mỗi điểm cần cải thiện phải nêu quan sát cụ thể và một hành động luyện tập có thể làm ngay.',
    'Hãy dựng lại chuỗi lập luận người dùng đã nói: luận điểm chính, tiền đề và kết luận.',
    'Chỉ ra cụ thể đoạn hoặc ý nào mắc lỗi logic như khái quát hóa vội vàng, nhầm tương quan với nhân quả, lưỡng phân giả, vòng tròn, thiếu tiền đề, mâu thuẫn, đánh tráo khái niệm hoặc dùng ví dụ đơn lẻ thay bằng chứng.',
    'Với mỗi lỗi logic, giải thích vì sao chưa thuyết phục và viết cách sửa lập luận mạnh hơn.',
    'Chỉ nêu lỗi thông tin khi có độ tin cậy cao; nếu chưa chắc, ghi rõ đây là thông tin cần kiểm chứng thay vì khẳng định người dùng sai.',
    'Không bịa ra câu người dùng không nói. Trường excerpt phải là trích đoạn ngắn hoặc diễn giải sát nội dung thực sự nghe được.',
    'Đặt ba câu hỏi phản biện khó buộc người dùng làm rõ bằng chứng, giả định và đánh đổi.',
    'Viết lại một phiên bản lập luận chặt chẽ hơn, giữ nguyên ý định chính của người nói nhưng bổ sung điều kiện, bằng chứng hoặc giới hạn cần thiết.',
    'Ưu tiên tối đa ba lỗi logic nghiêm trọng nhất và tối đa hai vấn đề thông tin đáng chú ý nhất; mỗi trường chỉ viết một hoặc hai câu ngắn.',
    'Nếu audio không có lời nói rõ ràng, đặt speechDetected=false, các điểm bằng 0 và giải thích ngắn gọn.',
    'Trả lời ngắn gọn, thực tế, bằng tiếng Việt và không dùng markdown.',
  ].join('\n');
  const schema = {
    type: 'object',
    properties: {
      speechDetected: { type: 'boolean' },
      overallScore: { type: 'integer', minimum: 0, maximum: 100 },
      summary: { type: 'string' },
      argumentSummary: { type: 'string' },
      scores: {
        type: 'object',
        properties: {
          clarity: { type: 'integer', minimum: 0, maximum: 100 },
          structure: { type: 'integer', minimum: 0, maximum: 100 },
          reasoning: { type: 'integer', minimum: 0, maximum: 100 },
          delivery: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['clarity', 'structure', 'reasoning', 'delivery'],
        additionalProperties: false,
      },
      strengths: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: { type: 'string' },
      },
      improvements: {
        type: 'array',
        minItems: 2,
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            area: { type: 'string' },
            observation: { type: 'string' },
            action: { type: 'string' },
          },
          required: ['area', 'observation', 'action'],
          additionalProperties: false,
        },
      },
      logicIssues: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            excerpt: { type: 'string' },
            issueType: { type: 'string' },
            critique: { type: 'string' },
            fix: { type: 'string' },
          },
          required: ['excerpt', 'issueType', 'critique', 'fix'],
          additionalProperties: false,
        },
      },
      factualIssues: {
        type: 'array',
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            excerpt: { type: 'string' },
            concern: { type: 'string' },
            correction: { type: 'string' },
            verification: { type: 'string' },
          },
          required: ['excerpt', 'concern', 'correction', 'verification'],
          additionalProperties: false,
        },
      },
      toughQuestions: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string' },
      },
      revisedArgument: { type: 'string' },
      nextPractice: { type: 'string' },
    },
    required: ['speechDetected', 'overallScore', 'summary', 'argumentSummary', 'scores', 'strengths', 'improvements', 'logicIssues', 'factualIssues', 'toughQuestions', 'revisedArgument', 'nextPractice'],
    additionalProperties: false,
  };
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_SPEECH_MODEL}:generateContent`;
  const audioData = audio.toString('base64');
  let lastParseError = null;

  for (const thinkingLevel of ['medium', 'low']) {
    const apiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: audioData } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          maxOutputTokens: 5000,
          thinkingConfig: { thinkingLevel },
        },
      }),
    });

    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = result?.error?.message || `Gemini trả về HTTP ${apiResponse.status}`;
      const error = new Error(message);
      error.statusCode = apiResponse.status;
      throw error;
    }

    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((part) => part.text || '')
      .join('');
    if (!text) {
      lastParseError = new Error('Gemini không trả về nhận xét.');
      continue;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      const finishReason = candidate?.finishReason ? ` (${candidate.finishReason})` : '';
      lastParseError = new Error(`Gemini trả về nhận xét chưa hoàn chỉnh${finishReason}.`);
    }
  }

  throw lastParseError || new Error('Không thể đọc nhận xét từ Gemini.');
}

export const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'POST' && url.pathname === '/api/topics') {
      const body = await readJsonBody(request);
      const mode = body.mode === 'deep' ? 'deep' : 'cuff';
      const categoryId = String(body.categoryId || 'general');
      const topics = await generateTopics({ mode, categoryId, existingTopics: body.existingTopics });
      sendJson(response, 200, { topics });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/hint') {
      const body = await readJsonBody(request);
      const hint = await generateHint({
        topic: body.topic,
        categoryId: String(body.categoryId || 'general'),
        mode: body.mode === 'deep' ? 'deep' : 'cuff',
      });
      sendJson(response, 200, { hint });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/speech-feedback') {
      const mimeType = normalizeAudioMimeType(request.headers['content-type']);
      const audio = await readRequestBody(request, 12 * 1024 * 1024);
      if (audio.length < 1000) {
        const error = new Error('AUDIO_TOO_SHORT');
        error.statusCode = 400;
        throw error;
      }
      const feedback = await generateSpeechFeedback({
        audio,
        mimeType,
        topic: url.searchParams.get('topic'),
        categoryId: String(url.searchParams.get('categoryId') || 'general'),
        durationSeconds: Math.max(1, Math.min(600, Number(url.searchParams.get('duration')) || 60)),
      });
      sendJson(response, 200, { feedback });
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/web_brainroot.html')) {
      const html = await readFile(join(ROOT_DIR, 'web_brainroot.html'));
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(html);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }

    sendJson(response, 404, { error: 'Không tìm thấy đường dẫn.' });
  } catch (error) {
    const statusCode = error.statusCode || (error.message === 'REQUEST_TOO_LARGE' ? 413 : 500);
    const publicMessage = statusCode === 429
      ? 'Gemini đang tạm giới hạn số lượt yêu cầu. Hãy đợi khoảng một phút rồi thử lại.'
      : error.message === 'MISSING_API_KEY'
      ? 'Chưa cấu hình GEMINI_API_KEY trong file .env.'
      : error.message === 'INVALID_CATEGORY'
        ? 'Danh mục không hợp lệ.'
        : error.message === 'INVALID_TOPIC'
          ? 'Chủ đề không hợp lệ.'
        : error.message === 'INVALID_AUDIO_TYPE'
          ? 'Định dạng audio không được hỗ trợ.'
        : error.message === 'AUDIO_TOO_SHORT'
          ? 'Bản ghi quá ngắn để phân tích.'
        : error.message === 'REQUEST_TOO_LARGE'
          ? 'Yêu cầu quá lớn.'
          : error.message || 'Không thể xử lý yêu cầu Gemini.';
    console.error(error);
    sendJson(response, statusCode, { error: publicMessage });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Brainroot đang chạy tại http://127.0.0.1:${PORT}`);
});
