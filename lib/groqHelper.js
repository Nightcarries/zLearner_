export async function invokeStructured(structuredModel, messages) {
  try {
    return await structuredModel.invoke(messages);
  } catch (err) {
    console.warn("Structured output invoke failed, attempting recovery from failed generation...", err.message);

    // Try to find the failed generation string in the error object
    const failedGen = 
      err.failed_generation || 
      err.error?.failed_generation || 
      err.cause?.error?.failed_generation || 
      err.message;

    if (typeof failedGen === 'string') {
      const start = failedGen.indexOf('{');
      const end = failedGen.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = failedGen.substring(start, end + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          console.log("Successfully recovered and parsed JSON from Groq's failed generation output!");
          return parsed;
        } catch (parseErr) {
          console.error("Failed to parse extracted JSON from failed generation:", parseErr.message);
        }
      }
    }

    // If recovery fails, throw the original error
    throw err;
  }
}
