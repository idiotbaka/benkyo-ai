function stringifyContent(content) {
  if (typeof content === 'string') return content;
  if (content === undefined || content === null) return '(no AI output content received)';

  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function findErrorText(error, seen = new Set()) {
  if (!error || typeof error !== 'object' || seen.has(error)) return '';
  seen.add(error);

  if (typeof error.text === 'string' && error.text) return error.text;

  const nestedErrors = [
    error.lastError,
    error.cause,
    ...(Array.isArray(error.errors) ? [...error.errors].reverse() : []),
  ];
  for (const nestedError of nestedErrors) {
    const text = findErrorText(nestedError, seen);
    if (text) return text;
  }

  return '';
}

export function getAiErrorContent(error, fallback = '') {
  if (fallback) return fallback;
  const text = findErrorText(error);
  if (text) return text;
  return '(no AI output content received)';
}

export function logAiGeneratedContent({ phase, mode, status, content, error }) {
  console.log(
    `[AI DEBUG] phase=${phase} mode=${mode} status=${status}\n${stringifyContent(content)}`
  );
  if (error) console.log(`[AI DEBUG] phase=${phase} mode=${mode} error:`, error);
}
