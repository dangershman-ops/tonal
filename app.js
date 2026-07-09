(function () {
  'use strict';

  // ---- tweakable business inputs (mirrors the design's "Tweaks" panel) ----
  const CONFIG = {
    tonal2Price: 4295,
    tonal1Price: 2495,
    essentialPrice: 495,
    ultimatePrice: 595,
    membershipPrice: 59.95,
  };

  // Paste the Google Apps Script Web App URL here (see app/GOOGLE_SHEETS_SETUP.md).
  // Leave blank to skip logging — the Send flow still works locally either way.
  const SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzg5uDJ_HtuLQAO2gcgZpmYyuCJfDqBlxd_P4Wvo7L-cUmd1k7bdPwLsI97wFIuPrkspw/exec';

  function logQuoteToSheet(email, quoteLines, totalPrice) {
    if (!SHEETS_WEBHOOK_URL) return;
    fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ email, quoteLines, totalPrice, timestamp: new Date().toISOString() }),
    }).catch((err) => console.warn('Sheet logging failed:', err));
  }

  const BUNDLES = [
    { key: 'none', name: 'No accessories', price: 0, count: 'Trainer only', movements: 'Just the trainer — add Smart Accessories anytime later' },
    { key: 'essential', name: 'Essential Accessories', price: CONFIG.essentialPrice, count: '7 accessories included', movements: 'Unlocks 285+ movements — upper, lower & core' },
    { key: 'ultimate', name: 'Ultimate Accessories', price: CONFIG.ultimatePrice, count: '9 accessories included', movements: 'Adds Pilates loops & ankle strap — 320+ exercises' },
  ];

  const SHIP = [
    { key: 'standard', label: 'Standard', sub: 'Within 100 miles', price: 295 },
    { key: 'extended', label: 'Extended', sub: '100+ miles away', price: 495 },
  ];

  const WARRANTY = [
    { key: 'none', name: 'No extended warranty', price: 0 },
    { key: 'four', name: '4-Year Warranty', price: 425 },
    { key: 'five', name: '5-Year Warranty', price: 449 },
  ];

  const H_LABELS = { 1: 'Just me', 2: 'Me & my partner', 3: 'Small family', 4: 'Small family', 5: 'Whole family', 6: 'Whole family' };

  const GYM_PP = 65;     // $/mo per person — U.S. Health & Fitness Association
  const SESS_RATE = 65;  // $/hr — NESTA certified
  const HOME_GYM_HIGH = 25000; // top of $7K–$25K range — RitFit

  const state = {
    step: 0,
    trainer: 'tonal2',
    bundle: 'essential',
    shipping: 'standard',
    warranty: 'none',
    taxPct: 7,
    discountMode: 'pct',
    discountPct: 0,
    discountDollar: 0,
    household: 1,
    compareTab: 'membership',
    email: '',
    sent: false,
  };

  function setState(patch) {
    Object.assign(state, patch);
    renderFull();
  }

  function fmt(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function computeVals() {
    const s = state;

    // ---- trainer ----
    const isTonal2 = s.trainer === 'tonal2';
    const trainerPrice = isTonal2 ? CONFIG.tonal2Price : CONFIG.tonal1Price;
    const trainerName = isTonal2 ? 'Tonal 2' : 'Tonal 1';

    // ---- accessories bundle (required) ----
    const bundleObj = BUNDLES.find((b) => b.key === s.bundle) || BUNDLES[0];
    const bundlePrice = bundleObj.price;

    // ---- shipping & installation (rep) ----
    const shipObj = SHIP.find((x) => x.key === s.shipping) || SHIP[0];
    const shippingCost = shipObj.price;

    // ---- extended warranty (optional, Tonal 2 only) ----
    const warrantyObj = WARRANTY.find((w) => w.key === s.warranty) || WARRANTY[0];
    const warrantyPrice = isTonal2 ? warrantyObj.price : 0;

    // ---- totals ----
    const discountMode = s.discountMode;
    const discountPct = s.discountPct;
    const discountDollar = s.discountDollar;
    const discountAmount = !isTonal2 ? 0 : (discountMode === 'dollar'
      ? Math.min(discountDollar, trainerPrice)
      : trainerPrice * (discountPct / 100));
    const subtotal = (trainerPrice - discountAmount) + bundlePrice + shippingCost + warrantyPrice;
    const taxPct = s.taxPct;
    const taxAmount = subtotal * (taxPct / 100);
    const allIn = subtotal + taxAmount;
    const taxPctLabel = (Math.round(taxPct * 100) / 100).toString();

    const summary = [
      { label: trainerName + ' trainer', value: fmt(trainerPrice) },
    ];
    if (discountAmount > 0) {
      const discLabel = discountMode === 'dollar' ? 'Trainer discount' : 'Trainer discount (' + discountPct + '%)';
      summary.push({ label: discLabel, value: '-' + fmt(discountAmount) });
    }
    summary.push(
      { label: bundleObj.name, value: fmt(bundlePrice) },
      { label: shipObj.label + ' shipping & install', value: fmt(shippingCost) },
    );
    if (isTonal2) {
      summary.push({ label: warrantyObj.name, value: fmt(warrantyPrice) });
    }
    summary.push({ label: 'Sales tax (' + taxPctLabel + '%)', value: fmt(taxAmount) });

    // ---- compare: membership economics ----
    const membership = CONFIG.membershipPrice;
    const N = s.household;
    const tonalMo = membership;
    const gymMo = GYM_PP * N;
    const trainerMo = SESS_RATE * 4 * N;
    const maxMo = Math.max(tonalMo, gymMo, trainerMo);
    const barPct = (v) => Math.max(7, Math.round((v / maxMo) * 100));
    const columns = [
      { label: 'Tonal', sub: 'Membership · whole household', note: '', valueLabel: fmt(tonalMo) + '/mo', valColor: '#51dea2', barPct: barPct(tonalMo), barBg: 'linear-gradient(180deg,#71fbbd,#26bf86)', barGlow: '0 0 28px rgba(81,222,162,.4)' },
      { label: 'Gym', sub: '$65/mo · ' + N + ' member' + (N > 1 ? 's' : ''), note: 'according to U.S. Health & Fitness Association', valueLabel: fmt(gymMo) + '/mo', valColor: '#f2c14f', barPct: barPct(gymMo), barBg: 'linear-gradient(180deg,#f2c14f,#b78a1f)', barGlow: 'none' },
      { label: 'Personal Trainer', sub: '$65/hr · 4 sessions/mo', note: 'according to NESTA certified', valueLabel: fmt(trainerMo) + '/mo', valColor: '#e88a8e', barPct: barPct(trainerMo), barBg: 'linear-gradient(180deg,#c54e53,#7e2f33)', barGlow: 'none' },
    ];
    const household = [1, 2, 3, 4, 5, 6].map((n) => ({
      n,
      bg: n === N ? '#51dea2' : 'rgba(255,255,255,.02)',
      border: n === N ? '#51dea2' : 'rgba(134,148,138,.18)',
      color: n === N ? '#051512' : '#bbcabf',
    }));
    const memDiff = gymMo - tonalMo;
    const memSavesPositive = memDiff >= 0;
    const memSavesCopy = memSavesPositive
      ? 'less/mo than ' + N + ' gym membership' + (N > 1 ? 's' : '') + ' — and Tonal never goes up as the family grows.'
      : 'more/mo than a single gym membership — but your whole household trains for the same flat price. Add one person and Tonal already wins.';

    // ---- compare: home gym sticker ----
    const tonalBarPct = Math.max(6, Math.round((allIn / HOME_GYM_HIGH) * 100));
    const isMembershipTab = s.compareTab === 'membership';
    const emailValid = /.+@.+\..+/.test(s.email.trim());

    return {
      step: s.step,
      trainerName,
      isTonal2,
      isTonal1: !isTonal2,
      allInLabel: fmt(allIn),
      bundleObj,
      shipObj,
      summary,
      taxPct,
      taxPctLabel,
      discountMode,
      discountPct,
      discountDollar,
      trainerPrice,
      switchLabel: isTonal2 ? 'Switch to Tonal 1' : 'Switch to Tonal 2',

      household,
      householdLabel: H_LABELS[N],
      columns,
      isMembershipTab,
      isHomeGymTab: !isMembershipTab,
      membershipLabel: '$' + membership.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      memSavesLabel: '$' + Math.round(Math.abs(memDiff)),
      memSavesPositive,
      memSavesCopy,
      memSavesColor: memSavesPositive ? '#51dea2' : '#f2c14f',
      memSavesCalloutBg: memSavesPositive ? 'linear-gradient(150deg,rgba(81,222,162,.12),rgba(23,28,31,.4))' : 'linear-gradient(150deg,rgba(242,193,79,.10),rgba(23,28,31,.4))',
      memSavesCalloutBorder: memSavesPositive ? 'rgba(81,222,162,.26)' : 'rgba(242,193,79,.32)',
      homeGymBars: [
        { label: 'Tonal', sub: trainerName + ' · all-in', note: '', valueLabel: fmt(allIn), valColor: '#51dea2', barPct: tonalBarPct, barBg: 'linear-gradient(180deg,#71fbbd,#26bf86)', barGlow: '0 0 28px rgba(81,222,162,.4)' },
        { label: 'Home Gym', sub: 'Rack · cables · dumbbells · bench', note: 'according to RitFit', valueLabel: '$7K–$25K', valColor: '#86948a', barPct: 100, barBg: 'linear-gradient(180deg,#5d6a62,#3a4440)', barGlow: 'none' },
      ],

      email: s.email,
      emailValid,
    };
  }

  // ---- DOM refs ----
  const el = (id) => document.getElementById(id);

  function renderBundleList(vals) {
    el('bundleList').innerHTML = BUNDLES.map((b) => {
      const on = b.key === state.bundle;
      return `<button data-action="selectBundle" data-value="${b.key}" style="display:flex;align-items:flex-start;gap:13px;width:100%;text-align:left;padding:15px;border-radius:16px;background:${on ? 'rgba(81,222,162,.08)' : 'rgba(255,255,255,.015)'};border:1px solid ${on ? 'rgba(81,222,162,.45)' : 'rgba(134,148,138,.18)'}">
        <span style="flex:none;width:20px;height:20px;border-radius:50%;margin-top:2px;border:2px solid ${on ? '#51dea2' : 'rgba(134,148,138,.4)'};background:${on ? '#51dea2' : 'transparent'};display:flex;align-items:center;justify-content:center">
          <span style="width:7px;height:7px;border-radius:50%;background:#051512;opacity:${on ? '1' : '0'}"></span>
        </span>
        <span style="flex:1;min-width:0">
          <span style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
            <span style="font-size:14px;font-weight:700;color:#f1f5f3">${b.name}</span>
            <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:18px;color:${on ? '#51dea2' : '#bbcabf'};white-space:nowrap">${fmt(b.price)}</span>
          </span>
          <span style="display:block;font-size:11.5px;color:#bbcabf;margin-top:4px;line-height:1.4">${b.movements}</span>
          <span style="display:block;font-size:10px;font-weight:600;color:#86948a;margin-top:6px">${b.count}</span>
        </span>
      </button>`;
    }).join('');
  }

  function renderShippingList() {
    el('shippingList').innerHTML = SHIP.map((x) => {
      const on = x.key === state.shipping;
      return `<button data-action="selectShipping" data-value="${x.key}" style="flex:1;display:flex;flex-direction:column;gap:4px;padding:13px 14px;border-radius:14px;text-align:left;background:${on ? 'rgba(81,222,162,.08)' : 'rgba(255,255,255,.02)'};border:1px solid ${on ? 'rgba(81,222,162,.45)' : 'rgba(134,148,138,.2)'}">
        <span style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">
          <span style="font-size:12.5px;font-weight:700;color:${on ? '#f1f5f3' : '#bbcabf'}">${x.label}</span>
          <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:17px;color:${on ? '#51dea2' : '#86948a'}">${fmt(x.price)}</span>
        </span>
        <span style="font-size:10.5px;font-weight:600;color:${on ? '#71fbbd' : '#86948a'}">${x.sub}</span>
      </button>`;
    }).join('');
  }

  function renderWarrantyList() {
    el('warrantyList').innerHTML = WARRANTY.map((w) => {
      const on = w.key === state.warranty;
      return `<button data-action="selectWarranty" data-value="${w.key}" style="display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;padding:14px 15px;border-radius:14px;background:${on ? 'rgba(81,222,162,.08)' : 'rgba(255,255,255,.015)'};border:1px solid ${on ? 'rgba(81,222,162,.45)' : 'rgba(134,148,138,.18)'}">
        <span style="display:flex;align-items:center;gap:12px">
          <span style="flex:none;width:18px;height:18px;border-radius:50%;border:2px solid ${on ? '#51dea2' : 'rgba(134,148,138,.4)'};background:${on ? '#51dea2' : 'transparent'};display:flex;align-items:center;justify-content:center">
            <span style="width:6px;height:6px;border-radius:50%;background:#051512;opacity:${on ? '1' : '0'}"></span>
          </span>
          <span style="font-size:13px;font-weight:700;color:#f1f5f3">${w.name}</span>
        </span>
        <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:16px;color:${on ? '#51dea2' : '#bbcabf'}">${fmt(w.price)}</span>
      </button>`;
    }).join('');
  }

  function renderSummaryRows(containerId, summary) {
    el(containerId).innerHTML = summary.map((r) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(134,148,138,.12)">
        <span style="font-size:12.5px;color:#bbcabf">${r.label}</span>
        <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:17px;color:#dfe3e7">${r.value}</span>
      </div>`).join('');
  }

  function renderSendSummaryRows(containerId, summary) {
    el(containerId).innerHTML = summary.map((r) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0">
        <span style="font-size:12px;color:#bbcabf">${r.label}</span>
        <span style="font-size:13px;font-weight:600;color:#dfe3e7">${r.value}</span>
      </div>`).join('');
  }

  function renderHouseholdList(vals) {
    el('householdList').innerHTML = vals.household.map((h) => `
      <button data-action="selectHousehold" data-value="${h.n}" style="flex:1;height:40px;border-radius:10px;border:1px solid ${h.border};background:${h.bg};color:${h.color};font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:17px">${h.n}</button>`).join('');
  }

  function renderCompareColumns(vals) {
    el('compareColumns').innerHTML = vals.columns.map((c) => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
        <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:18px;color:${c.valColor};margin-bottom:6px">${c.valueLabel}</span>
        <div style="width:100%;height:${c.barPct}%;min-height:8px;border-radius:10px 10px 3px 3px;background:${c.barBg};box-shadow:${c.barGlow}"></div>
        <span style="margin-top:9px;font-size:11px;font-weight:700;color:#dfe3e7;text-align:center">${c.label}</span>
        <span style="margin-top:2px;font-size:9.5px;color:#86948a;text-align:center;line-height:1.3">${c.sub}</span>
        <span style="margin-top:3px;font-size:8px;color:#5d6a62;text-align:center;line-height:1.25;min-height:20px">${c.note}</span>
      </div>`).join('');
  }

  function renderHomeGymBars(vals) {
    el('homeGymBars').innerHTML = vals.homeGymBars.map((b) => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
        <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:800;font-size:22px;color:${b.valColor};margin-bottom:8px;text-align:center">${b.valueLabel}</span>
        <div style="width:100%;height:${b.barPct}%;min-height:8px;border-radius:12px 12px 4px 4px;background:${b.barBg};box-shadow:${b.barGlow}"></div>
        <span style="margin-top:11px;font-size:12px;font-weight:700;color:#dfe3e7;text-align:center">${b.label}</span>
        <span style="margin-top:3px;font-size:10px;color:#86948a;text-align:center;line-height:1.3">${b.sub}</span>
        <span style="margin-top:3px;font-size:8px;color:#5d6a62;text-align:center;line-height:1.25">${b.note}</span>
      </div>`).join('');
  }

  function syncDiscountModeUI(vals) {
    const isDollar = vals.discountMode === 'dollar';
    el('discModePctBtn').style.background = isDollar ? 'transparent' : '#51dea2';
    el('discModePctBtn').style.color = isDollar ? '#86948a' : '#051512';
    el('discModeDollarBtn').style.background = isDollar ? '#51dea2' : 'transparent';
    el('discModeDollarBtn').style.color = isDollar ? '#051512' : '#86948a';
    el('discountPctSuffix').style.display = isDollar ? 'none' : 'inline';
    el('discountDollarPrefix').style.display = isDollar ? 'inline' : 'none';
    const max = isDollar ? vals.trainerPrice : 30;
    el('discountRange').max = max;
    el('discountRange').step = isDollar ? 25 : 1;
    el('discountMinLabel').textContent = isDollar ? '$0' : '0%';
    el('discountMaxLabel').textContent = isDollar ? fmt(max) : '30%';
  }

  function renderFull() {
    const vals = computeVals();

    // ---- flow / step rail ----
    el('track').style.transform = 'translateX(-' + (vals.step * (100 / 3)) + '%)';
    el('stepPriceBar').style.background = '#51dea2';
    el('stepCompareBar').style.background = vals.step >= 1 ? '#51dea2' : 'rgba(134,148,138,.22)';
    el('stepSendBar').style.background = vals.step >= 2 ? '#51dea2' : 'rgba(134,148,138,.22)';
    el('stepPriceColor').style.color = vals.step === 0 ? '#51dea2' : '#bbcabf';
    el('stepCompareColor').style.color = vals.step === 1 ? '#51dea2' : (vals.step > 1 ? '#bbcabf' : '#5d6a62');
    el('stepSendColor').style.color = vals.step === 2 ? '#51dea2' : '#5d6a62';

    // ---- price screen ----
    el('switchLabel').textContent = vals.switchLabel;
    el('allInHero').textContent = vals.allInLabel;
    renderBundleList(vals);
    renderShippingList();
    renderWarrantyList();
    el('warrantySection').style.display = vals.isTonal2 ? 'block' : 'none';
    el('discountBlock').style.display = vals.isTonal2 ? 'block' : 'none';
    if (document.activeElement !== el('taxPctInput')) el('taxPctInput').value = vals.taxPctLabel;
    syncDiscountModeUI(vals);
    const discountDisplayValue = vals.discountMode === 'dollar' ? vals.discountDollar : vals.discountPct;
    if (document.activeElement !== el('discountValueInput')) el('discountValueInput').value = discountDisplayValue;
    if (document.activeElement !== el('discountRange')) el('discountRange').value = discountDisplayValue;
    renderSummaryRows('summaryListPrice', vals.summary);
    el('allInTotalPrice').textContent = vals.allInLabel;
    el('tonal1Compare').style.display = vals.isTonal1 ? 'block' : 'none';

    // ---- compare screen: tabs ----
    el('memTabBtn').style.background = vals.isMembershipTab ? '#51dea2' : 'transparent';
    el('memTabBtn').style.color = vals.isMembershipTab ? '#051512' : '#86948a';
    el('hgTabBtn').style.background = vals.isHomeGymTab ? '#51dea2' : 'transparent';
    el('hgTabBtn').style.color = vals.isHomeGymTab ? '#051512' : '#86948a';
    el('membershipTab').style.display = vals.isMembershipTab ? 'flex' : 'none';
    el('homeGymTab').style.display = vals.isHomeGymTab ? 'flex' : 'none';

    // ---- compare screen: membership tab ----
    el('membershipLabel').textContent = vals.membershipLabel;
    el('householdLabel').textContent = vals.householdLabel;
    renderHouseholdList(vals);
    renderCompareColumns(vals);
    const callout = el('memSavesCallout');
    callout.style.background = vals.memSavesCalloutBg;
    callout.style.border = '1px solid ' + vals.memSavesCalloutBorder;
    el('memSavesLabel').style.color = vals.memSavesColor;
    el('memSavesLabel').textContent = vals.memSavesLabel;
    el('memSavesCopy').textContent = vals.memSavesCopy;

    // ---- compare screen: home gym tab ----
    renderHomeGymBars(vals);

    // ---- send screen ----
    el('recapTrainerName').textContent = vals.trainerName;
    el('recapAllIn').textContent = vals.allInLabel;
    renderSendSummaryRows('summaryListSend', vals.summary);
    updateEmailDependent(vals);

    el('notSentPanel').style.display = state.sent ? 'none' : 'flex';
    el('sentPanel').style.display = state.sent ? 'flex' : 'none';
    el('sentTrainerName').textContent = vals.trainerName;
    el('sentEmail').textContent = vals.email;
  }

  function updateEmailDependent(vals) {
    el('emailWrap').style.border = '1px solid ' + (vals.emailValid ? 'rgba(81,222,162,.4)' : 'rgba(134,148,138,.2)');
    const btn = el('sendBtn');
    btn.disabled = !vals.emailValid;
    btn.style.background = vals.emailValid ? '#51dea2' : '#2b3a33';
    btn.style.opacity = vals.emailValid ? '1' : '0.5';
  }

  function updateTaxDependent() {
    // lightweight patch used while dragging/typing the tax & discount
    // controls so the focused input node is never replaced mid-edit
    const vals = computeVals();
    if (document.activeElement !== el('taxPctInput')) el('taxPctInput').value = vals.taxPctLabel;
    const discountDisplayValue = vals.discountMode === 'dollar' ? vals.discountDollar : vals.discountPct;
    if (document.activeElement !== el('discountValueInput')) el('discountValueInput').value = discountDisplayValue;
    if (document.activeElement !== el('discountRange')) el('discountRange').value = discountDisplayValue;
    el('allInHero').textContent = vals.allInLabel;
    el('allInTotalPrice').textContent = vals.allInLabel;
    renderSummaryRows('summaryListPrice', vals.summary);
    renderSendSummaryRows('summaryListSend', vals.summary);
    el('recapAllIn').textContent = vals.allInLabel;
    renderHomeGymBars(vals);
  }

  // ---- event wiring ----
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const value = btn.dataset.value;
    switch (action) {
      case 'goPrice': setState({ step: 0 }); break;
      case 'goCompare': setState({ step: 1 }); break;
      case 'goSend': setState({ step: 2 }); break;
      case 'switchTrainer': setState({ trainer: state.trainer === 'tonal2' ? 'tonal1' : 'tonal2' }); break;
      case 'selectBundle': setState({ bundle: value }); break;
      case 'selectShipping': setState({ shipping: value }); break;
      case 'selectWarranty': setState({ warranty: value }); break;
      case 'setDiscountModePct': setState({ discountMode: 'pct' }); break;
      case 'setDiscountModeDollar': setState({ discountMode: 'dollar' }); break;
      case 'selectHousehold': setState({ household: parseInt(value, 10) }); break;
      case 'setMembershipTab': setState({ compareTab: 'membership' }); break;
      case 'setHomeGymTab': setState({ compareTab: 'homeGym' }); break;
      case 'sendQuote': {
        const vals = computeVals();
        if (vals.emailValid) {
          const quoteLines = vals.summary.map((r) => r.label + ': ' + r.value).join(' + ');
          logQuoteToSheet(state.email.trim(), quoteLines, vals.allInLabel);
          setState({ sent: true });
        }
        break;
      }
      case 'restart': setState({ step: 0, sent: false, email: '' }); el('emailInput').value = ''; break;
    }
  });

  el('taxPctInput').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    state.taxPct = Math.max(0, isNaN(v) ? 0 : v);
    updateTaxDependent();
  });

  el('discountRange').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value) || 0;
    if (state.discountMode === 'dollar') state.discountDollar = v;
    else state.discountPct = v;
    updateTaxDependent();
  });

  el('discountValueInput').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    const clean = Math.max(0, isNaN(v) ? 0 : v);
    if (state.discountMode === 'dollar') state.discountDollar = clean;
    else state.discountPct = clean;
    updateTaxDependent();
  });

  el('emailInput').addEventListener('input', (e) => {
    state.email = e.target.value;
    updateEmailDependent(computeVals());
  });

  renderFull();
})();
