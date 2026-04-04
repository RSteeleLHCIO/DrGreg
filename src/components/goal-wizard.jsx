/**
 * GoalWizard — conversational step-by-step goal creation.
 *
 * Renders inside <DialogContent> (the outer DialogHeader is owned by App.jsx).
 * Each step renders its own Back button + content + <DialogFooter>.
 *
 * Step flow by path:
 *   Reach/fixed:       category → target-type → target-value → target-date → confirm
 *   Reach/best-of:     category → target-type → bestof-value → bestof-period → confirm
 *   Reach/accumulate:  category → target-type → cumulative-sum-value → cumulative-period → confirm
 *   Habit/streak:      category → habit-type → streak-days → confirm
 *   Habit/quota:       category → habit-type → cumulative-quota → cumulative-period → confirm
 *                      (switch/boolean metrics skip habit-type and go straight to cumulative-quota)
 *
 *   Range goals are template-only (clinical edge case). The wizard does not expose them.
 */

import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DialogFooter } from './ui/dialog';
import { ChevronLeft } from 'lucide-react';
import { GOAL_DEFAULTS } from '../db/schema';

// ── Shared subcomponents ──────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', color: '#6b7280',
        cursor: 'pointer', padding: '0 0 14px', fontSize: 13,
      }}
    >
      <ChevronLeft size={14} /> Back
    </button>
  );
}

function StepQuestion({ question, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>{question}</div>
      {subtitle && (
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}

function ChoiceCard({ selected, onClick, title, description }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '13px 15px',
        border: '2px solid',
        borderColor: selected ? '#6366f1' : '#e5e7eb',
        borderRadius: 10,
        background: selected ? '#eef2ff' : 'white',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, color: selected ? '#4f46e5' : '#111827' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12, color: selected ? '#6366f1' : '#6b7280', marginTop: 3, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
    </button>
  );
}

function DirectionPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[
        { v: 'higher_is_better', label: '↑ Higher is better', hint: 'steps, activity, strength' },
        { v: 'lower_is_better',  label: '↓ Lower is better',  hint: 'weight, pain, heart rate' },
      ].map(d => (
        <button
          key={d.v}
          onClick={() => onChange(d.v)}
          style={{
            flex: 1, padding: '10px 12px', border: '2px solid',
            borderColor: value === d.v ? '#6366f1' : '#e5e7eb',
            borderRadius: 8, background: value === d.v ? '#eef2ff' : 'white',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: value === d.v ? '#4f46e5' : '#111827' }}>
            {d.label}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{d.hint}</div>
        </button>
      ))}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'monthly',  label: 'Monthly' },
  { value: 'all_time', label: 'All time' },
];

const PERIOD_PHRASE = {
  daily:    'each day',
  weekly:   'each week',
  monthly:  'each month',
  all_time: 'over all time',
  rolling:  'in a rolling window',
};

// Period suffix used in "I want to X at least N times _____"
const PERIOD_SUFFIX = {
  daily:   'a day',
  weekly:  'a week',
  monthly: 'a month',
};

// Verbs that health metric names commonly start with.
// If the metric name begins with one of these, we use it directly as the verb phrase
// ("I want to cook at home"); otherwise we fall back to "record" as the verb.
const COMMON_ACTION_VERBS = new Set([
  'attend','avoid','bike','brush','call','check','clean','climb',
  'complete','cook','cycle','dance','do','drink','eat','exercise',
  'finish','floss','follow','get','give','go','help','journal',
  'jump','lift','limit','log','make','meditate','move','perform',
  'plan','play','practice','practice','prepare','read','reduce',
  'review','run','schedule','skip','sleep','step','stretch','study',
  'swim','take','test','track','train','try','volunteer','walk',
  'weigh','work','write',
]);

