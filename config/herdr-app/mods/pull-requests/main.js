// @ts-check
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { exec, theme, run, props, settings, shared, setShared, openOverlay, closeOverlay } from "herdr";

const POLL_MS = 30_000;
/** Bumped by the merge dialog so the panel refreshes right away. */
const MERGED_KEY = "pull-requests.merged";
/** GitHub's refusal to merge a stacked PR through GraphQL (`gh pr merge`). */
const STACKED = /part of a stack|asynchronous merge/i;

/**
 * Squash-merges through the async REST API, the only way to merge a stacked PR
 * (it merges the open PRs below it in the stack too). It has no auto-merge, so
 * this waits for GitHub to merge or enqueue it and throws if that fails.
 */
async function mergeAsync(repo, number, body, cx) {
  const path = `repos/${repo}/pulls/${number}/merge-async`;
  const api = async (args) => {
    const r = await exec("gh", ["api", ...args]);
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* not JSON: reported below */ }
    // 409: a merge is already pending; its body describes that one.
    if (r.code !== 0 && json?.details?.uuid == null) {
      throw new Error(json?.message ?? (r.stderr || r.stdout || "merge-async failed").trim());
    }
    return json;
  };
  let res = await api(["-X", "PUT", path, "-f", "merge_method=squash", "-f", `commit_message=${body}`]);
  const uuid = res?.details?.uuid;
  for (let i = 0; res?.status === "pending" && uuid && i < 40; i++) {
    await cx.sleep(1500);
    res = await api([`${path}/${uuid}`]);
  }
  if (res?.status === "failed") throw new Error(res.details?.message ?? "GitHub could not merge the stack");
}

/**
 * Each PR's place in a GitHub stack, in one GraphQL call (`gh pr view` has no
 * stack field): `{ position, size, below }` or null, in the order of `prs`.
 * `below` is the open PRs under it, which merging it merges too. Never throws:
 * without stacks the list still shows, and merging falls back on GitHub's error.
 */
async function fetchStacks(prs) {
  if (!prs.length) return [];
  const fields = prs.map((pr, i) => {
    const [owner, name] = pr.repository.nameWithOwner.split("/");
    return `p${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
      pullRequest(number: ${Number(pr.number)}) {
        stackEntry { position }
        stack { size entries(first: 50) { nodes { position pullRequest { number title state } } } }
      }
    }`;
  });
  try {
    const r = await exec("gh", ["api", "graphql", "-f", `query={ ${fields.join("\n")} }`]);
    const data = JSON.parse(r.stdout)?.data ?? {};
    return prs.map((_pr, i) => {
      const pr = data[`p${i}`]?.pullRequest;
      const position = pr?.stackEntry?.position;
      if (!pr?.stack || position == null) return null;
      const below = (pr.stack.entries?.nodes ?? [])
        .filter(e => e.position < position && e.pullRequest?.state === "OPEN")
        .sort((a, b) => a.position - b.position)
        .map(e => ({ number: e.pullRequest.number, title: e.pullRequest.title }));
      return { position, size: pr.stack.size, below };
    });
  } catch {
    return [];
  }
}

function stackTooltip(stack) {
  const place = `${stack.position} of ${stack.size} in a stack`;
  if (!stack.below.length) return `${place} · nothing open below it`;
  return `${place} · merging also merges ${stack.below.map(b => `#${b.number}`).join(", ")}`;
}

const LINK = /\[[^\]]*\]\([^)]*\)/;
const EMPTY_PLACEHOLDER = /^\s*(?:[-*]\s+)?(?:\*\*)?(?:Jira|Figma)(?:\*\*)?\s*:\s*(?:\*\*)?\s*$/i;

/** The PR description as a squash commit body: without HTML comments and
 *  the bot link under each (`<!-- Cloudflare preview -->` + `[Open preview](…)`),
 *  and without `Jira:` / `Figma:` lines left empty. */
