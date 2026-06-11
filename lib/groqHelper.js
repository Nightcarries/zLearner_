export async function invokeStructured(structuredModel, messages, maxRetries = 2) {
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
        const start = failedGen.indexOf('{');
        const end = failedGen.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const jsonStr = failedGen.substring(start, end + 1);
          try {
            const parsed = JSON.parse(jsonStr);
            console.log(`Successfully recovered and parsed JSON on attempt ${attempt}!`);
            return parsed;
          } catch (parseErr) {
            console.warn(`Failed to parse extracted JSON on attempt ${attempt}:`, parseErr.message);
          }
        }
      }

      // If we have more attempts, wait a bit and retry
      if (attempt < maxRetries) {
        console.log(`Retrying structured model invocation (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // If all attempts and recoveries fail, throw the last error
  throw lastError;
}
