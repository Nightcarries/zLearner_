function fixJsonEscapes(raw) {
  const result = [];
  let inString = false;
  let i = 0;
  const BS = String.fromCharCode(92);
  const DQ = String.fromCharCode(34);

  while (i < raw.length) {
    const ch = raw[i];

    if (!inString) {
      result.push(ch);
      if (ch === DQ) inString = true;
      i++;
      continue;
    }

    // Inside a JSON string
    if (ch === DQ) {
      result.push(ch);
      inString = false;
      i++;
      continue;
    }

    if (ch !== BS) {
      result.push(ch);
      i++;
      continue;
    }

    // ch is a backslash - look at what follows
    const next = raw[i + 1];

    if (next === undefined) {
      result.push(BS + BS);
      i++;
      continue;
    }

    // Case 1: already-escaped backslash
    if (next === BS) {
      result.push(BS + BS);
      i += 2;
      continue;
    }

    // Case 2: escaped quote
    if (next === DQ) {
      result.push(BS + DQ);
      i += 2;
      continue;
    }

    // Case 3: escaped forward slash
    if (next === '/') {
      result.push(BS + '/');
      i += 2;
      continue;
    }

    // Case 4: unicode escape
    if (next === 'u') {
      const hex = raw.substring(i + 2, i + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        result.push(raw.substring(i, i + 6));
        i += 6;
        continue;
      }
      result.push(BS + BS);
      i++;
      continue;
    }

    // Case 5: b f n r t - valid JSON escapes BUT could be LaTeX
    if ('bfnrt'.includes(next)) {
      const afterNext = raw[i + 2];
      if (afterNext && /[a-zA-Z]/.test(afterNext)) {
        // Likely LaTeX (frac, beta, text, etc.) - escape the backslash
        result.push(BS + BS);
        i++;
        continue;
      }
      // Likely a real JSON control character escape
      result.push(BS + next);
      i += 2;
      continue;
    }

    // Case 6: Any other char - not valid JSON escape (_, *, #, ~, ^, {, }, etc.)
    result.push(BS + BS);
    i++;
    continue;
  }

  return result.join('');
}

/**
 * Try to extract and parse JSON from a failed generation string.
 */
function tryRecoverJson(failedGen, attempt) {
  const candidates = [];

  // Strategy 1: Extract from <function=...>{json}</function> wrapper
  const funcMatch = failedGen.match(/<function=\w+>([\s\S]*?)<\/function>/);
  if (funcMatch) {
    candidates.push(funcMatch[1].trim());
  }

  // Strategy 2: Extract between first { and last }
  const start = failedGen.indexOf('{');
  const end = failedGen.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const extracted = failedGen.substring(start, end + 1);
    if (!candidates.includes(extracted)) {
      candidates.push(extracted);
    }
  }

  for (const jsonStr of candidates) {
    // Try raw parse first
    try {
      const parsed = JSON.parse(jsonStr);
      console.log('  OK Recovered JSON on attempt ' + attempt + ' (raw parse)');
      return parsed;
    } catch (_rawErr) {
      // Expected - proceed to sanitized parse
    }

    // Try with escape fixing
    try {
      const fixed = fixJsonEscapes(jsonStr);
      const parsed = JSON.parse(fixed);
      console.log('  OK Recovered JSON on attempt ' + attempt + ' (after fixing escapes)');
      return parsed;
    } catch (fixErr) {
      console.warn('  WARN Failed to parse fixed JSON on attempt ' + attempt + ':', fixErr.message);
    }
  }

  return null;
}

/**
 * Deep-search an error object for the failed_generation field.
 */
function findFailedGeneration(err) {
  if (err.failed_generation) return err.failed_generation;
  if (err.error && err.error.failed_generation) return err.error.failed_generation;
  if (err.cause && err.cause.failed_generation) return err.cause.failed_generation;
  if (err.cause && err.cause.error && err.cause.error.failed_generation) return err.cause.error.failed_generation;
  if (err.lc_error_msg) return err.lc_error_msg;
  if (err.response && err.response.data && err.response.data.error && err.response.data.error.failed_generation) {
    return err.response.data.error.failed_generation;
  }

  // Last resort: stringify and search for failed_generation key
  try {
    const errStr = JSON.stringify(err, Object.getOwnPropertyNames(err));
    const key = 'failed_generation';
    const idx = errStr.indexOf(key);
    if (idx !== -1) {
      // Find the value after the key
      const afterKey = errStr.substring(idx + key.length);
      const valMatch = afterKey.match(/^"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (valMatch) {
        return JSON.parse('"' + valMatch[1] + '"');
      }
    }
  } catch (_) {
    // Ignore
  }

  return null;
}

export async function invokeStructured(structuredModel, messages, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await structuredModel.invoke(messages);
    } catch (err) {
      console.warn('Structured output invoke attempt ' + attempt + ' failed:', err.message);
      lastError = err;

      // Try to find the failed generation string
      const failedGen = findFailedGeneration(err) || err.message;

      if (typeof failedGen === 'string') {
        const recovered = tryRecoverJson(failedGen, attempt);
        if (recovered !== null) {
          return recovered;
        }
      }

      // Retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = 500 * attempt;
        console.log('Retrying structured model invocation (attempt ' + (attempt + 1) + '/' + maxRetries + ') after ' + delay + 'ms...');
        await new Promise(function(resolve) { setTimeout(resolve, delay); });
      }
    }
  }

  throw lastError;
}
