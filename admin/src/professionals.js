const node = (tag, text = "", cls = "") => {
  const n = document.createElement(tag);
  n.textContent = text;
  n.className = cls;
  return n;
};
const check = (r) => {
  if (r.error) throw r.error;
  return r.data;
};
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n / 100);
function tick(gold = false) {
  const badge = node("span", "", "profile-tick" + (gold ? " gold" : ""));
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", gold ? "Instagram connected" : "Approved by Artist House");
  badge.title = gold ? "Instagram connected \xB7 account connection only" : "Profile reviewed and approved by Artist House";
  return badge;
}
function professionalApprovals(db) {
  const $ = (id) => document.getElementById(id);
  let offset = 0, total = 0, current = null, version = 0, locked = false;
  let searchTimer;
  const notice = (text, error = false) => {
    $("approval-notice").textContent = text;
    $("approval-notice").classList.toggle("error", error);
  };
  function reset() {
    version++;
    current = null;
    $("professional-detail").replaceChildren();
    $("professional-list").replaceChildren();
    notice("");
  }
  async function refresh() {
    const v = ++version;
    notice("Loading professionals\u2026");
    try {
      const result = check(await db.rpc("admin_talent_directory", { p_offset: offset, p_status: $("approval-filter").value, p_search: $("talent-search").value.trim() }));
      if (v !== version) return;
      total = result.total;
      $("talent-approved-count").textContent = String(result.approved);
      $("talent-pending-count").textContent = String(result.pending);
      const paths = result.profiles.map((p) => p.avatar_path).filter(Boolean);
      const photos = paths.length ? check(await db.storage.from("portfolio-work").createSignedUrls(paths, 3600)) : [];
      if (v !== version) return;
      $("professional-list").replaceChildren();
      for (const p of result.profiles) {
        const b = node("button", "", "professional-row secondary");
        b.dataset.professionalId = p.id;
        const avatar = node("span", "", "list-avatar");
        const url = photos.find((photo) => photo.path === p.avatar_path)?.signedUrl;
        if (url) {
          const img = node("img");
          img.src = url;
          img.alt = "";
          img.loading = "lazy";
          avatar.append(img);
        } else avatar.textContent = p.display_name.slice(0, 1).toUpperCase();
        const copy = node("span", "", "list-person");
        copy.append(node("strong", p.original_name || p.display_name), node("span", (p.category || "Profile incomplete") + (p.city ? " \xB7 " + p.city : "")), node("small", p.display_name));
        const meta = node("span", "", "list-meta");
        meta.append(node("span", p.review_status === "approved" ? "Verified" : p.review_status === "pending" ? "Pending verification" : "Rejected", "review-state"));
        b.append(avatar, copy, meta, node("span", "Review profile", "review-profile-button"));
        b.onclick = () => {
          if (!locked) void open(p.id);
        };
        $("professional-list").append(b);
      }
      if (!result.profiles.length) $("professional-list").append(node("p", "No professionals in this filter."));
      $("approval-count").textContent = `${total} professionals`;
      $("approval-page").textContent = total ? `${offset + 1}\u2013${Math.min(offset + 50, total)} of ${total}` : "0";
      $("approval-prev").disabled = offset === 0;
      $("approval-next").disabled = offset + 50 >= total;
      notice("");
    } catch (e) {
      if (v === version) notice(e.message, true);
    }
  }
  async function open(id) {
    const v = ++version;
    current = null;
    $("professional-detail").querySelectorAll("button").forEach((b) => b.disabled = true);
    notice("Loading profile\u2026");
    try {
      const p = check(await db.rpc("admin_professional_profile", { p_id: id }));
      const paths = [p.avatar_path, ...p.media.map((m) => m.storage_path)].filter(Boolean);
      const urls = paths.length ? check(await db.storage.from("portfolio-work").createSignedUrls(paths, 3600)) : [];
      if (v !== version) return;
      if (urls.some((url) => url.error || !url.signedUrl)) throw new Error("Some profile images could not be loaded. Refresh the profile before reviewing it.");
      current = p;
      document.querySelectorAll(".professional-row").forEach((row) => row.classList.toggle("selected", row.dataset.professionalId === id));
      const src = (path) => urls.find((u) => u.path === path)?.signedUrl;
      const root = $("professional-detail");
      root.replaceChildren();
      const head = node("div", "", "professional-head");
      if (src(p.avatar_path)) {
        const img = node("img");
        img.src = src(p.avatar_path);
        img.alt = "Profile photo";
        head.append(img);
      } else head.append(node("div", p.display_name.slice(0, 1).toUpperCase(), "avatar-placeholder"));
      const stats = node("div", "", "profile-stats");
      const average = p.reviews.length ? (p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length).toFixed(1) : "\u2014";
      for (const [value, label2] of [[p.media.length, "Works"], [p.services.filter((s) => s.active).length, "Services"], [average, "Recent rating"]]) {
        const stat = node("div");
        stat.append(node("strong", String(value)), node("span", label2));
        stats.append(stat);
      }
      head.append(stats);
      const title = node("div", "", "profile-name");
      title.append(node("h2", p.display_name));
      if (p.review_status === "approved") title.append(tick());
      if (p.instagram_connected) title.append(tick(true));
      const intro = node("div", "", "profile-intro");
      intro.append(title, node("p", `${p.category || "Profile incomplete"} \xB7 ${p.city || ""}`), node("p", p.bio));
      if (p.original_name) intro.append(node("p", "Original name: " + p.original_name + " \xB7 Admin only", "private-name"));
      intro.append(node("p","Check that this is a genuine individual portrait, not a wedding/group photo, logo or advertisement. Approving also approves this exact photo.","hint"));
        if(p.home_address)intro.append(node("p","Registered home: "+p.home_address+" · Admin only","private-name"));
        const state = node("div", "", "profile-state");
      state.append(node("span", p.review_status === "pending" ? "Awaiting review" : p.review_status, "review-state " + p.review_status));
      if (p.instagram_connected) state.append(node("span", "Instagram connected", "connection-state"));
      root.append(head, intro, state);
      const navigation = node("nav", "", "profile-tabs");
      navigation.setAttribute("aria-label", "Professional profile sections");
      const panels = {};
      for (const [key, label2] of [["work", "Work samples"], ["about", "About"], ["services", "Services & prices"], ["reviews", "Reviews"]]) {
        const panel = node("section", "", "profile-tab-panel");
        panel.hidden = key !== "work";
        panels[key] = panel;
        const button = node("button", label2, "profile-tab");
        button.setAttribute("aria-pressed", String(key === "work"));
        button.onclick = () => {
          for (const [name, section] of Object.entries(panels)) section.hidden = name !== key;
          navigation.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        };
        navigation.append(button);
      }
      root.append(navigation, ...Object.values(panels));
      panels.about.append(node("h3", "About this professional"), node("p", p.bio));
      if (p.specialties.length) panels.about.append(node("p", p.specialties.join(" \xB7 ")));
      const specs = node("dl", "", "profile-specs");
      for (const [key, value] of Object.entries(p.public_specs || {})) {
        if (value === null || value === "") continue;
        specs.append(node("dt", key.replaceAll("_", " ")), node("dd", typeof value === "object" ? JSON.stringify(value) : String(value)));
      }
      panels.about.append(specs);
      const grid = node("div", "", "work-grid");
      for (const m of p.media) {
        if (!src(m.storage_path)) continue;
        const a = node("a");
        a.href = src(m.storage_path);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        const img = node("img");
        img.src = a.href;
        img.alt = "Work sample";
        img.loading = "lazy";
        a.append(img);
        grid.append(a);
      }
      panels.work.append(grid);
      if (!grid.children.length) panels.work.append(node("p", "No uploaded work samples.", "profile-empty"));
      panels.services.append(node("h3", "Services & prices"));
      const serviceCards = node("div", "", "service-review-grid");
      panels.services.append(serviceCards);
      for (const s of p.services) {
        const row = node("div", "", "service-review-card");
        row.append(node("strong", s.name), node("span", `${money(s.amount_paise)} / session${s.active ? "" : " \xB7 Inactive"}`));
        if (s.description) row.append(node("p", s.description));
        serviceCards.append(row);
      }
      if (!p.services.length) panels.services.append(node("p", "No services added.", "profile-empty"));
      panels.reviews.append(node("h3", "Customer reviews"));
      for (const r of p.reviews) {
        const card = node("div", "", "service-review-card");
        card.append(node("strong", "\u2605".repeat(r.rating)), node("p", r.comment || "No written review"), node("small", new Date(r.created_at).toLocaleDateString()));
        panels.reviews.append(card);
      }
      if (!p.reviews.length) panels.reviews.append(node("p", "No reviews yet.", "profile-empty"));
      const review = node("section", "", "review-decision");
      review.append(node("h3", "Your decision"));
      const label = node("label", "Internal review note");
      const note = node("textarea");
      note.id = "professional-note";
      note.maxLength = 1e3;
      note.rows = 3;
      note.value = p.note;
      label.append(note);
      review.append(label);
      if (p.reviewed_at) review.append(node("p", `Last reviewed ${new Date(p.reviewed_at).toLocaleString()}`));
      const actions = node("div", "", "actions");
      for (const [status, text] of [["rejected", "Reject"], ["approved", "Approve & verify"]]) {
        const b = node("button", text, status === "rejected" ? "secondary" : "");
        b.disabled = Boolean(p.incomplete);
        b.onclick = () => void decide(status);
        actions.append(b);
      }
      review.append(actions);
      root.append(review);
      $("approvals-panel").dataset.detail = "true";
      window.scrollTo(0, 0);
      notice("");
    } catch (e) {
      if (v === version) notice(e.message, true);
    }
  }
  async function decide(status) {
    if (locked || !current) return;
    const p = current, note = $("professional-note").value.trim();
    if (!window.confirm(`${status === "approved" ? "Approve this professional and display the verified tick?" : "Reject this profile and remove its verified tick?"}`)) return;
    locked = true;
    $("professional-detail").querySelectorAll("button").forEach((b) => b.disabled = true);
    try {
      check(await db.rpc("review_professional", { p_id: p.id, p_status: status, p_note: note, p_expected_reviewed_at: p.reviewed_at,p_expected_avatar_path:p.avatar_path||null }));
      await refresh();
      await open(p.id);
      notice(status === "approved" ? "Approved. The verified tick is enabled." : "Rejected. No verified tick will be shown.");
    } catch (e) {
      notice(e.message, true);
    } finally {
      locked = false;
      $("professional-detail").querySelectorAll("button").forEach((b) => b.disabled = !current || Boolean(current.incomplete));
    }
  }
  $("approval-refresh").onclick = () => {
    if (!locked) void refresh();
  };
  $("talent-search").oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      offset = 0;
      void refresh();
    }, 250);
  };
  for (const status of ["all", "pending", "approved"]) $("talent-" + status).onclick = () => {
    $("approval-filter").value = status;
    offset = 0;
    for (const value of ["all", "pending", "approved"]) $("talent-" + value).setAttribute("aria-pressed", String(value === status));
    void refresh();
  };
  $("approval-filter").onchange = () => {
    if (!locked) {
      offset = 0;
      void refresh();
    }
  };
  $("approval-prev").onclick = () => {
    if (locked) return;
    offset = Math.max(0, offset - 50);
    void refresh();
  };
  $("approval-next").onclick = () => {
    if (locked) return;
    offset += 50;
    void refresh();
  };
  return { refresh, reset };
}
export {
  professionalApprovals
};