function cleanBody(body) {
  const text = (body ?? "").replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "\u0000");
  const out = [];
  // "wait": a comment-only line was dropped; "link": dropping the link paragraph under it.
  let drop = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\u0000/g, "").trimEnd();
    if (raw.includes("\u0000") && !line.trim()) { drop = "wait"; continue; }
    if (drop) {
      if (!line.trim()) { if (drop === "link") drop = null; out.push(""); continue; }
      if (LINK.test(line)) { drop = "link"; continue; }
      drop = null;
    }
    if (EMPTY_PLACEHOLDER.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const FAILED = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE", "ACTION_REQUIRED", "ERROR"]);
const PASSED = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"]);

/** One check's outcome: success | failure | pending.
 *  CheckRun (Actions) has status + conclusion; StatusContext (commit
 *  statuses, e.g. Chromatic) has only state. */
function checkOutcome(c) {
  const result = c.__typename === "StatusContext" ? c.state
    : c.status === "COMPLETED" ? c.conclusion
    : null;
  if (FAILED.has(result)) return "failure";
  if (PASSED.has(result)) return "success";
  return "pending";
}

/** Only the newest run of each check (workflow + name), as GitHub counts them:
 *  a workflow re-triggered by e.g. adding a label leaves its superseded,
 *  possibly failed, run in the rollup. A run not yet started is the newest. */
function latestChecks(checks) {
  const started = (c) => c.__typename === "StatusContext"
    ? Date.parse(c.startedAt ?? c.createdAt ?? "") || 0
    : c.startedAt ? Date.parse(c.startedAt) || 0 : Infinity;
  const latest = new Map();
  for (const c of checks ?? []) {
    const key = `${c.workflowName ?? ""}\n${c.name ?? c.context ?? ""}`;
    const prev = latest.get(key);
    if (!prev || started(c) >= started(prev)) latest.set(key, c);
  }
  return [...latest.values()];
}

/** The failed checks, deduplicated, as { name, workflow, url } sorted by name. */
function failedChecks(checks) {
  const seen = new Map();
  for (const c of latestChecks(checks)) {
    if (checkOutcome(c) !== "failure") continue;
    const name = c.name ?? c.context ?? "Unnamed check";
    const url = c.detailsUrl ?? c.targetUrl ?? null;
    seen.set(`${name}\n${url}`, { name, workflow: c.workflowName ?? null, url });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Collapse all checks into one rollup: success | failure | pending | null.
 *  A failure wins over checks still running, as on GitHub. */
function rollup(checks) {
  if (!checks?.length) return null;
  const outcomes = latestChecks(checks).map(checkOutcome);
  if (outcomes.includes("failure")) return "failure";
  if (outcomes.includes("pending")) return "pending";
  return "success";
}

function ciColor(status, t) {
  if (status === "success") return t.ansi2;
  if (status === "failure") return t.ansi1;
  if (status === "pending") return t.ansi3;
  return t.dim;
}

export default class PullRequests extends View {
  init(_props, cx) {
    if (props()?.failed) return; // the checks popover: no polling
    if (props()?.merge) return this.initMergeDialog(cx);
    this.mergedSeen = shared(MERGED_KEY);
    this.prs = [];
    this.loading = true;
    this.error = null;
    this.acting = {}; // action key -> true while a gh action is in flight
    this.fetching = 0; // refreshes in flight; the refresh icon spins meanwhile
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    this.refresh(cx);
  }

  refresh(cx) {
    this.fetching++;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        // Step 1: list open PRs authored by me
        const listResult = await exec("gh", [
          "search", "prs",
          "--author=@me", "--state=open",
          "--json", "number,title,url,isDraft,repository",
          "--limit", "30",
        ]);
        if (listResult.code !== 0) throw new Error(listResult.stderr || "gh search failed");
        const list = JSON.parse(listResult.stdout);

        // Step 2: fetch CI + reviewDecision per PR in parallel, and all stacks at once
        const stacks = fetchStacks(list);
        const details = await Promise.all(list.map(async (pr) => {
          try {
            const r = await exec("gh", [
              "pr", "view", String(pr.number),
              "--repo", pr.repository.nameWithOwner,
              "--json", "number,title,body,url,isDraft,reviewDecision,statusCheckRollup",
            ]);
            if (r.code !== 0) return { ...pr, reviewDecision: null, statusCheckRollup: [] };
            const d = JSON.parse(r.stdout);
            return { ...pr, ...d };
          } catch {
            return { ...pr, reviewDecision: null, statusCheckRollup: [] };
          }
        }));

        const stackOf = await stacks;
        this.prs = details.map((pr, i) => ({ ...pr, stack: stackOf[i] ?? null }));
        this.error = null;
      } catch (e) {
        this.error = e.message ?? String(e);
      } finally {
        this.loading = false;
        this.fetching--;
        cx.notify();
      }
    });
  }

  async action(label, fn, cx) {
    if (this.acting[label]) return;
    this.acting[label] = true;
    cx.notify();
    try { await fn(); } finally {
      this.acting[label] = false;
      this.refresh(cx);
    }
  }

  /** Merge dialog: the squash commit's description, editable, then `gh pr merge`
   *  (the async merge API for a stacked PR). */
  initMergeDialog(cx) {
    const t = theme();
    this.busy = false;
    this.mergeError = null;
    this.editor = EditorState.new({
      language: "markdown", value: props().merge.body,
      soft_wrap: true, line_numbers: false, folding: false,
      font_family: /** @type {string | undefined} */ (settings().font_family),
      syntax: { heading: t.ansi4, strong: t.foreground, code: t.ansi2, quote: t.dim, list: t.ansi5, link: t.ansi6 },
    });
    this.editor.on("submit", (_e, cx) => this.merge(cx));
    this.editor.focus();
    cx.timer.after(600, () => this.editor.focus()); // as the shipped prompt does, once the dialog has settled
    this.handle = cx.focus_handle();
  }

  merge(cx) {
    if (this.busy) return;
    const { merge, overlay } = props();
    this.busy = true;
    this.mergeError = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const body = this.editor.value();
        if (merge.stack) {
          await mergeAsync(merge.repo, merge.number, body, cx);
        } else {
          const r = await exec("gh", ["pr", "merge", String(merge.number), "--repo", merge.repo,
            "--squash", "--auto", "--body", body]);
          if (r.code !== 0) {
            const message = (r.stderr || r.stdout || "gh pr merge failed").trim();
            // Stacked since the last refresh, or its stack couldn't be fetched.
            if (!STACKED.test(message)) throw new Error(message);
            await mergeAsync(merge.repo, merge.number, body, cx);
          }
        }
        setShared(MERGED_KEY, Date.now());
        closeOverlay(overlay);
      } catch (e) {
        this.mergeError = e.message ?? String(e);
        this.busy = false;
        cx.notify();
      }
    });
  }

  mergeKey(e, cx) {
    if (e.keystroke === "escape" && !this.busy) { closeOverlay(props().overlay); cx.stop_propagation(); }
    if (e.keystroke === "cmd-enter") { this.merge(cx); cx.stop_propagation(); }
  }

  mergeDialog(t) {
    const { merge, overlay } = props();
    const below = merge.stack?.below ?? [];
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium()
      .when(this.busy, el => el.opacity(0.6))
      .when(!this.busy, el => el.cursor_pointer().hover(s => s.opacity(0.88)).on_click(action))
      .child(text);
    return v_flex().id("merge-root").track_focus(this.handle).on_key_down((e, cx) => this.mergeKey(e, cx))
      .size_full().p(18).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().gap(8)
        .child(div().flex_1().text_size(15).font_semibold().child(`Squash and merge #${merge.number}`))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(div().pt(4).text_size(12.5).text_color(t.muted).truncate().child(merge.title))
      .when(below.length > 0, el => el.child(v_flex().mt(14).px(10).py(8).gap(4).rounded(8)
        .border_1().border_color(t.border).bg(t.raised).text_size(12)
        .child(div().text_color(t.ansi3).font_medium()
          .child(`Also merges ${below.length === 1 ? "the PR" : `${below.length} PRs`} below it in the stack`))
        .children(below.map(b => h_flex().gap(6).min_w(0)
          .child(div().flex_none().text_color(t.dim).child(`#${b.number}`))
          .child(div().truncate().text_color(t.muted).child(listTitle(b.title)))))))
      .child(div().pt(16).pb(7).text_size(11.5).text_color(t.dim).child("Commit description"))
      .child(v_flex().flex_1().min_h(0).p(10).rounded(9).border_1().border_color(t.input).bg(t.background)
        .child(Editor.new(this.editor).text_size(13).flex_1().min_h(0)))
      .when(Boolean(this.mergeError), el => el.child(
        div().pt(8).text_size(12).text_color(t.ansi1).child(this.mergeError)))
      .child(h_flex().pt(16).gap(8).items_center()
        .child(div().flex_1().text_size(11.5).text_color(t.dim).child(merge.stack
          ? "Stacked: no auto-merge, merges now · ⌘↵"
          : "Merges when required checks pass · ⌘↵"))
        .child(button("merge-cancel", "Cancel", false, () => closeOverlay(overlay)))
        .child(button("merge-confirm", this.busy ? "Merging…"
          : below.length ? `Squash and merge ${below.length + 1} PRs` : "Squash and merge", true,
          (_e, cx) => this.merge(cx))));
  }

  /** Popover opened from a red dot: each failed check, linking to its run. */
  checksPopover(t) {
    const { failed, pr, overlay } = props();
    return v_flex().id("checks-root").size_full().bg(t.popover)
      .child(
        h_flex().w_full().h(32).px(12).items_center().flex_none()
          .border_b(1).border_color(t.border)
          .text_size(12).font_semibold().text_color(t.foreground)
          .child(`${failed.length} failing check${failed.length === 1 ? "" : "s"} · ${pr}`)
      )
      .child(
        div().id("checks-scroll").flex_1().overflow_y_scrollbar().py(4).children(
          failed.map((c, i) =>
            h_flex().id(`check-${i}`).w_full().px(12).py(6).gap(8).items_center()
              .when(Boolean(c.url), el => el.cursor_pointer()
                .hover(s => s.bg(t.hover))
                .on_click(() => { closeOverlay(overlay); exec("open", [c.url]); }))
              .child(div().size(7).rounded(4).flex_none().bg(t.ansi1))
              .child(
                v_flex().flex_1().min_w(0)
                  .child(div().truncate().text_size(13).text_color(t.foreground).child(c.name))
                  .when(Boolean(c.workflow), el => el.child(
                    div().truncate().text_size(11).text_color(t.dim).child(c.workflow)))
              )
              .child(div().flex_none().text_size(12).text_color(t.muted).child(c.url ? "↗" : ""))
          )
        )
      );
  }

  render(cx) {
    const t = theme();
    if (props()?.failed) return this.checksPopover(t);
    if (props()?.merge) return this.mergeDialog(t);

    // The merge dialog bumped this: show the merge without waiting for the poll.
    const merged = shared(MERGED_KEY);
    // refresh() notifies, which is illegal during render: defer it to a timer task.
    if (merged !== this.mergedSeen) {
      this.mergedSeen = merged;
      cx.timer.after(0, (cx) => this.refresh(cx));
    }

    // Sized and styled like the terminal pane header (the `pane` mod at 30px).
    const iconButton = (id, icon, tip, onClick, spinning = false) =>
      div().id(id).flex_none().p(3).rounded(4)
        .text_color(t.dim).cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground))
        .tooltip(tip).on_click(onClick)
        .child(spinning ? svg(icon).size(14).spin(900) : svg(icon).size(14));

    const header = h_flex().h(30).flex_none().px(10).gap(8).items_center()
      .text_size(12)
      .child(div().flex_none().font_medium().text_color(t.foreground).child("Pull requests"))
      .child(div().flex_1().truncate().text_color(t.dim)
        .child(this.prs.length > 0 ? `${this.prs.length} open` : ""))
      .child(iconButton("pr-refresh", "mods/pull-requests/refresh.svg", "Refresh",
        (_e, cx) => this.refresh(cx), this.fetching > 0))
      .child(iconButton("pr-close", "mods/pane/close.svg", "Hide · ⌘⇧H",
        () => run("layout.hide", { id: "prs" })));

    const card = (body) => v_flex().id("pr-root").size_full().min_h(0)
      .overflow_hidden().bg(t.background).border_l(1).border_color(t.border)
      .text_color(t.foreground).text_size(13)
      .child(header)
      .child(body);
    const notice = (title, detail) => v_flex().flex_1().p(20).gap(4).items_center().justify_center()
      .child(div().text_size(12.5).text_color(t.muted).child(title))
      .when(Boolean(detail), el => el.child(div().text_size(11.5).text_color(t.dim).child(detail)));

    if (this.loading && !this.prs.length) return card(notice("Loading pull requests…"));
    if (this.error) return card(notice("Couldn't load pull requests", this.error));
    if (!this.prs.length) return card(notice("No open pull requests"));

    const byRepo = new Map();
    for (const pr of this.prs) {
      const repo = pr.repository.nameWithOwner;
      if (!byRepo.has(repo)) byRepo.set(repo, []);
      byRepo.get(repo).push(pr);
    }

    const rows = [];
    for (const [repo, prs] of byRepo) {
      rows.push(
        h_flex().id(`repo-${repo}`).px(8).pt(rows.length ? 14 : 6).pb(4).gap(6).items_center()
          .text_size(11.5).font_medium().text_color(t.dim)
          .child(div().truncate().child(repo.split("/")[1]))
          .child(div().child(String(prs.length)))
      );
      for (const pr of prs) rows.push(this.prRow(pr, repo, t));
    }

    return card(
      v_flex().id("pr-list").flex_1().min_h(0).overflow_y_scrollbar().p(6).gap(2).children(rows)
    );
  }

  prRow(pr, repo, t) {
    const key = `${repo}#${pr.number}`;
    const ci = rollup(pr.statusCheckRollup);
    const review = pr.isDraft ? { label: "Draft", color: t.muted, neutral: true }
      : REVIEW[pr.reviewDecision] ? { ...REVIEW[pr.reviewDecision], color: t[REVIEW[pr.reviewDecision].color] }
      : null;
    const failed = ci === "failure" ? failedChecks(pr.statusCheckRollup) : [];

    const dot = div().id(`ci-${key}`).flex().size(16).mt(1).flex_none().items_center().justify_center()
      .rounded(5).tooltip(ciTooltip(ci, failed.length))
      .child(ci ? div().size(8).rounded(4).bg(ciColor(ci, t))
        : div().w(8).h(2).rounded(1).bg(t.dim))
      .when(ci === "failure", el => el.cursor_pointer().hover(s => s.bg(t.hover))
        .on_click(() => openOverlay({
          mod: "pull-requests", kind: "popup", width: 340,
          // header + list padding + rows (two lines with a workflow name)
          height: Math.min(33 + 8 + failed.reduce((h, c) => h + (c.workflow ? 52 : 36), 0), 420),
          props: { failed, pr: `#${pr.number}` },
        })));

    const chip = review && div().flex().flex_none().h(18).px(6).items_center().rounded(5)
      .bg(review.neutral ? t.hover : tint(review.color)).text_color(review.color)
      .text_size(10.5).font_semibold().child(review.label);

    const stackChip = pr.stack && div().id(`stack-${key}`).flex().flex_none().h(18).px(6).items_center()
      .rounded(5).bg(t.hover).text_color(pr.stack.below.length ? t.ansi3 : t.muted)
      .text_size(10.5).font_semibold().tooltip(stackTooltip(pr.stack))
      .child(`Stack ${pr.stack.position}/${pr.stack.size}`);

    const actions = [
      actionButton(`open-${key}`, "Open", "open", t, {
        onClick: () => exec("open", [pr.url]),
      }),
      pr.isDraft && actionButton(`ready-${key}`, "Ready", "ready", t, {
        busy: !!this.acting[`ready-${key}`],
        tooltip: "Mark ready for review",
        onClick: (_e, cx) => this.action(`ready-${key}`, () =>
          exec("gh", ["pr", "ready", String(pr.number), "--repo", repo]), cx),
      }),
      !pr.isDraft && pr.reviewDecision === "APPROVED" && actionButton(`merge-${key}`, "Merge", "merge", t, {
        primary: true,
        onClick: () => openOverlay({
          mod: "pull-requests", kind: "dialog", modal: true, width: 640,
          // room for the stacked PRs that merge along with it
          height: 520 + (pr.stack?.below.length ? Math.min(46 + 20 * pr.stack.below.length, 160) : 0),
          props: { merge: { number: pr.number, repo, title: pr.title, body: cleanBody(pr.body), stack: pr.stack } },
        }),
      }),
    ].filter(Boolean);

    return h_flex().id(`pr-${key}`).w_full().px(8).py(9).gap(8).items_start().rounded(8)
      .hover(s => s.bg(t.hover))
      .child(dot)
      .child(v_flex().flex_1().min_w(0).gap(6)
        .child(div().text_size(13).font_medium().text_color(t.foreground).child(listTitle(pr.title)))
        .child(h_flex().gap(6).items_center()
          .child(div().text_size(11.5).text_color(t.dim).child(`#${pr.number}`))
          .when(Boolean(chip), el => el.child(chip))
          .when(Boolean(stackChip), el => el.child(stackChip)))
        .child(h_flex().gap(7).pt(1).children(actions)));
  }
}

