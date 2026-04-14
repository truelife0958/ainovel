import type { ReviewSummary } from "@/types/review";

export type ReviewFocus = {
  metaItems: string[];
  detailItems: Array<{
    label: string;
    value: string;
  }>;
  recommendationLabel: string;
  summaryText: string;
  secondaryLabels: string[];
  actionHref: string | null;
  emptyMessage: string;
  followupMessage: string;
};

export function buildReviewFocus(summary: ReviewSummary): ReviewFocus;
