/**
 * A simple animated loading spinner component.
 * @param {'sm' | 'md' | 'lg'} size
 * @param {string} className - Extra Tailwind classes
 */
export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`inline-block rounded-full border-gray-200 border-t-primary-600 animate-spin ${sizeMap[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
