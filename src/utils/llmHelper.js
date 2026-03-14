import Groq from 'groq-sdk';

/**
 * Enhanced LLM Helper for intelligent customer support triage
 * Uses structured prompting to get comprehensive analysis in one call
 */

// Initialize Groq client
const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

/**
 * Categorize and analyze a customer support message using AI
 * Returns structured output with category, urgency, and recommendations
 * 
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, urgency: string, urgencyScore: number, recommendedAction: string, reasoning: string, keywords: string[]}>}
 */
export async function categorizeMessage(message) {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an expert customer support triage system. Analyze messages and provide structured categorization.

URGENCY LEVELS (use business impact as primary criteria):
- Critical: Production issues, security breaches, data loss, complete service outage, legal threats
- High: Billing errors blocking usage, important features broken, angry customers, time-sensitive requests
- Medium: Feature requests, non-blocking bugs, general questions, account changes
- Low: Positive feedback, general inquiries, suggestions, thank you messages

CATEGORIES (be specific and descriptive):
- Technical Problem - [Severity]: e.g., "Technical Problem - Service Outage", "Technical Problem - UI Bug"
- Billing Issue - [Type]: e.g., "Billing Issue - Payment Failed", "Billing Issue - Upgrade Request"  
- Feature Request: Product enhancement suggestions
- General Inquiry: Questions, information requests
- Positive Feedback: Thanks, praise, satisfaction
- Complaint: Dissatisfaction without specific technical issue
- Account Management: Password resets, profile changes
- Other: [Describe]: Use when none above fit, be descriptive

RESPONSE FORMAT (respond with valid JSON only, no markdown):
{
  "category": "Specific category name",
  "urgency": "Critical|High|Medium|Low",
  "urgency_score": 0-100,
  "recommended_action": "Specific next step tailored to this message",
  "reasoning": "Brief explanation of categorization and urgency",
  "keywords": ["key", "words", "detected"]
}

EXAMPLES:

Message: "Our production server is down"
{
  "category": "Technical Problem - Service Outage",
  "urgency": "Critical",
  "urgency_score": 95,
  "recommended_action": "Immediately escalate to DevOps team. Check server status dashboard and notify affected customers.",
  "reasoning": "Production infrastructure failure affecting all users. Requires immediate technical response.",
  "keywords": ["production", "server", "down"]
}

Message: "Can I upgrade my subscription to the pro plan?"
{
  "category": "Billing Issue - Upgrade Request",
  "urgency": "Medium",
  "urgency_score": 50,
  "recommended_action": "Send upgrade options and pricing link. Offer to assist with subscription change.",
  "reasoning": "Routine billing inquiry. Customer wants to increase service level - positive intent.",
  "keywords": ["upgrade", "subscription", "pro plan"]
}

Message: "Thank you for your amazing customer service!"
{
  "category": "Positive Feedback",
  "urgency": "Low",
  "urgency_score": 20,
  "recommended_action": "Send thank you reply. Log feedback for team recognition. No immediate action needed.",
  "reasoning": "Customer expressing satisfaction. Acknowledge but no support action required.",
  "keywords": ["thank you", "amazing", "customer service"]
}`
        },
        {
          role: "user",
          content: `Analyze this customer support message: "${message}"`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent structured output
    });

    const content = response.choices[0].message.content.trim();
    
    // Parse JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(jsonContent);
    } catch (parseError) {
      console.warn('Failed to parse JSON, using fallback parsing:', parseError);
      return fallbackParsing(content, message);
    }
    
    // Validate and return structured response
    return {
      category: parsedResponse.category || "Unknown",
      urgency: parsedResponse.urgency || "Medium",
      urgencyScore: parsedResponse.urgency_score || 50,
      recommendedAction: parsedResponse.recommended_action || "Review manually.",
      reasoning: parsedResponse.reasoning || content,
      keywords: parsedResponse.keywords || []
    };
    
  } catch (error) {
    console.warn('Groq API failed, using mock response:', error.message);
    return getMockCategorization(message);
  }
}

/**
 * Fallback parsing when JSON parsing fails
 */
function fallbackParsing(content, message) {
  const lowerContent = content.toLowerCase();
  
  // Try to extract category
  let category = "Unknown";
  if (lowerContent.includes('billing')) category = "Billing Issue";
  else if (lowerContent.includes('technical') || lowerContent.includes('bug')) category = "Technical Problem";
  else if (lowerContent.includes('feature')) category = "Feature Request";
  else if (lowerContent.includes('positive') || lowerContent.includes('feedback')) category = "Positive Feedback";
  else if (lowerContent.includes('inquiry') || lowerContent.includes('question')) category = "General Inquiry";
  
  // Try to extract urgency
  let urgency = "Medium";
  let urgencyScore = 50;
  if (lowerContent.includes('critical') || lowerContent.includes('urgent') || lowerContent.includes('down')) {
    urgency = "Critical";
    urgencyScore = 95;
  } else if (lowerContent.includes('high')) {
    urgency = "High";
    urgencyScore = 75;
  } else if (lowerContent.includes('low')) {
    urgency = "Low";
    urgencyScore = 25;
  }
  
  return {
    category,
    urgency,
    urgencyScore,
    recommendedAction: "Review and respond appropriately.",
    reasoning: content,
    keywords: []
  };
}

/**
 * Enhanced mock categorization with intelligent analysis
 */
export function getMockCategorization(message) {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/);
  
  // Critical infrastructure keywords
  const criticalKeywords = ['down', 'outage', 'crash', 'server', 'production', 'emergency', 'urgent', 'asap', 'immediately'];
  const hasCritical = criticalKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Billing keywords
  const billingKeywords = ['bill', 'payment', 'charge', 'invoice', 'credit card', 'subscription', 'refund', 'cancel'];
  const hasBilling = billingKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Technical keywords
  const technicalKeywords = ['bug', 'error', 'broken', 'not working', 'issue', 'problem', 'loading', 'slow'];
  const hasTechnical = technicalKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Positive sentiment
  const positiveKeywords = ['thank', 'thanks', 'appreciate', 'grateful', 'love', 'great', 'excellent', 'amazing'];
  const hasPositive = positiveKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Feature request indicators
  const featureKeywords = ['feature', 'add', 'could you', 'would like', 'suggestion', 'improve', 'wish'];
  const hasFeature = featureKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Determine category and urgency
  let category, urgency, urgencyScore, recommendedAction, reasoning;
  
  if (hasCritical && hasTechnical) {
    category = "Technical Problem - Service Outage";
    urgency = "Critical";
    urgencyScore = 95;
    recommendedAction = "Immediately escalate to technical team. Verify system status and notify affected users.";
    reasoning = "Critical infrastructure issue detected. Keywords indicate service disruption affecting production systems.";
  } else if (hasBilling) {
    category = lowerMessage.includes('upgrade') || lowerMessage.includes('change') 
      ? "Billing Issue - Account Change" 
      : "Billing Issue";
    urgency = lowerMessage.includes('block') || lowerMessage.includes('fail') ? "High" : "Medium";
    urgencyScore = urgency === "High" ? 75 : 50;
    recommendedAction = "Review billing details. Provide account assistance and payment options.";
    reasoning = "Billing-related inquiry detected. Customer needs assistance with account or payment matters.";
  } else if (hasTechnical) {
    category = "Technical Problem";
    urgency = "Medium";
    urgencyScore = 55;
    recommendedAction = "Investigate reported issue. Request additional details if needed and provide troubleshooting steps.";
    reasoning = "Technical issue reported. Requires investigation and potential troubleshooting.";
  } else if (hasPositive) {
    category = "Positive Feedback";
    urgency = "Low";
    urgencyScore = 20;
    recommendedAction = "Send thank you response. Log positive feedback for team morale. No urgent action needed.";
    reasoning = "Customer expressing satisfaction. Acknowledge appreciation but no support action required.";
  } else if (hasFeature) {
    category = "Feature Request";
    urgency = "Low";
    urgencyScore = 30;
    recommendedAction = "Log feature request for product team review. Thank customer for feedback.";
    reasoning = "Product enhancement suggestion. Forward to product team for consideration.";
  } else if (lowerMessage.includes('?')) {
    category = "General Inquiry";
    urgency = "Medium";
    urgencyScore = 45;
    recommendedAction = "Provide requested information. Link to relevant documentation if available.";
    reasoning = "Customer asking question. Provide helpful information or guidance.";
  } else {
    category = "General Inquiry";
    urgency = "Medium";
    urgencyScore = 50;
    recommendedAction = "Review message and provide appropriate response. Clarify customer needs if unclear.";
    reasoning = "General message requiring review and response.";
  }
  
  // Extract keywords
  const allKeywords = [...criticalKeywords, ...billingKeywords, ...technicalKeywords, ...positiveKeywords, ...featureKeywords];
  const keywords = allKeywords.filter(keyword => lowerMessage.includes(keyword)).slice(0, 5);
  
  return {
    category,
    urgency,
    urgencyScore,
    recommendedAction,
    reasoning,
    keywords
  };
}