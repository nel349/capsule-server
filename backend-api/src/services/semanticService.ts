/**
 * Semantic Service Interface
 * Handles communication with the semantic oracle service for guess validation
 */

export interface SemanticValidationResult {
  is_correct: boolean;
  similarity: number;
  method: string;
  confidence: number;
  oracle_signature?: string;
  oracle_timestamp?: number;
  oracle_nonce?: string;
  oracle_enabled?: boolean;
  processing_time_ms?: number;
}

export interface SemanticServiceError {
  error: string;
  details?: string;
}

export class SemanticService {
  private static readonly SEMANTIC_SERVICE_URL =
    process.env.SEMANTIC_SERVICE_URL || "http://localhost:5001";

  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private static readonly DEFAULT_THRESHOLD = 0.8;

  /**
   * Validate a guess against the correct answer using the semantic oracle
   */
  static async validateGuess(
    guess: string,
    answer: string,
    threshold: number = this.DEFAULT_THRESHOLD
  ): Promise<SemanticValidationResult | SemanticServiceError> {
    try {
      console.log(`🔍 Validating guess via semantic service: "${guess}" vs "${answer}"`);

      const requestBody = {
        guess: guess.trim(),
        answer: answer.trim(),
        threshold,
        timestamp: Math.floor(Date.now() / 1000), // Unix timestamp
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

      const response = await fetch(`${this.SEMANTIC_SERVICE_URL}/check-answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        console.error(`❌ Semantic service HTTP error ${response.status}:`, errorData);
        return {
          error: `Semantic service error: ${response.status}`,
          details: errorData.error || response.statusText,
        };
      }

      const result = await response.json() as any;

      // Validate response structure
      if (typeof result.is_correct !== "boolean" || typeof result.similarity !== "number") {
        console.error("❌ Invalid response structure from semantic service:", result);
        return {
          error: "Invalid response from semantic service",
          details: "Missing required fields: is_correct, similarity",
        };
      }

      console.log(`✅ Semantic validation result:`, {
        is_correct: result.is_correct,
        similarity: result.similarity,
        method: result.method,
        confidence: result.confidence,
      });

      return result as SemanticValidationResult;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.error("❌ Semantic service request timeout");
          return {
            error: "Semantic service timeout",
            details: `Request exceeded ${this.REQUEST_TIMEOUT}ms timeout`,
          };
        }

        console.error("❌ Semantic service request error:", error.message);
        return {
          error: "Failed to connect to semantic service",
          details: error.message,
        };
      }

      console.error("❌ Unknown semantic service error:", error);
      return {
        error: "Unknown semantic service error",
        details: String(error),
      };
    }
  }

  /**
   * Check if the semantic service is available
   */
  static async isServiceAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.SEMANTIC_SERVICE_URL}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn("⚠️ Semantic service health check failed:", error);
      return false;
    }
  }

  /**
   * Batch validate multiple guesses (for efficiency)
   */
  static async validateGuessesBatch(
    guessAnswerPairs: Array<{ guess: string; answer: string; id: string }>,
    threshold: number = this.DEFAULT_THRESHOLD
  ): Promise<Array<{ id: string; result: SemanticValidationResult | SemanticServiceError }>> {
    console.log(`🔍 Batch validating ${guessAnswerPairs.length} guesses`);

    // Process guesses concurrently but with limit to avoid overwhelming the service
    const BATCH_SIZE = 5;
    const results = [];

    for (let i = 0; i < guessAnswerPairs.length; i += BATCH_SIZE) {
      const batch = guessAnswerPairs.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async ({ guess, answer, id }) => ({
        id,
        result: await this.validateGuess(guess, answer, threshold),
      }));

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be respectful to the service
      if (i + BATCH_SIZE < guessAnswerPairs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}
