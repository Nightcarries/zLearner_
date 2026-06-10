export async function embedText(text) {
  const hfToken = process.env.HF_TOKEN;

  // We use sentence-transformers/all-MiniLM-L6-v2 which matches the original local model.
  const response = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    {
      headers: {
        ...(hfToken ? { Authorization: `Bearer ${hfToken}` } : {}),
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ inputs: text }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face Inference API failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  // The API returns the embedding vector directly as an array of numbers,
  // but let's ensure it's structured correctly.
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
