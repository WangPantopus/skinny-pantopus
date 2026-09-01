import { buildFeedMediaCandidates, canUseNextImage } from '@/components/feed/FeedMediaImage';

describe('FeedMediaImage URL handling', () => {
  it('uses Next/Image only for configured image hosts', () => {
    expect(canUseNextImage('https://pantopus.com/media/post.jpg')).toBe(true);
    expect(canUseNextImage('https://assets.cloudfront.net/media/post.jpg')).toBe(true);
    expect(canUseNextImage('https://pantopus-uploads.s3.us-west-2.amazonaws.com/post.jpg')).toBe(true);
    expect(canUseNextImage('/api/media/post.jpg')).toBe(true);

    expect(canUseNextImage('https://www.opb.org/path/to/photo.jpg')).toBe(false);
    expect(canUseNextImage('https://images.example-news-cdn.com/photo.jpg')).toBe(false);
    expect(canUseNextImage('data:image/png;base64,abc')).toBe(false);
  });

  it('keeps third-party publisher image URLs as renderable candidates', () => {
    expect(buildFeedMediaCandidates('https://www.opb.org/path/to/photo.jpg')).toEqual([
      'https://www.opb.org/path/to/photo.jpg',
    ]);
  });
});
