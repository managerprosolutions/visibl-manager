
/* =========================================================
   VISIBL KPI — Composant global réutilisable
   Fichier : kpi.js
   Aucune donnée métier n'est codée ici.
========================================================= */

(function (global) {
  "use strict";

  const registry = new Map();
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    const cleaned = String(value ?? "")
      .replace(/\s/g, "")
      .replace(/[^0-9,.-]/g, "")
      .replace(/,/g, ".");

    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function formatValue(value, options = {}) {
    const n = toNumber(value);

    const locale = options.locale || "fr-FR";
    const maximumFractionDigits =
      Number.isInteger(options.maximumFractionDigits)
        ? options.maximumFractionDigits
        : 0;

    return new Intl.NumberFormat(locale, {
      maximumFractionDigits
    }).format(n);
  }

  function animateNumber(element, from, to, options = {}) {
    if (!element) return;

    const duration = Math.max(
      0,
      Number(options.duration ?? 650)
    );

    if (
      duration === 0 ||
      prefersReducedMotion ||
      !window.requestAnimationFrame
    ) {
      element.textContent = formatValue(to, options);
      element.dataset.currentValue = String(to);
      return;
    }

    const start = performance.now();

    const easeOutCubic = t =>
      1 - Math.pow(1 - t, 3);

    function frame(now) {
      const progress = Math.min(
        1,
        (now - start) / duration
      );

      const eased = easeOutCubic(progress);
      const current =
        from + (to - from) * eased;

      element.textContent =
        formatValue(current, options);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        element.dataset.currentValue = String(to);
      }
    }

    requestAnimationFrame(frame);
  }

  function trendState(value) {
    const n = toNumber(value);

    if (n > 0) return "up";
    if (n < 0) return "down";
    return "neutral";
  }

  function trendText(value, suffix = "%") {
    const n = toNumber(value);
    const sign = n > 0 ? "+" : "";
    return `${sign}${formatValue(n)}${suffix}`;
  }

  function buildSparkline(points, width = 240, height = 70) {
    if (!Array.isArray(points) || points.length < 2) {
      return null;
    }

    const nums = points.map(toNumber);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;

    const coords = nums.map((value, index) => {
      const x =
        (index / (nums.length - 1)) * width;

      const y =
        height -
        ((value - min) / range) *
          (height - 12) -
        6;

      return [x, y];
    });

    const linePath = coords
      .map((p, i) =>
        `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
      )
      .join(" ");

    const areaPath =
      `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return {
      linePath,
      areaPath,
      last: coords[coords.length - 1]
    };
  }

  function updateSparkline(card, points) {
    const svg = card.querySelector("[data-kpi-chart]");
    if (!svg) return;

    if (!Array.isArray(points) || points.length < 2) {
      svg.hidden = true;
      return;
    }

    const result = buildSparkline(points);
    if (!result) {
      svg.hidden = true;
      return;
    }

    svg.hidden = false;

    const area = svg.querySelector(".kpi-area");
    const line = svg.querySelector(".kpi-line");
    const dot = svg.querySelector(".kpi-dot");

    if (area) area.setAttribute("d", result.areaPath);
    if (line) line.setAttribute("d", result.linePath);

    if (dot) {
      dot.setAttribute("cx", result.last[0]);
      dot.setAttribute("cy", result.last[1]);
    }
  }

  function updateRing(card, percent) {
    const ring = card.querySelector("[data-kpi-ring]");
    if (!ring) return;

    if (percent == null || percent === "") {
      ring.hidden = true;
      return;
    }

    const value = Math.max(
      0,
      Math.min(100, toNumber(percent))
    );

    ring.hidden = false;

    const circle =
      ring.querySelector(".ring-value");

    const label =
      ring.querySelector(".ring-label");

    const radius = 28;
    const circumference =
      2 * Math.PI * radius;

    if (circle) {
      circle.setAttribute(
        "stroke-dasharray",
        String(circumference)
      );

      circle.setAttribute(
        "stroke-dashoffset",
        String(
          circumference -
          (value / 100) * circumference
        )
      );
    }

    if (label) {
      label.textContent =
        `${Math.round(value)}%`;
    }
  }

  function findCard(idOrElement) {
    if (idOrElement instanceof Element) {
      return idOrElement;
    }

    const id = String(idOrElement || "");
    if (!id) return null;

    return (
      registry.get(id) ||
      document.querySelector(
        `[data-kpi-id="${CSS.escape(id)}"]`
      )
    );
  }

  function register(idOrElement) {
    const card = findCard(idOrElement);
    if (!card) return null;

    const id =
      card.dataset.kpiId ||
      (typeof idOrElement === "string"
        ? idOrElement
        : "");

    if (id) registry.set(id, card);

    return card;
  }

  function update(idOrElement, data = {}, options = {}) {
    const card =
      register(idOrElement);

    if (!card) {
      console.warn(
        "VisiblKPI.update : carte introuvable",
        idOrElement
      );
      return false;
    }

    card.classList.remove("is-loading");
    card.classList.add("is-updating");

    window.setTimeout(
      () => card.classList.remove("is-updating"),
      420
    );

    if (data.theme) {
      card.dataset.theme = data.theme;
    }

    const label =
      card.querySelector("[data-kpi-label]");
    if (label && data.label != null) {
      label.textContent =
        String(data.label);
    }

    const subtitle =
      card.querySelector("[data-kpi-subtitle]");
    if (subtitle && data.subtitle != null) {
      subtitle.textContent =
        String(data.subtitle);
    }

    const footer =
      card.querySelector("[data-kpi-footer]");
    if (footer && data.footer != null) {
      footer.textContent =
        String(data.footer);
    }

    const unit =
      card.querySelector("[data-kpi-unit]");
    if (unit && data.unit != null) {
      unit.textContent =
        String(data.unit);
    }

    const valueEl =
      card.querySelector("[data-kpi-value]");

    if (valueEl && data.value != null) {
      const previous =
        toNumber(
          valueEl.dataset.currentValue ??
          valueEl.textContent
        );

      const next =
        toNumber(data.value);

      animateNumber(
        valueEl,
        previous,
        next,
        {
          duration:
            options.duration ??
            data.duration ??
            650,
          locale:
            data.locale ||
            options.locale ||
            "fr-FR",
          maximumFractionDigits:
            data.maximumFractionDigits ??
            options.maximumFractionDigits ??
            0
        }
      );
    }

    const trend =
      card.querySelector("[data-kpi-trend]");

    if (trend) {
      if (
        data.trend == null ||
        data.trend === ""
      ) {
        trend.hidden = true;
      } else {
        trend.hidden = false;

        const state =
          data.trendState ||
          trendState(data.trend);

        trend.dataset.state = state;

        trend.textContent =
          data.trendText ??
          trendText(
            data.trend,
            data.trendSuffix ?? "%"
          );
      }
    }

    updateSparkline(
      card,
      data.points
    );

    updateRing(
      card,
      data.ring
    );

    return true;
  }

  function setLoading(idOrElement, loading = true) {
    const card =
      register(idOrElement);

    if (!card) return false;

    card.classList.toggle(
      "is-loading",
      Boolean(loading)
    );

    card.setAttribute(
      "aria-busy",
      String(Boolean(loading))
    );

    return true;
  }

  function updateMany(items = []) {
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      if (!item) return;

      update(
        item.id || item.element,
        item.data || {},
        item.options || {}
      );
    });
  }

  function init(root = document) {
    root
      .querySelectorAll("[data-kpi-id]")
      .forEach(card => register(card));

    return registry.size;
  }

  global.VisiblKPI = {
    init,
    register,
    update,
    updateMany,
    setLoading,
    formatValue
  };

  if (
    typeof document !== "undefined"
  ) {
    if (
      document.readyState === "loading"
    ) {
      document.addEventListener(
        "DOMContentLoaded",
        () => init()
      );
    } else {
      init();
    }
  }

})(window);
