import type { ComponentProps, ReactNode } from 'react';
import PortfolioTab, { type PortfolioEntry } from './PortfolioTab';
import ReviewsTab from './ReviewsTab';

interface WorkTabProps {
  portfolio: PortfolioEntry[];
  reviews: ComponentProps<typeof ReviewsTab>;
  /** Shown above the work while Open Gigs is on (task reliability). */
  before?: ReactNode;
}

/**
 * Work: the person's portfolio and reviews, together. The profile shows this tab only when one of them has
 * something (or you have a review to write), so a neighbor's profile never opens on empty professional boxes.
 */
export default function WorkTab({ portfolio, reviews, before = null }: WorkTabProps) {
  const showReviews = reviews.reviews.length > 0 || (reviews.pendingReview && !reviews.isOwnProfile) || reviews.loading;
  return (
    <div className="flex flex-col gap-8">
      {before}
      {portfolio.length > 0 && (
        <section aria-labelledby="profile-work-portfolio">
          <h3 id="profile-work-portfolio" className="mb-3 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Portfolio</h3>
          <PortfolioTab items={portfolio} />
        </section>
      )}
      {showReviews && (
        <section aria-labelledby="profile-work-reviews">
          <h3 id="profile-work-reviews" className="mb-3 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Reviews</h3>
          <ReviewsTab {...reviews} />
        </section>
      )}
    </div>
  );
}
