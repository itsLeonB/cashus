import { useState } from 'react';

interface AsyncImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function AsyncImage({ src, alt, className = '' }: AsyncImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {loading && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg"></div>
      )}
      {error ? (
        <div className="bg-gray-100 rounded-lg flex items-center justify-center h-64">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`w-full rounded-lg border shadow-sm ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
    </div>
  );
}
