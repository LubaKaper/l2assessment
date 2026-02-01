/**
 * Enhanced Recommendation System
 * Uses LLM recommendations as primary, with smart fallback templates
 */

/**
 * Improved action templates with more specific guidance
 */
const actionTemplates = {
  "Billing Issue": {
    action: "Review billing account details. Contact billing support team.",
    routing: "billing_team",
    priority: "medium"
  },
  "Billing Issue - Payment Failed": {
    action: "Investigate payment failure. Verify payment method and retry processing.",
    routing: "billing_team",
    priority: "high"
  },
  "Billing Issue - Upgrade Request": {
    action: "Send pricing information and upgrade options. Assist with plan change.",
    routing: "sales_team",
    priority: "medium"
  },
  "Billing Issue - Account Change": {
    action: "Process account modification request. Confirm changes with customer.",
    routing: "billing_team",
    priority: "medium"
  },
  "Technical Problem": {
    action: "Investigate reported technical issue. Request logs and reproduction steps if needed.",
    routing: "technical_support",
    priority: "medium"
  },
  "Technical Problem - Service Outage": {
    action: "IMMEDIATE: Escalate to DevOps. Check status dashboard. Notify affected customers.",
    routing: "devops_team",
    priority: "critical"
  },
  "Technical Problem - UI Bug": {
    action: "Log bug report. Request screenshots and browser details. Assign to engineering.",
    routing: "technical_support",
    priority: "low"
  },
  "Technical Problem - Performance Issue": {
    action: "Investigate performance degradation. Check system metrics and user impact.",
    routing: "technical_support",
    priority: "high"
  },
  "General Inquiry": {
    action: "Respond with requested information. Link to relevant documentation.",
    routing: "customer_support",
    priority: "medium"
  },
  "Feature Request": {
    action: "Thank customer for feedback. Log request for product team review.",
    routing: "product_team",
    priority: "low"
  },
  "Positive Feedback": {
    action: "Send thank you response. Share feedback with team for morale. No urgent action.",
    routing: "customer_support",
    priority: "low"
  },
  "Complaint": {
    action: "Acknowledge frustration. Investigate issue and provide resolution timeline.",
    routing: "customer_support",
    priority: "high"
  },
  "Account Management": {
    action: "Process account request. Verify identity and make requested changes.",
    routing: "customer_support",
    priority: "medium"
  },
  "Unknown": {
    action: "Review message manually. Clarify customer needs before categorizing.",
    routing: "customer_support",
    priority: "medium"
  }
};

/**
 * Get recommended action - uses LLM recommendation if available
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {object} llmOutput - Optional LLM output with recommendedAction
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency, llmOutput = null) {
  // Prefer LLM recommendation if available
  if (llmOutput && llmOutput.recommendedAction) {
    return llmOutput.recommendedAction;
  }
  
  // Try exact category match
  if (actionTemplates[category]) {
    return actionTemplates[category].action;
  }
  
  // Try partial match (e.g., "Technical Problem - Service Outage" matches "Technical Problem")
  const baseCategory = category.split(' - ')[0];
  if (actionTemplates[baseCategory]) {
    return actionTemplates[baseCategory].action;
  }
  
  // Fallback based on urgency
  if (urgency === "Critical" || urgency === "High") {
    return "URGENT: Review immediately and escalate to appropriate team. Respond within 1 hour.";
  }
  
  return "Review message and provide appropriate response based on customer needs.";
}

/**
 * Get routing recommendation (which team should handle this)
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended team
 */
export function getRoutingRecommendation(category, urgency) {
  // Try exact category match
  if (actionTemplates[category]) {
    return actionTemplates[category].routing;
  }
  
  // Try partial match
  const baseCategory = category.split(' - ')[0];
  if (actionTemplates[baseCategory]) {
    return actionTemplates[baseCategory].routing;
  }
  
  // Fallback based on urgency and keywords
  if (urgency === "Critical") {
    return "escalation_team";
  }
  
  if (category.toLowerCase().includes('billing')) {
    return "billing_team";
  }
  
  if (category.toLowerCase().includes('technical')) {
    return "technical_support";
  }
  
  return "customer_support";
}

/**
 * Get all available categories
 * 
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates);
}

/**
 * Determine if message should be escalated based on urgency and category
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string} message - The original message
 * @returns {object} - Escalation recommendation with reason
 */
export function shouldEscalate(category, urgency, message) {
  const reasons = [];
  let escalate = false;
  
  // Critical urgency always escalates
  if (urgency === "Critical") {
    escalate = true;
    reasons.push("Critical urgency level");
  }
  
  // Service outages escalate
  if (category.includes("Outage") || category.includes("Service")) {
    escalate = true;
    reasons.push("Service availability issue");
  }
  
  // High priority + technical = escalate
  if (urgency === "High" && category.includes("Technical")) {
    escalate = true;
    reasons.push("High priority technical issue");
  }
  
  // Angry customer indicators
  const angerWords = ['angry', 'furious', 'unacceptable', 'terrible', 'worst', 'ridiculous'];
  const hasAnger = angerWords.some(word => message.toLowerCase().includes(word));
  if (hasAnger && urgency !== "Low") {
    escalate = true;
    reasons.push("Customer dissatisfaction detected");
  }
  
  // Very long detailed complaints
  if (message.length > 300 && urgency !== "Low") {
    escalate = true;
    reasons.push("Complex issue requiring senior attention");
  }
  
  return {
    shouldEscalate: escalate,
    reasons: reasons,
    suggestedTeam: escalate ? "senior_support" : getRoutingRecommendation(category, urgency)
  };
}

/**
 * Get response time SLA based on urgency
 * 
 * @param {string} urgency - The urgency level
 * @returns {string} - Expected response time
 */
export function getResponseTimeSLA(urgency) {
  const slaMap = {
    "Critical": "15 minutes",
    "High": "1 hour",
    "Medium": "4 hours",
    "Low": "24 hours"
  };
  
  return slaMap[urgency] || "4 hours";
}