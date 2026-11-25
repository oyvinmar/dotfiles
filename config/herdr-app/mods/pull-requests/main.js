// @ts-check
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar } from "gpui-base";
import { exec, theme, run } from "herdr";

const POLL_MS = 30_000;

/** Collapse all checks into one rollup: success | failure | pending | null */
function rollup(checks) {
  if (!checks?.length) return null;
  if (checks.some(c => c.status !== "COMPLETED")) return "pending";
  if (checks.some(c => c.conclusion === "FAILURE" || c.conclusion === "TIMED_OUT" || c.conclusion === "CANCELLED")) return "failure";
  if (checks.every(c => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED" || c.conclusion === "NEUTRAL")) return "success";
  return "pending";
}

function ciColor(status, t) {
  if (status === "success") return t.done ?? "#22c55e";
  if (status === "failure") return t.blocked ?? "#ef4444";
  if (status === "pending") return t.working ?? "#f59e0b";
  return t.dim;
}

function ciLabel(status) {
  if (status === "success") return "✓";
  if (status === "failure") return "✗";
  if (status === "pending") return "●";
  return "–";
}

export default class PullRequests extends View {
  init(_props, cx) {
    this.prs = [];
    this.loading = true;
    this.error = null;
    this.acting = {}; // prNumber -> true while a gh action is in flight
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
    this.refresh(cx);
  }

  refresh(cx) {
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

        // Step 2: fetch CI + reviewDecision per PR in parallel
        const details = await Promise.all(list.map(async (pr) => {
          try {
            const r = await exec("gh", [
              "pr", "view", String(pr.number),
              "--repo", pr.repository.nameWithOwner,
              "--json", "number,title,url,isDraft,reviewDecision,statusCheckRollup",
            ]);
            if (r.code !== 0) return { ...pr, reviewDecision: null, statusCheckRollup: [] };
            const d = JSON.parse(r.stdout);
            return { ...pr, ...d };
          } catch {
            return { ...pr, reviewDecision: null, statusCheckRollup: [] };
          }
        }));

        this.prs = details;
        this.error = null;
      } catch (e) {
        this.error = e.message ?? String(e);
      } finally {
        this.loading = false;
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

  render(cx) {
    const t = theme();
    const s = (n) => n * 1; // px passthrough

    const header = h_flex()
      .w_full().h(36).px(14).items_center().justify_between()
      .bg(t.chrome)
      .child(div().text_size(13).font_semibold().text_color(t.foreground).child("Pull Requests"))
      .child(
        h_flex().gap(4)
          .child(
            div().id("pr-refresh").flex().w(22).h(22).rounded(4).items_center().justify_center()
              .text_size(14).text_color(t.muted)
              .hover(s => s.bg(t.hover).text_color(t.foreground))
              .on_click((_e, cx) => { this.loading = true; cx.notify(); this.refresh(cx); })
              .child("↻")
          )
          .child(
            div().id("pr-close").flex().w(22).h(22).rounded(4).items_center().justify_center()
              .text_size(14).text_color(t.muted)
              .hover(s => s.bg(t.hover).text_color(t.foreground))
              .on_click(() => run("layout.hide", { id: "prs" }))
              .child("✕")
          )
      );

    if (this.loading && !this.prs.length) {
      return v_flex().size_full().bg(t.canvas)
        .child(header)
        .child(
          v_flex().flex_1().items_center().justify_center()
            .child(div().text_size(13).text_color(t.muted).child("Loading…"))
        );
    }

    if (this.error) {
      return v_flex().size_full().bg(t.canvas)
        .child(header)
        .child(
          v_flex().flex_1().p(14).gap(6)
            .child(div().text_size(13).text_color(t.blocked ?? "#ef4444").font_semibold().child("Error"))
            .child(div().text_size(12).text_color(t.muted).child(this.error))
        );
    }

    if (!this.prs.length) {
      return v_flex().size_full().bg(t.canvas)
        .child(header)
        .child(
          v_flex().flex_1().items_center().justify_center()
            .child(div().text_size(13).text_color(t.muted).child("No open PRs"))
        );
    }

    // Group by repo
    const byRepo = new Map();
    for (const pr of this.prs) {
      const repo = pr.repository.nameWithOwner;
      if (!byRepo.has(repo)) byRepo.set(repo, []);
      byRepo.get(repo).push(pr);
    }

    const rows = [];
    for (const [repo, prs] of byRepo) {
      // Repo header
      rows.push(
        div().id(`repo-${repo}`).w_full()
          .px(14).py(6)
          .text_size(11).font_semibold().text_color(t.dim)
          .child(repo.split("/")[1].toUpperCase())
      );

      for (const pr of prs) {
        const ci = rollup(pr.statusCheckRollup);
        const isDraft = pr.isDraft;
        const needsReview = !isDraft && pr.reviewDecision === "REVIEW_REQUIRED";
        const approved = pr.reviewDecision === "APPROVED";

        // Status badge text + color
        let badge = null;
        if (isDraft) {
          badge = { label: "Draft", color: t.dim };
        } else if (approved) {
          badge = { label: "Approved", color: t.done ?? "#22c55e" };
        } else if (needsReview) {
          badge = { label: "Review", color: t.working ?? "#f59e0b" };
        }

        const actKey = `${pr.repository.nameWithOwner}#${pr.number}`;

        // Action buttons row
        const actions = h_flex().gap(4).mt(5).children([
          // Open in browser
          actionBtn("↗ Open", t, false, (_e, cx) => {
            this.action(`open-${actKey}`, () => exec("open", [pr.url]), cx);
          }),
          // Ready for review (only for drafts)
          isDraft
            ? actionBtn("→ Ready", t, !!this.acting[`ready-${actKey}`], (_e, cx) => {
                this.action(`ready-${actKey}`, () =>
                  exec("gh", ["pr", "ready", String(pr.number), "--repo", pr.repository.nameWithOwner]), cx);
              })
            : null,
          // Merge (only for non-draft, CI passed or no CI)
          !isDraft
            ? actionBtn("⤵ Merge", t, !!this.acting[`merge-${actKey}`], (_e, cx) => {
                this.action(`merge-${actKey}`, () =>
                  exec("gh", ["pr", "merge", String(pr.number), "--repo", pr.repository.nameWithOwner, "--squash", "--auto"]), cx);
              })
            : null,
        ].filter(Boolean));

        rows.push(
          v_flex().id(`pr-${pr.number}-${repo}`).w_full()
            .px(14).py(10)
            .gap(0)
            .border(1).border_color("#00000000")
            .hover(s => s.bg(t.hover))
            .child(
              // Title row
              h_flex().w_full().gap(6).items_start().flex_wrap().children([
                // CI dot
                div().w(14).h(14).mt(1).flex_shrink_0()
                  .text_size(13).text_color(ciColor(ci, t))
                  .child(ciLabel(ci)),
                // Title
                div().flex_1().min_w(0).text_size(14).text_color(t.foreground)
                  .child(`#${pr.number} ${pr.title}`),
              ])
            )
            .when(badge !== null, el => el.child(
              h_flex().mt(4).ml(20)
                .child(
                  div().px(5).py(1).rounded(3)
                    .text_size(11).font_semibold()
                    .text_color(badge.color)
                    .bg(t.surface)
                    .child(badge.label)
                )
            ))
            .child(div().ml(20).child(actions))
        );
      }
    }

    return v_flex().id("pr-root").size_full().bg(t.canvas)
      .child(header)
      .child(
        div().id("pr-scroll").flex_1().overflow_y_scrollbar().children(rows)
      );
  }
}

function actionBtn(label, t, busy, onClick) {
  return div().id(`btn-${label}`).px(7).py(3).rounded(4)
    .text_size(12).font_semibold()
    .text_color(busy ? t.dim : t.foreground)
    .bg(t.surface)
    .hover(s => s.bg(t.raised))
    .on_click(onClick)
    .child(busy ? "…" : label);
}
