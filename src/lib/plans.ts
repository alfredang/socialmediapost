export type PlanId = "free" | "basic" | "professional" | "advanced" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number; // USD per month
  yearly: number; // USD per month billed annually
  profiles: number;
  uploadsPerMonth: number;
  ffmpegMinutes: number;
  team: number; // seats beyond owner
  blurb: string;
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    profiles: 1,
    uploadsPerMonth: 10,
    ffmpegMinutes: 30,
    team: 0,
    blurb: "Try the API with 10 uploads a month.",
  },
  {
    id: "basic",
    name: "Basic",
    monthly: 16,
    yearly: 16 * 12 * 0.5 / 12, // shown as $16/mo, $192 billed annually
    profiles: 5,
    uploadsPerMonth: 100,
    ffmpegMinutes: 300,
    team: 0,
    blurb: "For individuals who want a simple way to publish to multiple platforms.",
  },
  {
    id: "professional",
    name: "Professional",
    monthly: 33,
    yearly: 33,
    profiles: 25,
    uploadsPerMonth: 500,
    ffmpegMinutes: 1000,
    team: 3,
    blurb: "For creators and freelancers who post regularly and need more flexibility.",
    popular: true,
  },
  {
    id: "advanced",
    name: "Advanced",
    monthly: 118,
    yearly: 118,
    profiles: 75,
    uploadsPerMonth: 2000,
    ffmpegMinutes: 3000,
    team: 10,
    blurb: "For startups and marketing teams managing multiple social accounts.",
  },
  {
    id: "business",
    name: "Business",
    monthly: 350,
    yearly: 350,
    profiles: 225,
    uploadsPerMonth: 10000,
    ffmpegMinutes: 10000,
    team: 25,
    blurb: "Scalable plan for companies with flexible pricing for additional profiles.",
  },
];

export const PLAN_PRICING: Record<PlanId, { monthly: number; annualTotal: number; saveYr: number }> = {
  free: { monthly: 0, annualTotal: 0, saveYr: 0 },
  basic: { monthly: 16, annualTotal: 192, saveYr: 96 },
  professional: { monthly: 33, annualTotal: 400, saveYr: 200 },
  advanced: { monthly: 118, annualTotal: 1411, saveYr: 353 },
  business: { monthly: 350, annualTotal: 4205, saveYr: 1051 },
};

export function getPlan(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