function PeriodPicker({ value, onChange, exclude = [] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {PERIOD_OPTIONS.filter(p => !exclude.includes(p.value)).map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '8px 16px', border: '2px solid', borderRadius: 8, cursor: 'pointer',
            fontSize: 13,
            borderColor: value === opt.value ? '#6366f1' : '#e5e7eb',
            background:  value === opt.value ? '#eef2ff' : 'white',
            color:       value === opt.value ? '#4f46e5' : '#374151',
            fontWeight:  value === opt.value ? 600 : 400,
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Wizard footer: Cancel always on the left, Back/Next on the right
function WizardFooter({ onCancel, children }) {
  return (
    <DialogFooter style={{ justifyContent: 'space-between' }}>
      <Button variant="ghost" onClick={onCancel}
        style={{ color: '#9ca3af', fontWeight: 400, paddingLeft: 0 }}
      >Cancel</Button>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </DialogFooter>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GoalWizard({ open, setOpen, onSave, metricConfig, templates = [] }) {
  const draft  = open.draft ?? {};
  const wiz    = open.wiz   ?? {};
  const step   = open.wizStep ?? 'category';

  const metricId    = open.metricId;
  const metricTitle = open.metricTitle ?? '';
  const cfg         = metricConfig[metricId] ?? {};
  const uom         = cfg.uom ?? '';
  const metric      = metricTitle.toLowerCase();
  const fmtV        = v => v != null ? `${v}${uom ? '\u2009' + uom : ''}` : '—';

  // Atomic state updater — never lose concurrent updates
  const update     = changes => setOpen({ ...open, saveError: undefined, ...changes });
  const updateDraft = fields  => update({ draft: { ...draft, ...fields } });
  const updateWiz   = fields  => update({ wiz:   { ...wiz,   ...fields } });
  const goTo        = wizStep => update({ wizStep });
  const cancel      = () => setOpen(null);

  // ── Back navigation ─────────────────────────────────────────────────────
  const handleBack = () => {
    switch (step) {
      case 'category':          setOpen(null); break;
      case 'target-type':       goTo('category'); break;
      case 'target-value':      goTo('target-type'); break;
      case 'target-date':       goTo('target-value'); break;
      case 'bestof-value':      goTo('target-type'); break;
      case 'bestof-period':     goTo('bestof-value'); break;
      case 'cumulative-sum-value': goTo('target-type'); break;
      case 'habit-type':        goTo('category'); break;
      case 'streak-days':       goTo('habit-type'); break;
      case 'cumulative-quota':       cfg.kind === 'switch' ? goTo('category') : goTo('habit-type'); break;
      case 'cumulative-quota-custom': goTo('cumulative-quota'); break;
      case 'cumulative-period': {
        // came from reach/accumulate path or habit/quota path
        if (draft.goalType === 'cumulative' && wiz.cumulativePath === 'reach') goTo('cumulative-sum-value');
        else goTo('cumulative-quota');
        break;
      }
      case 'confirm': {
        const gt = draft.goalType;
        if (gt === 'target_value') goTo('target-date');
        else if (gt === 'best_of')    goTo('bestof-period');
        else if (gt === 'streak')     goTo('streak-days');
        else if (gt === 'cumulative') {
          // Switch metrics may have used the "Every day" shortcut and skipped cumulative-period
          if (cfg.kind === 'switch') goTo('cumulative-quota');
          else goTo('cumulative-period');
        }
        else goTo('category');
        break;
      }
      default: setOpen(null);
    }
  };

  // ── Summary sentence (shown on confirm screen) ───────────────────────────

  // Returns the verb phrase for habit/streak sentences.
  // If metricTitle starts with an action verb ("Cook at home", "Run") we use it directly;
  // otherwise we prepend "record" ("record Blood Pressure").
  function buildVerbPhrase() {
    const firstWord = metric.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
    return COMMON_ACTION_VERBS.has(firstWord) ? metric : `record ${metric}`;
  }

  function buildSummary() {
    const gt  = draft.goalType;
    const dir = draft.direction;
    const val = draft.targetValue;
    const pp  = PERIOD_PHRASE[draft.period] ?? draft.period ?? '';
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const qualifier = dir === 'lower_is_better' ? 'or less' : 'or more';

    if (gt === 'target_value') {
      if (draft.endDate) {
        return `By ${draft.endDate}, I want my ${metric} to be ${fmtV(val)} ${qualifier}`;
      }
      return `${cap(pp)}, I want my ${metric} to reach ${fmtV(val)} ${qualifier}`;
    }
    if (gt === 'best_of') {
      return `I want to achieve a ${metric} of ${fmtV(val)} ${qualifier} — best reading ${pp}`;
    }
    if (gt === 'streak') {
      return `I want to ${buildVerbPhrase()} for ${draft.streakTarget} consecutive days`;
    }
    if (gt === 'cumulative') {
      const qualifier2 = dir === 'higher_is_better' ? 'at least' : 'no more than';
      if (draft.aggregation === 'sum') {
        return `${cap(pp)}, I want my total ${metric} to be ${qualifier2} ${fmtV(val)}`;
      }
      // Count-based habit
      const vp = buildVerbPhrase();
      // Switch metric doing it once a day → simplest possible phrasing
      if (cfg.kind === 'switch' && val === 1 && draft.period === 'daily') {
        return `I want to ${vp} every day`;
      }
      const suffix = PERIOD_SUFFIX[draft.period] ?? pp;
      return `I want to ${vp} ${qualifier2} ${val} time${val !== 1 ? 's' : ''} ${suffix}`;
    }
    return '';
  }

  // ── Auto-suggested goal name ─────────────────────────────────────────────
  function buildDefaultName() {
    const gt  = draft.goalType;
    const dir = draft.direction;
    const qualifier = dir === 'lower_is_better' ? 'or less' : 'or more';
    if (gt === 'target_value')  return `${metricTitle} ${fmtV(draft.targetValue)} ${qualifier}`;
    if (gt === 'best_of')       return `${metricTitle} personal best — ${fmtV(draft.targetValue)}`;
    if (gt === 'streak')        return `${draft.streakTarget}-day ${metric} streak`;
    if (gt === 'cumulative') {
      const q = dir === 'higher_is_better' ? 'at least' : 'at most';
      const PERIOD_LABEL = { daily: 'day', weekly: 'week', monthly: 'month', all_time: 'all time', rolling: 'period' };
      const period = PERIOD_LABEL[draft.period] ?? draft.period ?? 'period';
      if (draft.aggregation === 'sum') {
        return `${metricTitle} ${q} ${fmtV(draft.targetValue)} per ${period}`;
      }
      // Boolean/switch metric: "Take X every day" reads more naturally than "at least 1× per day"
      if (cfg.kind === 'switch' && draft.targetValue === 1 && draft.period === 'daily') {
        return `${metricTitle} — every day`;
      }
      return `${metricTitle} ${q} ${draft.targetValue}× per ${period}`;
    }
    return `${metricTitle} goal`;
  }

  // Atomically move to confirm, always regenerating the name unless user explicitly customised it
  const goToConfirm = () => {
    const name = wiz.nameIsCustom ? draft.name : buildDefaultName();
    update({ wizStep: 'confirm', draft: { ...draft, name } });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: category
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'category') {
    return (
      <>
        {/* Template quick-starts */}
        {templates.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Quick Start
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {templates.map(tpl => {
                const todayIso = new Date().toISOString().split('T')[0];
                return (
                  <button
                    key={tpl.templateId}
                    onClick={() => {
                      const d = {
                        ...GOAL_DEFAULTS, metricId,
                        name: tpl.name, goalType: tpl.goalType, period: tpl.period,
                        direction: tpl.direction, aggregation: tpl.aggregation,
                        targetValue: tpl.suggestedTarget ?? null,
                        targetMin: tpl.suggestedMin ?? null, targetMax: tpl.suggestedMax ?? null,
                        streakTarget: tpl.suggestedStreak ?? null, startDate: todayIso,
                      };
                      update({ wizStep: 'confirm', draft: d, wiz: {} });
                    }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
                      background: 'white', cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#6366f1'; }}
                    onMouseOut={e =>  { e.currentTarget.style.background = 'white';   e.currentTarget.style.borderColor = '#e5e7eb'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{tpl.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        {tpl.period.replace('_', ' ')} · {tpl.goalType.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 500, paddingLeft: 8, flexShrink: 0 }}>
                      Use →
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 4px' }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>or build your own</span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>
          </div>
        )}

        <StepQuestion question="What kind of goal do you want to set?" />
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <ChoiceCard
            selected={wiz.category === 'reach'}
            onClick={() => updateWiz({ category: 'reach' })}
            title="🎯  Reach a target"
            description={`Work toward a specific ${metric} value — by a date or over time`}
          />
          <ChoiceCard
            selected={wiz.category === 'habit'}
            onClick={() => updateWiz({ category: 'habit' })}
            title="🔥  Build a habit"
            description={`Commit to recording ${metric} consistently — by streak or quota`}
          />
        </div>
        <WizardFooter onCancel={cancel}>
          <Button
            disabled={!wiz.category}
            onClick={() => {
              if (wiz.category === 'reach') {
                goTo('target-type');
              } else if (wiz.category === 'habit' && cfg.kind === 'switch') {
                // Boolean (switch) metrics: skip habit-type entirely, always count
                update({
                  draft: { ...draft, goalType: 'cumulative', aggregation: 'count', direction: 'higher_is_better' },
                  wiz: { ...wiz, cumulativePath: 'habit', habitType: 'cumulative' },
                  wizStep: 'cumulative-quota',
                });
              } else {
                goTo('habit-type');
              }
            }}
          >
            Next
          </Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: target-type
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'target-type') {
    const flavor = cfg.trackingFlavor ?? null;
    // standalone: summing individual readings is meaningless (heart rate, weight)
    // cumulative: per-session target is valid but needs a clearer label
    const showAccumulate = flavor !== 'standalone';
    const targetValueTitle = flavor === 'cumulative'
      ? 'Hit a per-session target'
      : 'Reach a specific number';
    const targetValueDesc = flavor === 'cumulative'
      ? `e.g. "Run at least 1 mile every session" — each entry must meet the bar`
      : `e.g. "Get my ${metric} to 160" — a finish line you work toward`;
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion question="What kind of target is it?" />
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <ChoiceCard
            selected={wiz.targetType === 'target_value'}
            onClick={() => updateWiz({ targetType: 'target_value' })}
            title={targetValueTitle}
            description={targetValueDesc}
          />
          <ChoiceCard
            selected={wiz.targetType === 'best_of'}
            onClick={() => updateWiz({ targetType: 'best_of' })}
            title="Beat my personal best"
            description={`e.g. "Achieve a ${metric} reading I've never hit before"`}
          />
          {showAccumulate && (
            <ChoiceCard
              selected={wiz.targetType === 'cumulative'}
              onClick={() => updateWiz({ targetType: 'cumulative' })}
              title="Accumulate a total"
              description={`e.g. "${flavor === 'cumulative' ? 'Run 20 miles' : 'Walk 50,000 steps'} this week" — add up entries over a period`}
            />
          )}
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button
            disabled={!wiz.targetType}
            onClick={() => {
              const goalType = wiz.targetType;
              if (goalType === 'cumulative') {
                update({
                  draft: { ...draft, goalType: 'cumulative', aggregation: 'sum' },
                  wiz: { ...wiz, cumulativePath: 'reach' },
                  wizStep: 'cumulative-sum-value',
                });
              } else {
                update({
                  draft: { ...draft, goalType, aggregation: 'avg', period: 'all_time' },
                  wizStep: goalType === 'target_value' ? 'target-value' : 'bestof-value',
                });
              }
            }}
          >
            Next
          </Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: target-value  (target_value goalType)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'target-value') {
    const canNext = draft.targetValue != null && !!draft.direction;
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question={`What do you want your ${metric} to reach?`}
          subtitle={uom ? `Enter a value in ${uom}` : undefined}
        />
        <div style={{ display: 'grid', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input
              type="number"
              autoFocus
              placeholder="Target value"
              value={draft.targetValue ?? ''}
              onChange={e => updateDraft({ targetValue: e.target.value !== '' ? Number(e.target.value) : null })}
              style={{ width: 140 }}
            />
            {uom && <span style={{ color: '#6b7280', fontSize: 14 }}>{uom}</span>}
          </div>
          <div>
            <Label style={{ display: 'block', marginBottom: 8 }}>Which direction is progress?</Label>
            <DirectionPicker value={draft.direction} onChange={v => updateDraft({ direction: v })} />
          </div>
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!canNext} onClick={() => goTo('target-date')}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: target-date  (optional deadline for target_value)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'target-date') {
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question="Do you have a target date?"
          subtitle="Optional — leave blank to track until you reach it whenever"
        />
        <div style={{ marginBottom: 8 }}>
          <Input
            type="date"
            value={draft.endDate ?? ''}
            onChange={e => updateDraft({ endDate: e.target.value || null, period: 'all_time' })}
            style={{ width: 'auto' }}
          />
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button onClick={goToConfirm}>{draft.endDate ? 'Next' : 'Skip'}</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: cumulative-sum-value  (accumulate path from reach/target-type)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'cumulative-sum-value') {
    const canNext = draft.targetValue != null && !!draft.direction;
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question={`What total ${metric} do you want to accumulate?`}
          subtitle={uom ? `Value in ${uom}` : undefined}
        />
        <div style={{ display: 'grid', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input
              type="number"
              autoFocus
              min={0}
              placeholder="e.g. 50000"
              value={draft.targetValue ?? ''}
              onChange={e => updateDraft({ targetValue: e.target.value !== '' ? Number(e.target.value) : null })}
              style={{ width: 140 }}
            />
            {uom && <span style={{ color: '#6b7280', fontSize: 14 }}>{uom}</span>}
          </div>
          <div>
            <Label style={{ display: 'block', marginBottom: 8 }}>Is this a minimum or a limit?</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'higher_is_better', label: 'At least this much', desc: 'I want to meet or exceed this total' },
                { v: 'lower_is_better',  label: 'No more than this',  desc: 'I want to stay under this total' },
              ].map(d => (
                <button
                  key={d.v}
                  onClick={() => updateDraft({ direction: d.v })}
                  style={{
                    flex: 1, padding: '10px 12px', border: '2px solid',
                    borderColor: draft.direction === d.v ? '#6366f1' : '#e5e7eb',
                    borderRadius: 8, background: draft.direction === d.v ? '#eef2ff' : 'white',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: draft.direction === d.v ? '#4f46e5' : '#111827' }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!canNext} onClick={() => goTo('cumulative-period')}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: bestof-value  (best_of goalType)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'bestof-value') {
    const canNext = draft.targetValue != null && !!draft.direction;
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question={`What's the ${metric} record you want to beat?`}
          subtitle={uom ? `Enter a value in ${uom}` : undefined}
        />
        <div style={{ display: 'grid', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input
              type="number"
              autoFocus
              placeholder="Value to beat"
              value={draft.targetValue ?? ''}
              onChange={e => updateDraft({ targetValue: e.target.value !== '' ? Number(e.target.value) : null })}
              style={{ width: 140 }}
            />
            {uom && <span style={{ color: '#6b7280', fontSize: 14 }}>{uom}</span>}
          </div>
          <div>
            <Label style={{ display: 'block', marginBottom: 8 }}>Which direction is "better"?</Label>
            <DirectionPicker value={draft.direction} onChange={v => updateDraft({ direction: v })} />
          </div>
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!canNext} onClick={() => goTo('bestof-period')}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: bestof-period
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'bestof-period') {
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question="Over what time window should we find your best?"
          subtitle="How far back should we look when evaluating your personal best"
        />
        <div style={{ marginBottom: 8 }}>
          <PeriodPicker value={draft.period} onChange={v => updateDraft({ period: v })} />
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!draft.period} onClick={goToConfirm}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: habit-type
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'habit-type') {
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion question="What kind of habit are you building?" />
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <ChoiceCard
            selected={wiz.habitType === 'streak'}
            onClick={() => updateWiz({ habitType: 'streak' })}
            title="🔥  Daily streak"
            description={`Record ${metric} for N consecutive days — streak resets if you miss a day`}
          />
          <ChoiceCard
            selected={wiz.habitType === 'cumulative'}
            onClick={() => updateWiz({ habitType: 'cumulative' })}
            title="📅  Regular quota"
            description={`Record ${metric} a set number of times per day / week / month`}
          />
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button
            disabled={!wiz.habitType}
            onClick={() => {
              if (wiz.habitType === 'streak') {
                update({
                  draft: { ...draft, goalType: 'streak', direction: 'higher_is_better', aggregation: 'count', period: 'all_time' },
                  wizStep: 'streak-days',
                });
              } else {
                update({
                  draft: { ...draft, goalType: 'cumulative', aggregation: 'count', direction: 'higher_is_better' },
                  wiz: { ...wiz, cumulativePath: 'habit' },
                  wizStep: 'cumulative-quota',
                });
              }
            }}
          >
            Next
          </Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: streak-days
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'streak-days') {
    const canNext = draft.streakTarget != null && draft.streakTarget >= 1;
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question={`How many consecutive days do you want to record ${metric}?`}
          subtitle="Your streak resets to zero if you miss a day"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Input
            type="number"
            autoFocus
            min={1}
            placeholder="e.g. 30"
            value={draft.streakTarget ?? ''}
            onChange={e => {
              const n = parseInt(e.target.value, 10);
              updateDraft({ streakTarget: e.target.value !== '' && n > 0 ? n : null });
            }}
            style={{ width: 120 }}
          />
          <span style={{ color: '#6b7280', fontSize: 14 }}>consecutive days</span>
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!canNext} onClick={goToConfirm}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: cumulative-quota  (target value; habit path always count, reach/sum path uses sum)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'cumulative-quota') {
    // habit path is always count; reach/accumulate path handled by cumulative-sum-value
    // For boolean/switch metrics, offer an "Every day" shortcut that skips the period step
    const isSwitch = cfg.kind === 'switch';
    if (isSwitch) {
      return (
        <>
          <BackButton onClick={handleBack} />
          <StepQuestion
            question={`How often do you want to ${metric}?`}
          />
          <div style={{ display: 'grid', gap: 10, marginBottom: 8 }}>
            <ChoiceCard
              selected={draft.targetValue === 1 && draft.period === 'daily'}
              title="Every day"
              description="I want to do this once every day"
              onClick={() => {
                const newDraft = { ...draft, targetValue: 1, period: 'daily', direction: 'higher_is_better' };
                const name = wiz.nameIsCustom ? draft.name : `${metricTitle} \u2014 every day`;
                update({ draft: { ...newDraft, name }, wizStep: 'confirm', wiz: { ...wiz, nameIsCustom: false } });
              }}
            />
            <ChoiceCard
              selected={!(draft.targetValue === 1 && draft.period === 'daily') && draft.targetValue != null}
              title="Custom frequency"
              description="e.g. 5 days a week, 3 times a month"
              onClick={() => update({
                draft: { ...draft, targetValue: null, period: null, direction: 'higher_is_better' },
                wizStep: 'cumulative-quota-custom',
              })}
            />
          </div>
          <WizardFooter onCancel={cancel}>
            <Button variant="secondary" onClick={handleBack}>Back</Button>
          </WizardFooter>
        </>
      );
    }
    const canNext = draft.targetValue != null && !!draft.direction;
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question={`How many times do you want to record ${metric}?`}
        />
        <div style={{ display: 'grid', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input
              type="number"
              autoFocus
              min={0}
              placeholder="e.g. 5"
              value={draft.targetValue ?? ''}
              onChange={e => updateDraft({ targetValue: e.target.value !== '' ? Number(e.target.value) : null })}
              style={{ width: 140 }}
            />
            <span style={{ color: '#6b7280', fontSize: 14 }}>times</span>
          </div>
          <div>
            <Label style={{ display: 'block', marginBottom: 8 }}>
              Is this a minimum or a limit?
            </Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'higher_is_better', label: 'At least this many', desc: 'I want to meet or exceed this' },
                { v: 'lower_is_better',  label: 'No more than this',  desc: 'I want to stay under this limit' },
              ].map(d => (
                <button
                  key={d.v}
                  onClick={() => updateDraft({ direction: d.v })}
                  style={{
                    flex: 1, padding: '10px 12px', border: '2px solid',
                    borderColor: draft.direction === d.v ? '#6366f1' : '#e5e7eb',
                    borderRadius: 8, background: draft.direction === d.v ? '#eef2ff' : 'white',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: draft.direction === d.v ? '#4f46e5' : '#111827' }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!canNext} onClick={() => goTo('cumulative-period')}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: cumulative-quota-custom  (switch metric, custom frequency path)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'cumulative-quota-custom') {
    const canNext = draft.targetValue != null && draft.targetValue > 0 && !!draft.direction;
    return (
      <>
        <BackButton onClick={() => goTo('cumulative-quota')} />
        <StepQuestion
          question={`How many times do you want to ${metric}?`}
          subtitle="You'll set the time window on the next screen"
        />
        <div style={{ display: 'grid', gap: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input
              type="number"
              autoFocus
              min={1}
              placeholder="e.g. 5"
              value={draft.targetValue ?? ''}
              onChange={e => updateDraft({ targetValue: e.target.value !== '' ? Number(e.target.value) : null })}
              style={{ width: 140 }}
            />
            <span style={{ color: '#6b7280', fontSize: 14 }}>times</span>
          </div>
          <div>
            <Label style={{ display: 'block', marginBottom: 8 }}>Is this a minimum or a limit?</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'higher_is_better', label: 'At least this many', desc: 'I want to meet or exceed this' },
                { v: 'lower_is_better',  label: 'No more than this',  desc: 'I want to stay under this limit' },
              ].map(d => (
                <button
                  key={d.v}
                  onClick={() => updateDraft({ direction: d.v })}
                  style={{
                    flex: 1, padding: '10px 12px', border: '2px solid',
                    borderColor: draft.direction === d.v ? '#6366f1' : '#e5e7eb',
                    borderRadius: 8, background: draft.direction === d.v ? '#eef2ff' : 'white',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: draft.direction === d.v ? '#4f46e5' : '#111827' }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={() => goTo('cumulative-quota')}>Back</Button>
          <Button disabled={!canNext} onClick={() => goTo('cumulative-period')}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: cumulative-period
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'cumulative-period') {
    return (
      <>
        <BackButton onClick={handleBack} />
        <StepQuestion
          question="Per what time period?"
          subtitle="This is the window that resets — each day, week, or month"
        />
        <div style={{ marginBottom: 8 }}>
          <PeriodPicker
            value={draft.period}
            onChange={v => updateDraft({ period: v })}
            exclude={['all_time']}
          />
        </div>
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button disabled={!draft.period} onClick={goToConfirm}>Next</Button>
        </WizardFooter>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: confirm
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'confirm') {
    const summary = buildSummary();
    return (
      <>
        <BackButton onClick={handleBack} />
        {summary && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
            padding: '13px 15px', marginBottom: 18,
            fontSize: 14, lineHeight: 1.6, color: '#14532d', fontStyle: 'italic',
          }}>
            "{summary}"
          </div>
        )}
        <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
          <Label>Goal name</Label>
          <Input
            autoFocus
            value={draft.name ?? ''}
            placeholder="Name this goal"
            onChange={e => update({ draft: { ...draft, name: e.target.value }, wiz: { ...wiz, nameIsCustom: !!e.target.value.trim() } })}
          />
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            This is how it will appear on your dashboard
          </div>
        </div>
        {open.saveError && (
          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{open.saveError}</div>
        )}
        <WizardFooter onCancel={cancel}>
          <Button variant="secondary" onClick={handleBack}>Back</Button>
          <Button onClick={onSave} disabled={open.isSaving}>
            {open.isSaving ? 'Saving…' : 'Save Goal'}
          </Button>
        </WizardFooter>
      </>
    );
  }

  return null;
}
