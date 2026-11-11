// "5 Nov 2025": unambiguous, unlike 11/5/2025
export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// "11 Nov 2026, 16:10"
export const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
