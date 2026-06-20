import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save, Download } from "lucide-react";

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export default function SearchForm({
  value,
  apiKey,
  onChange,
  onApiKeyChange,
  onSubmit,
  loading,
  canRefresh,
}: {
  value: string;
  apiKey: string;
  onChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  canRefresh?: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const [showField, setShowField] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!value && !apiKey) {
      const savedUser = getCookie("tr_username");
      const savedKey = getCookie("tr_api_key");
      if (savedUser) onChange(savedUser);
      if (savedKey) onApiKeyChange(savedKey);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleSave = () => {
    if (value.trim() && apiKey.trim()) {
      setCookie("tr_username", value.trim());
      setCookie("tr_api_key", apiKey.trim());
      setSaveMsg("Credentials saved to browser cookie");
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const handleLoad = () => {
    const savedUser = getCookie("tr_username");
    const savedKey = getCookie("tr_api_key");
    if (savedUser) onChange(savedUser);
    if (savedKey) onApiKeyChange(savedKey);
    if (savedUser || savedKey) {
      setSaveMsg("Loaded saved credentials from cookie");
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const hasCookieCreds = !!(getCookie("tr_username") || getCookie("tr_api_key"));
  const canSave = value.trim() && apiKey.trim();
  const canLoad = !canSave && hasCookieCreds;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto w-full flex flex-col gap-2">
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
          {loading ? "Loading..." : canRefresh ? "Refresh" : "Search"}
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: showField ? "1fr" : "0fr" }}
      >
          <div className="overflow-hidden">
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
      </div>
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
        {showField && (
          <>
            <button
              type="button"
              onClick={canSave ? handleSave : handleLoad}
              className={`flex items-center gap-1 text-xs px-2 py-1 border ${
                canSave
                  ? "border-red-900 text-red-900 dark:text-red-400 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  : "border-beige-300 dark:border-zinc-600 text-beige-700 dark:text-zinc-400 hover:bg-beige-200 dark:hover:bg-zinc-800"
              } ${!canSave && !canLoad ? "opacity-30 pointer-events-none" : ""}`}
              disabled={!canSave && !canLoad}
            >
              {canSave ? <Save size={12} /> : <Download size={12} />}
              <span className="ml-1">{canSave ? "Save" : "Load"} Credentials</span>
            </button>
          </>
        )}
      </div>

      {saveMsg && (
        <p className="text-xs text-beige-700 dark:text-zinc-400 bg-beige-100 dark:bg-zinc-800 border border-beige-300 dark:border-zinc-700 px-3 py-2">
          {saveMsg}
        </p>
      )}
    </form>
  );
}
