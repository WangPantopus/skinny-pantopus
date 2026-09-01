'use client';

/* eslint-disable @next/next/no-img-element */
import { useRef, useState, useEffect } from 'react';

type LazyImageProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
};

/**
 * Lazy-loads an image using IntersectionObserver.
 * Shows a placeholder until the image enters the viewport.
 */
export default function LazyImage({
  src,
  alt,
  className,
  width,
  height,
}: LazyImageProps) {
  const imgRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{ width, height }}
    >
      {/* Placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-app-surface-sunken animate-pulse" />
      )}
      {isVisible && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={() => setLoaded(true)}
          className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
        />
      )}
    </div>
  );
}
