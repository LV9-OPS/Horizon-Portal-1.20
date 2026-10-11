(() => {
  const form = document.getElementById("admin-code-form");
  if (!form) return;

  const button = document.getElementById("admin-generate-button");
  const error = document.getElementById("admin-code-error");
  const result = document.getElementById("admin-code-result");
  const list = document.getElementById("admin-code-list");
  const copy = document.getElementById("admin-copy-codes");
  let generatedCodes = [];

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.hidden = true;
    result.hidden = true;
    generatedCodes = [];
    button.disabled = true;
    button.textContent = "Generating…";

    try {
      const response = await fetch("/api/admin/redeem-codes", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          entitlement: document.getElementById("admin-entitlement").value,
          count: Number(document.getElementById("admin-code-count").value)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          window.location.assign("/admin/login?next=%2Fadmin");
          return;
        }
        throw new Error(data.detail || "Code generation failed.");
      }
      generatedCodes = Array.isArray(data.codes) ? data.codes : [];
      if (!generatedCodes.length) throw new Error("The server returned no codes.");
      list.textContent = generatedCodes.join("\n");
      result.hidden = false;
    } catch (requestError) {
      error.textContent = requestError.message || "Code generation failed.";
      error.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Generate codes";
    }
  });

  copy.addEventListener("click", async () => {
    if (!generatedCodes.length) return;
    try {
      await navigator.clipboard.writeText(generatedCodes.join("\n"));
      copy.textContent = "Copied";
      window.setTimeout(() => { copy.textContent = "Copy all"; }, 1600);
    } catch {
      error.textContent = "Clipboard access was denied. Select and copy the codes manually.";
      error.hidden = false;
    }
  });
})();
