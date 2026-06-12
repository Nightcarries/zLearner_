function sanitizeJsonString(str) {
  return str.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
}

export async function invokeStructured(structuredModel, messages, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await structuredModel.invoke(messages);
    } catch (err) {
      console.warn(`Structured output invoke attempt ${attempt} failed:`, err.message);
      lastError = err;

      // Try to find the failed generation string in the error object
      const failedGen =
        err.failed_generation ||
        err.error?.failed_generation ||
        err.cause?.failed_generation ||
        err.cause?.error?.failed_generation ||
        err.message;

      if (typeof failedGen === 'string') {
        // Try multiple extraction strategies
        const recovered = tryRecoverJson(failedGen, attempt);
        if (recovered !== null) {
          return recovered;
        }
      }

      // If we have more attempts, wait a bit and retry with a longer delay each time
      if (attempt < maxRetries) {
        const delay = 500 * attempt;
        console.log(`Retrying structured model invocation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If all attempts and recoveries fail, throw the last error
  throw lastError;
}

function tryRecoverJson(failedGen, attempt) {
  // Strategy 1: Try to extract from <function=...>{json}</function> pattern
  const funcMatch = failedGen.match(/<function=\w+>([\s\S]*?)<\/function>/);
  const candidates = [];

  if (funcMatch) {
    candidates.push(funcMatch[1].trim());
  }

  // Strategy 2: Extract between first { and last }
  const start = failedGen.indexOf('{');
  const end = failedGen.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(failedGen.substring(start, end + 1));
  }

  for (const jsonStr of candidates) {
    // Try raw parse first
    try {
      const parsed = JSON.parse(jsonStr);
      console.log(`✅ Successfully recovered JSON on attempt ${attempt} (raw parse)`);
      return parsed;
    } catch (_rawErr) {
      // Raw parse failed, try sanitized version
    }

    // Try sanitized parse
    try {
      const sanitized = sanitizeJsonString(jsonStr);
      const parsed = JSON.parse(sanitized);
      console.log(`✅ Successfully recovered JSON on attempt ${attempt} (after sanitizing escape sequences)`);
      return parsed;
    } catch (sanitizeErr) {
      console.warn(`Failed to parse extracted JSON on attempt ${attempt}:`, sanitizeErr.message);
    }
  }

  return null;
}
