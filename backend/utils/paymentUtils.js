export const PLAN_LIMITS = {
  Free: 1,
  Bronze: 3,
  Silver: 5,
  Gold: -1, // -1 represents unlimited
};

export const PLAN_PRICES = {
  Bronze: 100,
  Silver: 300,
  Gold: 1000,
};

/**
 * Checks if current time in IST (Asia/Kolkata) is between 10:00 AM and 11:00 AM IST.
 * 10:00 AM to 10:59:59 AM IST => Hour 10.
 */
export function isWithinISTPaymentWindow() {
  const options = {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "numeric",
    minute: "numeric",
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(new Date());

  let hour = 0;
  for (const part of parts) {
    if (part.type === "hour") {
      hour = parseInt(part.value, 10);
    }
  }

  // 10:00 AM IST to 10:59:59 AM IST is hour === 10
  return hour === 10;
}

/**
 * Evaluates a user's effective subscription plan.
 * If expired, falls back to 'Free'.
 */
export function getEffectivePlan(user) {
  if (!user) return { plan: "Free", limit: PLAN_LIMITS.Free, expired: false };

  const currentPlan = user.subscriptionPlan || "Free";
  const limit = PLAN_LIMITS[currentPlan] ?? 1;

  if (currentPlan !== "Free" && user.subscriptionExpiresAt) {
    const expiresAt = new Date(user.subscriptionExpiresAt);
    if (expiresAt < new Date()) {
      return { plan: "Free", limit: PLAN_LIMITS.Free, expired: true, previousPlan: currentPlan };
    }
  }

  return { plan: currentPlan, limit, expired: false };
}
