export async function embedText(text) {
  const hfToken = process.env.HF_TOKEN;
  const url = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";

  let response;
  let lastError;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: text }),
      });
      if (response.ok) {
        break;
      }
      const errBody = await response.text().catch(() => "");
      lastError = new Error(`Hugging Face Inference API failed (${response.status}): ${errBody}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxRetries) {
      // Exponential backoff: 200ms, 400ms
      await new Promise((resolve) => setTimeout(resolve, attempt * 200));
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error("Failed to connect to Hugging Face Inference API after retries.");
  }

  let result = await response.json();

  // Unwrap nested arrays (e.g. [[...]] or [[[...]]]) until we get a 1D array of numbers
  if (Array.isArray(result)) {
    while (result.length > 0 && Array.isArray(result[0])) {
      result = result[0];
    }
  }

  return result;
}

export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start += chunkSize - overlap;
  }

  return chunks;
}
