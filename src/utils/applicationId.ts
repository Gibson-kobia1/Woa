export const resolveActiveApplicationId = (
  submittedApplicationId: string | null | undefined,
  trackedApplicationId: string | null | undefined,
  fallbackId: string,
) => submittedApplicationId || trackedApplicationId || fallbackId;
