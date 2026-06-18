/**
 * ErrorBanner — displays a prominent error message box.
 *
 * @param message - The error text to show.
 */
export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="w-full p-4 bg-red-50 dark:bg-red-950 border border-red-700 text-red-800 dark:text-red-200 text-sm">
      {message}
    </div>
  );
}
