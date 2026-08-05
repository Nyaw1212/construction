(function () {
  "use strict";

  let PERSONNEL = [];
  let activeGroupIndex = null;

  const $ = id => document.getElementById(id);
  const e = {
    search: $("searchInput"),
    run: $("runSearch"),
    demo: $("loadDemo"),
    clear: $("clearSearch"),
    order: $("preserveOrder"),
    exact: $("exactPriority"),
    body: $("resultsBody"),
    empty: $("emptyState"),
    records: $("recordCount"),
    terms: $("termCount"),
    matches: $("matchCount"),
    elapsed: $("elapsed"),
    matched: $("matchedTerms"),
    unmatched: $("unmatchedTerms"),
    sort: $("sortDescription")
  };

  const GROUP_HUES = [151, 198, 46, 275, 19, 330, 90, 225];
  const mode = () => document.querySelector('input[name="mode"]:checked')?.value || "ANY";
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function groupHue(index) {
    return GROUP_HUES[index % GROUP_HUES.length];
  }

  function renderMatchedPills(allTerms, matchedTerms) {
    e.matched.innerHTML = matchedTerms.length
      ? matchedTerms.map(term => {
          const originalTermIndex = allTerms.indexOf(term);
          return `
            <span
              class="pill match-pill"
              data-term-index="${originalTermIndex}"
              style="--group-hue:${groupHue(originalTermIndex)}"
              tabindex="0"
              title="Highlight only the ${esc(term)} result group"
            >${esc(term)}</span>
          `;
        }).join("")
      : "None";
  }

  function renderUnmatchedPills(terms) {
    e.unmatched.innerHTML = terms.length
      ? terms.map(term => `<span class="pill warn">${esc(term)}</span>`).join("")
      : "None";
  }

  function setActiveGroup(index) {
    activeGroupIndex = index == null ? null : Number(index);
    document.querySelectorAll("[data-term-index]").forEach(node => {
      const isActive = Number(node.dataset.termIndex) === activeGroupIndex;
      node.classList.toggle("group-focus", activeGroupIndex != null && isActive);
      node.classList.remove("group-dim");
    });
  }

  function bindGroupHover() {
    document.querySelectorAll("[data-term-index]").forEach(node => {
      node.addEventListener("mouseenter", () => setActiveGroup(node.dataset.termIndex));
      node.addEventListener("mouseleave", () => setActiveGroup(null));
      node.addEventListener("focus", () => setActiveGroup(node.dataset.termIndex));
      node.addEventListener("blur", () => setActiveGroup(null));
    });
  }

  function mapCanonicalRecord(row, index) {
    return {
      id: row["PERSONNEL SEARCH KEY"] || String(index + 1),
      displayName: row["FULL NAME"] || row["CANONICAL NAME WITH RANK"] || row["CANONICAL NAME"] || "",
      canonicalName: row["CANONICAL NAME"] || "",
      personnelSearchKey: row["PERSONNEL SEARCH KEY"] || "",
      rank: row.RANK || "",
      office: row.Office || "",
      designation: row.Designation || "",
      camp: row.CAMP || "",
      lastName: row["LAST NAME"] || "",
      firstName: row["FIRST NAME"] || "",
      middleName: row["MIDDLE NAME"] || "",
      suffix: row.SUFFIX || "",
      canonicalNameWithRank: row["CANONICAL NAME WITH RANK"] || "",
      nameEngineVersion: row["NAME ENGINE VERSION"] || ""
    };
  }

  async function loadPersonnel() {
    e.empty.hidden = false;
    e.empty.textContent = "Loading canonical personnel data…";
    const response = await fetch("./personnel-canonical-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load personnel-canonical-data.json (HTTP ${response.status})`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      throw new Error("personnel-canonical-data.json must contain a JSON array.");
    }
    PERSONNEL = rows.map(mapCanonicalRecord);
    e.records.textContent = PERSONNEL.length.toLocaleString();
    console.info(`Loaded ${PERSONNEL.length.toLocaleString()} canonical personnel records.`);
  }

  function run() {
    if (!PERSONNEL.length) {
      e.empty.hidden = false;
      e.empty.textContent = "Canonical personnel data is not loaded yet.";
      return;
    }

    const result = Level2Search.searchPersonnel(PERSONNEL, e.search.value, {
      mode: mode(),
      preserveInputOrder: e.order.checked,
      exactPriority: e.exact.checked
    });

    e.records.textContent = PERSONNEL.length.toLocaleString();
    e.terms.textContent = result.terms.length;
    e.matches.textContent = result.matches.length;
    e.elapsed.textContent = `${result.elapsedMs.toFixed(2)} ms`;
    renderMatchedPills(result.terms, result.matchedTerms);
    renderUnmatchedPills(result.unmatchedTerms);
    e.sort.textContent = e.order.checked
      ? "term order → quality → LIST order"
      : "quality → LIST order";

    if (!result.matches.length) {
      e.body.innerHTML = "";
      e.empty.hidden = false;
      e.empty.textContent = result.terms.length ? "No matches found." : "Enter search terms to begin.";
      setActiveGroup(null);
      bindGroupHover();
      return;
    }

    e.empty.hidden = true;
    e.body.innerHTML = result.matches.map((item, index) => `
      <tr
        class="result-group-row"
        data-term-index="${item.termIndex}"
        style="--group-hue:${groupHue(item.termIndex)}"
        tabindex="0"
        title="Hover to highlight the ${esc(item.term)} match group"
      >
        <td>${index + 1}</td>
        <td><span class="term-marker">${esc(item.term)}</span></td>
        <td class="quality">${esc(item.qualityLabel)}</td>
        <td>${esc(item.record.displayName)}</td>
        <td>${esc(item.record.canonicalName)}</td>
        <td>${esc(item.record.rank)}</td>
        <td>${esc(item.record.office)}</td>
        <td>${esc(item.record.camp)}</td>
      </tr>
    `).join("");

    setActiveGroup(null);
    bindGroupHover();

    console.table(result.matches.map(item => ({
      term: item.term,
      termIndex: item.termIndex,
      quality: item.qualityLabel,
      name: item.record.canonicalName,
      sourceIndex: item.sourceIndex
    })));
  }

  function showLoadError(error) {
    console.error(error);
    e.empty.hidden = false;
    e.empty.textContent = `Failed to load personnel data: ${error.message}`;
    e.records.textContent = "0";
    e.run.disabled = true;
    e.demo.disabled = true;
  }

  e.run.onclick = run;
  e.demo.onclick = () => {
    e.search.value = "Santos\nPostanes\nCruz\nUnknown Person";
    run();
  };
  e.clear.onclick = () => {
    e.search.value = "";
    run();
    e.search.focus();
  };
  e.search.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") run();
  });
  document.querySelectorAll('input[name="mode"],#preserveOrder,#exactPriority')
    .forEach(input => input.addEventListener("change", run));

  (async function init() {
    try {
      await loadPersonnel();
      run();
    } catch (error) {
      showLoadError(error);
    }
  })();
})();
