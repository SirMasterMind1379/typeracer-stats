import { useState } from "react";
import { Key, Eye, EyeOff } from "lucide-react";

export default function SearchForm({
  value,
  apiKey,
  onChange,
  onApiKeyChange,
  onSubmit,
  loading,
}: {
  value: string;
  apiKey: string;
  onChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const [showField, setShowField] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto w-full flex flex-col gap-3">
      <div className="flex gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Username or profile link..."
          className="flex-1 p-3 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-900 text-sm"
        />
        <button
          type="submit"
          className="px-5 py-3 bg-red-900 text-beige-50 font-semibold hover:bg-red-800 disabled:opacity-50 text-sm"
          disabled={loading}
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowField((p) => !p)}
          className="flex items-center gap-1.5 text-xs text-beige-700 dark:text-zinc-400 hover:text-beige-900 dark:hover:text-zinc-300"
        >
          <Key size={14} />
          {showField ? "Hide API Key" : "Enter API Key (optional)"}
        </button>
        <span className="text-xs text-beige-600 dark:text-zinc-500">
          — Get yours at{" "}
          <a
            href="https://data.typeracer.com/pit/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-red-900 dark:text-red-400 hover:text-red-800"
          >
            data.typeracer.com/pit/api_keys
          </a>
        </span>
      </div>

      {showField && (
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Your TypeRacer API key..."
            className="w-full p-3 pr-10 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-900 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-beige-600 dark:text-zinc-400 hover:text-beige-900 dark:hover:text-zinc-300"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      )}
    </form>
  );
}