/** The title as listed: without the repo's "[No Jira Issue]" prefix, which says nothing. */
function listTitle(title) {
  return title.replace(/^\s*\[no jira issue\]\s*/i, "") || title;
}

/** Review states worth a chip; the color is a theme color name. */
const REVIEW = {
  APPROVED: { label: "Approved", color: "ansi2" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "ansi1" },
  REVIEW_REQUIRED: { label: "In review", color: "ansi3" },
};

/** A theme color (#rrggbb) at 15% for a chip's background. */
function tint(color) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}26` : color;
}

function ciTooltip(ci, failing) {
  if (ci === "success") return "All checks passed";
  if (ci === "failure") return `${failing} failing check${failing === 1 ? "" : "s"} · click to see them`;
  if (ci === "pending") return "Checks running";
  return "No checks";
}

/** A row button in the merge dialog's style, a size smaller. */
function actionButton(id, label, icon, t, { primary = false, busy = false, tooltip = null, onClick }) {
  return h_flex().id(id).h(22).px(7).gap(4).items_center().rounded(6)
    .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
    .text_color(primary ? t.solid_foreground : t.foreground).text_size(11.5).font_medium()
    .when(Boolean(tooltip), el => el.tooltip(tooltip))
    .when(busy, el => el.opacity(0.6))
    .when(!busy, el => el.cursor_pointer().hover(s => s.opacity(0.88)).on_click(onClick))
    .child(svg(`mods/pull-requests/${icon}.svg`).size(11).flex_none())
    .child(busy ? `${label}…` : label);
}
