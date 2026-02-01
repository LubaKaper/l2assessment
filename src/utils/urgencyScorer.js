/**
 * Enhanced Urgency Scorer - Validates and enhances LLM urgency assessment
 * Now works as a validation layer rather than primary scorer
 */

/**
 * Calculate urgency from LLM output with validation
 * @param {string} message - The original message
 * @param {object} llmOutput - Output from LLM with urgency and urgencyScore
 * @returns {string} - Validated urgency level
 */
export function calculateUrgency(message, llmOutput = null) {
  // If we have LLM output, use it as primary source
  if (llmOutput && llmOutput.urgency) {
    return llmOutput.urgency;
  }
  
  // Fallback to intelligent rule-based scoring
  return calculateUrgencyFromRules(message);
}

/**
 * Intelligent rule-based urgency calculation (fallback)
 * Fixed version of original logic
 */
function calculateUrgencyFromRules(message) {
  let urgencyScore = 50;
  const lowerMessage = message.toLowerCase();
  
  // CRITICAL INDICATORS (add significant points)
  const criticalWords = ['down', 'outage', 'crash', 'critical', 'emergency', 'production', 'server', 'urgent', 'asap', 'immediately'];
  criticalWords.forEach(word => {
    if (lowerMessage.includes(word)) urgencyScore += 40;
  });
  
  // HIGH PRIORITY INDICATORS
  const highPriorityWords = ['broken', 'not working', 'error', 'failed', 'blocking', 'stuck', 'cant', "can't", 'unable'];
  highPriorityWords.forEach(word => {
    if (lowerMessage.includes(word)) urgencyScore += 25;
  });
  
  // BILLING ISSUES (medium-high priority)
  const billingWords = ['payment', 'charge', 'bill', 'invoice', 'refund'];
  billingWords.forEach(word => {
    if (lowerMessage.includes(word)) urgencyScore += 15;
  });
  
  // Exclamation marks indicate urgency
  const exclamationCount = (message.match(/!/g) || []).length;
  urgencyScore += exclamationCount * 15;
  
  // ALL CAPS (genuine urgency indicator)
  if (message === message.toUpperCase() && message.length > 10) {
    urgencyScore += 25;
  }
  
  // SHORT URGENT MESSAGES (e.g., "Server down!")
  // These are often the MOST urgent - fixed logic
  if (message.length < 30 && urgencyScore > 70) {
    urgencyScore += 20; // Boost very short critical messages
  }
  
  // REDUCE urgency for positive sentiment
  const positiveWords = ['thank', 'thanks', 'appreciate', 'love', 'great', 'excellent', 'happy'];
  positiveWords.forEach(word => {
    if (lowerMessage.includes(word)) urgencyScore -= 30;
  });
  
  // REDUCE urgency for questions (usually inquiries, not problems)
  if (message.includes('?') && !lowerMessage.includes('why')) {
    urgencyScore -= 15;
  }
  
  // REDUCE urgency for polite, conversational tone
  const politeWords = ['please', 'kindly', 'could you', 'would you'];
  politeWords.forEach(word => {
    if (lowerMessage.includes(word) && urgencyScore < 70) {
      urgencyScore -= 10;
    }
  });
  
  // Feature requests are low priority
  if (lowerMessage.includes('feature') || lowerMessage.includes('suggestion')) {
    urgencyScore -= 20;
  }
  
  // Cap scores
  urgencyScore = Math.max(0, Math.min(100, urgencyScore));
  
  // Map to urgency levels
  if (urgencyScore >= 85) return "Critical";
  if (urgencyScore >= 65) return "High";
  if (urgencyScore >= 35) return "Medium";
  return "Low";
}

/**
 * Get urgency score as number (0-100)
 * @param {string} message - The message
 * @param {object} llmOutput - Optional LLM output
 * @returns {number} - Urgency score 0-100
 */
export function getUrgencyScore(message, llmOutput = null) {
  if (llmOutput && llmOutput.urgencyScore) {
    return llmOutput.urgencyScore;
  }
  
  const urgency = calculateUrgencyFromRules(message);
  const scoreMap = {
    "Critical": 95,
    "High": 75,
    "Medium": 50,
    "Low": 25
  };
  
  return scoreMap[urgency] || 50;
}

/**
 * Validate urgency against message content
 * Returns true if LLM urgency seems reasonable
 */
export function validateUrgency(message, llmUrgency) {
  const ruleBasedUrgency = calculateUrgencyFromRules(message);
  
  // Map urgencies to scores for comparison
  const scoreMap = {
    "Critical": 3,
    "High": 2,
    "Medium": 1,
    "Low": 0
  };
  
  const llmScore = scoreMap[llmUrgency] || 1;
  const ruleScore = scoreMap[ruleBasedUrgency] || 1;
  
  // Allow one level of difference
  return Math.abs(llmScore - ruleScore) <= 1;
}