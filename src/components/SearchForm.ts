import { getCookie, setCookie, escapeHtml } from "../types";

export interface SearchFormProps {
  value: string;
  apiKey: string;
  onChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  canRefresh?: boolean;
}

export function renderSearchForm(props: SearchFormProps): HTMLElement {
  const form = document.createElement("form");
  form.className = "max-w-xl mx-auto w-full flex flex-col gap-2";

  let showKey = false;
  let saveMsg = "";

  // Local mutable copies of the input values — survive re-renders (e.g. eye toggle)
  let currentUsername = props.value;
  let currentApiKey = props.apiKey;

  // Auto-expand API Key field if key exists
  let showField = !!props.apiKey;

  function update() {
    const usernameVal = currentUsername;
    const apiKeyVal = currentApiKey;

    const savedUsername = getCookie("tr_username");
    const savedApiKey = getCookie("tr_api_key");
    const hasSavedCredentials = !!(savedUsername || savedApiKey);
    const credentialsMatch = usernameVal === savedUsername && apiKeyVal === savedApiKey;

    form.innerHTML = `
      <div class="flex gap-3">
        <input
          id="username-input"
          type="text"
          name="username"
          autocomplete="username"
          value="${escapeHtml(usernameVal)}"
          placeholder="Username or profile link..."
          class="flex-1 p-3 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 text-beige-900 dark:text-beige-100 text-sm focus:outline-none focus:border-red-900 dark:focus:border-red-500"
        />
        <button
          type="submit"
          class="px-5 py-3 bg-red-900 dark:bg-red-800 text-beige-50 font-semibold hover:bg-red-800 dark:hover:bg-red-700 disabled:opacity-50 text-sm cursor-pointer border border-red-950 dark:border-red-700"
          ${props.loading ? "disabled" : ""}
        >
          ${props.loading ? "Loading..." : props.canRefresh ? "Refresh" : "Search"}
        </button>
      </div>

      <div
        class="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style="grid-template-rows: ${showField ? "1fr" : "0fr"}"
      >
        <div class="overflow-hidden">
          <div class="pt-1 flex flex-col gap-2">
            <div class="relative">
              <input
                id="apikey-input"
                type="${showKey ? "text" : "password"}"
                name="apikey"
                autocomplete="current-password"
                value="${escapeHtml(apiKeyVal)}"
                placeholder="Your TypeRacer API key..."
                class="w-full p-3 pr-10 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 text-beige-900 dark:text-beige-100 text-sm font-mono focus:outline-none focus:border-red-900 dark:focus:border-red-500"
              />
              <button
                id="toggle-eye-btn"
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-beige-600 dark:text-beige-400 hover:text-beige-900 dark:hover:text-beige-200 cursor-pointer"
              >
                ${showKey ? eyeOffSvg() : eyeSvg()}
              </button>
            </div>
            <div class="flex justify-end gap-2">
              <button
                id="save-cookie-btn"
                type="button"
                ${credentialsMatch ? "disabled" : ""}
                class="flex items-center gap-1.5 text-xs px-3 py-1 font-semibold border-2 border-red-800 dark:border-red-700 bg-white dark:bg-beige-900 text-red-900 dark:text-red-400 hover:bg-red-800 hover:text-white dark:hover:bg-red-800 dark:hover:text-white cursor-pointer transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-red-900 dark:disabled:hover:bg-beige-900 dark:disabled:hover:text-red-400"
              >
                Remember credentials
              </button>
              ${hasSavedCredentials ? `<button
                id="load-cookie-btn"
                type="button"
                class="flex items-center gap-1.5 text-xs px-3 py-1 font-semibold border border-beige-400 dark:border-beige-600 bg-beige-100 dark:bg-beige-900 text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-800 cursor-pointer transition-colors"
              >
                Load credentials
              </button>` : ""}
              ${hasSavedCredentials ? `<button
                id="clear-cookie-btn"
                type="button"
                class="flex items-center gap-1.5 text-xs px-3 py-1 font-semibold border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 text-beige-700 dark:text-beige-300 hover:bg-red-900 hover:text-white dark:hover:bg-red-800 dark:hover:text-white cursor-pointer transition-colors"
              >
                Clear credentials
              </button>` : ""}
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs gap-2 flex-wrap">
        <div class="flex items-center gap-1.5">
          <button
            id="toggle-field-btn"
            type="button"
            class="flex items-center gap-1 text-beige-700 dark:text-beige-400 hover:text-beige-900 dark:hover:text-beige-200 cursor-pointer"
          >
            ${keySvg()}
            ${showField ? "Hide API Key" : "Enter API Key (optional)"}
          </button>
          <span class="text-beige-600 dark:text-beige-400">
            — Get yours at
            <a
              href="https://data.typeracer.com/pit/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              class="underline underline-offset-2 text-red-900 dark:text-red-400 hover:text-red-800 ml-1"
            >data.typeracer.com/pit/api_keys</a>
          </span>
        </div>
      </div>

      ${
        saveMsg
          ? `<p class="text-xs text-beige-700 dark:text-beige-300 bg-beige-100 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 px-3 py-1.5">${escapeHtml(
              saveMsg
            )}</p>`
          : ""
      }
    `;

    // Attach Input Event Listeners (Update state silently without re-rendering DOM)
    const userInput = form.querySelector("#username-input") as HTMLInputElement;
    userInput?.addEventListener("input", (e) => {
      const v = (e.target as HTMLInputElement).value;
      if (/^[a-zA-Z0-9]{32}$/.test(v.trim())) {
        currentApiKey = v.trim();
        currentUsername = "";
        props.onApiKeyChange(v.trim());
        props.onChange("");
      } else {
        currentUsername = v;
        props.onChange(v);
      }
    });

    const apiKeyInput = form.querySelector("#apikey-input") as HTMLInputElement;
    apiKeyInput?.addEventListener("input", (e) => {
      currentApiKey = (e.target as HTMLInputElement).value;
      props.onApiKeyChange(currentApiKey);
    });

    form.querySelector("#toggle-eye-btn")?.addEventListener("click", () => {
      showKey = !showKey;
      update();
    });

    form.querySelector("#toggle-field-btn")?.addEventListener("click", () => {
      showField = !showField;
      update();
    });

    form.querySelector("#save-cookie-btn")?.addEventListener("click", () => {
      const u = (form.querySelector("#username-input") as HTMLInputElement)?.value.trim();
      const k = (form.querySelector("#apikey-input") as HTMLInputElement)?.value.trim();
      if (u) setCookie("tr_username", u);
      if (k) setCookie("tr_api_key", k);
      saveMsg = "Credentials saved to browser cookie";
      update();
      setTimeout(() => { saveMsg = ""; update(); }, 3000);
    });

    form.querySelector("#load-cookie-btn")?.addEventListener("click", () => {
      currentUsername = getCookie("tr_username");
      currentApiKey = getCookie("tr_api_key");
      props.onChange(currentUsername);
      props.onApiKeyChange(currentApiKey);
      saveMsg = "Credentials loaded from browser cookie";
      update();
      setTimeout(() => { saveMsg = ""; update(); }, 3000);
    });

    form.querySelector("#clear-cookie-btn")?.addEventListener("click", () => {
      setCookie("tr_username", "", -1);
      setCookie("tr_api_key", "", -1);
      saveMsg = "Saved credentials cleared from browser cookie";
      update();
      setTimeout(() => { saveMsg = ""; update(); }, 3000);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    props.onSubmit();
  });

  update();
  return form;
}

function eyeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function eyeOffSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499A10.75 10.75 0 0 1 2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.167-4.49"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
}

function keySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/></svg>`;
}
