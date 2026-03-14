import { describe, it, expect } from 'vitest'
import { calculateUrgency } from './urgencyScorer'
import { getMockCategorization } from './llmHelper'
import { getRoutingRecommendation, getResponseTimeSLA, shouldEscalate } from './templates'

// --- calculateUrgency (the bug we fixed) ---

describe('calculateUrgency', () => {
  it('uses LLM urgency when provided (the fix)', () => {
    // Before the fix, this was called without llmOutput so rule-based kicked in.
    // A short polite message like this would have scored low even if LLM said Critical.
    const result = calculateUrgency('Our server is down.', { urgency: 'Critical' })
    expect(result).toBe('Critical')
  })

  it('falls back to rules when no LLM output given', () => {
    const result = calculateUrgency('Our production server is completely down!')
    expect(result).toBe('Critical')
  })

  it('rule-based: positive feedback → Low', () => {
    const result = calculateUrgency('Thanks so much for your help, really appreciate it!')
    expect(result).toBe('Low')
  })

  it('rule-based: feature request → Medium or Low', () => {
    const result = calculateUrgency('Could you add a dark mode feature please?')
    expect(['Low', 'Medium']).toContain(result)
  })
})

// --- getMockCategorization (old keyword system, used in before/after) ---

describe('getMockCategorization (old keyword system)', () => {
  it('server down → incorrectly returns Medium (old system bug, LLM fixes this)', () => {
    // Old system only reaches Critical when BOTH critical AND technical keywords match.
    // "production server completely down" has critical keywords but no technical keywords
    // (bug, error, broken, etc.), so it falls through to General Inquiry / Medium.
    // This is exactly the bug the new LLM-based system was built to fix.
    const result = getMockCategorization('Our production server is completely down. This is an emergency!')
    expect(result.urgency).toBe('Medium')
  })

  it('payment failed → Billing, High urgency', () => {
    const result = getMockCategorization('My payment failed and I was charged anyway.')
    expect(result.category).toMatch(/Billing/)
    expect(result.urgency).toBe('High')
  })

  it('positive feedback → Low urgency', () => {
    const result = getMockCategorization('Thanks so much, your support team is amazing!')
    expect(result.urgency).toBe('Low')
    expect(result.category).toBe('Positive Feedback')
  })

  it('feature request → Low urgency', () => {
    const result = getMockCategorization('I would like a dark mode feature added to the dashboard.')
    expect(result.urgency).toBe('Low')
    expect(result.category).toBe('Feature Request')
  })
})

// --- getRoutingRecommendation (new field we added to results) ---

describe('getRoutingRecommendation', () => {
  it('service outage → devops_team', () => {
    expect(getRoutingRecommendation('Technical Problem - Service Outage', 'Critical')).toBe('devops_team')
  })

  it('billing issue → billing_team', () => {
    expect(getRoutingRecommendation('Billing Issue - Payment Failed', 'High')).toBe('billing_team')
  })

  it('upgrade request → sales_team', () => {
    expect(getRoutingRecommendation('Billing Issue - Upgrade Request', 'Medium')).toBe('sales_team')
  })

  it('feature request → product_team', () => {
    expect(getRoutingRecommendation('Feature Request', 'Low')).toBe('product_team')
  })
})

// --- getResponseTimeSLA (new field we added to results) ---

describe('getResponseTimeSLA', () => {
  it('Critical → 15 minutes', () => {
    expect(getResponseTimeSLA('Critical')).toBe('15 minutes')
  })

  it('High → 1 hour', () => {
    expect(getResponseTimeSLA('High')).toBe('1 hour')
  })

  it('Low → 24 hours', () => {
    expect(getResponseTimeSLA('Low')).toBe('24 hours')
  })
})

// --- shouldEscalate (new field we added to results) ---

describe('shouldEscalate', () => {
  it('Critical urgency always escalates', () => {
    const result = shouldEscalate('Technical Problem - Service Outage', 'Critical', 'Server is down')
    expect(result.shouldEscalate).toBe(true)
    expect(result.reasons).toContain('Critical urgency level')
  })

  it('angry customer language triggers escalation', () => {
    const result = shouldEscalate('Complaint', 'High', 'This is unacceptable and furious about it')
    expect(result.shouldEscalate).toBe(true)
    expect(result.reasons).toContain('Customer dissatisfaction detected')
  })

  it('low urgency positive feedback does not escalate', () => {
    const result = shouldEscalate('Positive Feedback', 'Low', 'Thanks so much!')
    expect(result.shouldEscalate).toBe(false)
  })
})
