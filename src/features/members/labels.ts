// Membership labels without React — read by the server page and the client form.

/** Plans of a membership (`memberships.plan` without `none`), in the order the admin lists them. */
export const MEMBERSHIP_PLANS = ["patron", "founding", "institution"] as const;
export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

export const PLAN_LABEL: Record<MembershipPlan | "none", string> = {
  none: "—",
  patron: "Patron",
  founding: "Founding patron",
  institution: "Institution",
};
