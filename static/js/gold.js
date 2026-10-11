(() => {
  const INTERVAL = 15000;
  const DURATION = 1100;

  function run() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const shimmer = () => {
      const elements = [...document.querySelectorAll(".gold-shimmer")];
      elements.forEach((element, index) => {
        window.setTimeout(() => {
          element.classList.add("is-shimmering");
          window.setTimeout(() => element.classList.remove("is-shimmering"), DURATION);
        }, index * 45);
      });
    };

    window.setTimeout(shimmer, 1000);
    window.setInterval(shimmer, INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
