const BLOCKED_KEYWORDS = [
  'noreply',
  'no-reply',
  'notification',
  'mailer',
  'facebook',
  'meta',
  'google',
  'amazon',
  'stripe',
  'paypal',
  'linkedin',
  'twitter',
  'instagram',
  'newsletter',
  'promo',
];

const BLOCKED_LOCAL_PARTS = [
  'info',
  'support',
  'admin',
  'billing',
  'help',
  'contact',
  'sales',
  'service',
];

export function isProfessionalHumanEmail(email: string): boolean {
  if (!email) return false;

  const lower = email.toLowerCase();

  if (BLOCKED_KEYWORDS.some((k) => lower.includes(k))) return false;

  const [local, domain] = lower.split('@');
  if (!local || !domain) return false;

  if (BLOCKED_LOCAL_PARTS.includes(local)) return false;

  if (!/^[a-z]+([._]?[a-z]+)*$/.test(local)) return false;

  if (!domain.includes('.')) return false;

  return true;
}
