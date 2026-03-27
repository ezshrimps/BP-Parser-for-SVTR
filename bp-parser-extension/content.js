// content.js - Feishu Form Filler v4
(function () {
  'use strict';

  // ── Get all field containers ──────────────────────────────────────────────
  function getAllFieldContainers() {
    const byId = [...document.querySelectorAll('[id^="field-item"]')];
    if (byId.length > 0) return byId;
    return [...document.querySelectorAll('[class*="field_wrapper"]')];
  }

  // ── Extract clean title from a container ─────────────────────────────────
  function getTitle(container) {
    const titleEl = container.querySelector('[class*="title_wrapper"]');
    if (!titleEl) return '';
    return titleEl.textContent.replace(/^[\s*\d.、]+/, '').trim();
  }

  // ── Fill contenteditable div ──────────────────────────────────────────────
  function fillContentEditable(container, value) {
    if (value === null || value === undefined) return false;
    const strVal = String(value);

    const editable = container.querySelector('[contenteditable="true"]');
    if (!editable) return false;

    editable.click();
    editable.focus();

    // Clear then insert via execCommand (React-compatible)
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, strVal);
      if (editable.textContent.trim() === strVal.trim()) {
        editable.blur();
        return true;
      }
    } catch (e) {}

    // Fallback: set innerHTML directly and fire input event
    editable.textContent = strVal;
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: strVal }));
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    editable.blur();
    return true;
  }

  // ── Click a radio / checkbox option by label text ─────────────────────────
  function clickOptionInContainer(container, optionText) {
    if (!optionText) return true;

    // Feishu select-list structure (confirmed from DOM inspection):
    //   div.base-component-select-list-editor-option   ← click target
    //     div.base-component-select-list-editor-icon-wrapper
    //     div.base-component-select-list-editor-text   ← contains label text
    const textEls = container.querySelectorAll('[class*="select-list-editor-text"]');
    for (const textEl of textEls) {
      if (textEl.textContent.trim() === optionText) {
        // Click the option wrapper (parent with "select-list-editor-option" class)
        const optionEl = textEl.closest('[class*="select-list-editor-option"]') || textEl.parentElement;
        optionEl.click();
        return true;
      }
    }

    // Fallback: generic deepest-text-match + click up the tree
    const all = [...container.querySelectorAll('*')];
    let best = null, bestDepth = -1;
    for (const el of all) {
      if (el.textContent.trim() === optionText) {
        let depth = 0, p = el;
        while (p && p !== container) { depth++; p = p.parentElement; }
        if (depth > bestDepth) { best = el; bestDepth = depth; }
      }
    }
    if (!best) return false;

    let el = best;
    for (let i = 0; i < 8 && el && el !== container; i++) {
      el.click();
      el = el.parentElement;
    }
    return true;
  }

  // ── Wait for form to render ───────────────────────────────────────────────
  function waitForForm(timeout = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (document.querySelectorAll('[id^="field-item"], [contenteditable="true"]').length > 0)
          return resolve();
        if (Date.now() - start > timeout)
          return reject(new Error('表单加载超时，请刷新后重试'));
        setTimeout(check, 300);
      };
      check();
    });
  }

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ── Main fill ─────────────────────────────────────────────────────────────
  async function fillForm(data) {
    await waitForForm();
    await delay(800);

    const containers = getAllFieldContainers();
    const filled = [], skipped = [], failed = [];

    for (const container of containers) {
      const title = getTitle(container);
      if (!title) continue;

      // 1. 身份类型 (radio)
      if (title.includes('身份类型')) {
        if (data.identity) {
          clickOptionInContainer(container, data.identity) ? filled.push('身份类型') : failed.push('身份类型');
        }

      // 2. 姓名
      } else if (title.includes('姓名')) {
        fillContentEditable(container, data.name) ? filled.push('姓名') : failed.push('姓名');

      // 3. 工作单位
      } else if (title.includes('工作单位')) {
        fillContentEditable(container, data.company) ? filled.push('工作单位') : failed.push('工作单位');

      // 4. 当前职务
      } else if (title.includes('当前职务')) {
        fillContentEditable(container, data.position) ? filled.push('当前职务') : failed.push('当前职务');

      // 5. 个人微信 — fill 'null' if not found in BP
      } else if (title.includes('微信')) {
        const val = (data.wechat && data.wechat !== '') ? data.wechat : 'null';
        fillContentEditable(container, val) ? filled.push('个人微信') : failed.push('个人微信');

      // 6. 所需服务 (checkbox)
      } else if (title.includes('所需服务')) {
        if (data.services && data.services.length > 0) {
          for (const svc of data.services) {
            clickOptionInContainer(container, svc) ? filled.push('服务:' + svc) : failed.push('服务:' + svc);
            await delay(150);
          }
        }

      // 7. 公司邮箱 — fill 'null' if not found in BP
      } else if (title.includes('邮箱')) {
        const val = (data.email && data.email !== '') ? data.email : 'null';
        fillContentEditable(container, val) ? filled.push('公司邮箱') : failed.push('公司邮箱');

      // 8. 项目名称
      } else if (title.includes('项目名称')) {
        if (data.projectName) {
          fillContentEditable(container, data.projectName) ? filled.push('项目名称') : failed.push('项目名称');
        }

      // 9. 公司介绍
      } else if (title.includes('公司介绍')) {
        if (data.companyIntro) {
          fillContentEditable(container, data.companyIntro) ? filled.push('公司介绍') : failed.push('公司介绍');
        }

      // 10. 管理团队
      } else if (title.includes('管理团队')) {
        if (data.team) {
          fillContentEditable(container, data.team) ? filled.push('管理团队') : failed.push('管理团队');
        }

      // 11. 主要诉求 (checkbox)
      } else if (title.includes('主要诉求')) {
        if (data.needs && data.needs.length > 0) {
          for (const need of data.needs) {
            clickOptionInContainer(container, need) ? filled.push('诉求:' + need) : failed.push('诉求:' + need);
            await delay(150);
          }
        }

      // 12. 云服务商 (checkbox)
      } else if (title.includes('云服务') || title.includes('云服务商')) {
        if (data.cloudServices && data.cloudServices.length > 0) {
          for (const cs of data.cloudServices) {
            clickOptionInContainer(container, cs) ? filled.push('云:' + cs) : failed.push('云:' + cs);
            await delay(150);
          }
        }

      // 13. 融资目标 (radio)
      } else if (title.includes('融资目标')) {
        if (data.fundingGoal) {
          clickOptionInContainer(container, data.fundingGoal) ? filled.push('融资目标') : failed.push('融资目标');
        }

      // 14. 补充材料 — browser security blocks file input
      } else if (title.includes('补充材料')) {
        skipped.push('补充材料（需手动上传）');

      // 15. 如何找到我们的 (radio)
      } else if (title.includes('如何找到')) {
        if (data.source) {
          clickOptionInContainer(container, data.source) ? filled.push('如何找到我们的') : failed.push('如何找到我们的');
        }

      // 16. 是否是SVTR会员 (radio)
      } else if (title.includes('SVTR会员') && !title.includes('了解')) {
        if (data.membership) {
          clickOptionInContainer(container, data.membership) ? filled.push('是否是SVTR会员') : failed.push('是否是SVTR会员');
        }

      // 17. 是否愿意了解SVTR会员 (radio)
      } else if (title.includes('了解') && (title.includes('SVTR') || title.includes('会员'))) {
        if (data.memberInterest) {
          clickOptionInContainer(container, data.memberInterest) ? filled.push('会员了解意向') : failed.push('会员了解意向');
        }
      }

      await delay(200);
    }

    return { filled, skipped, failed };
  }

  // ── Message listener ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ping') {
      sendResponse({ ready: true });
      return true;
    }

    if (message.type === 'fillForm') {
      fillForm(message.data)
        .then(({ filled, skipped, failed }) => {
          let warning = '';
          if (failed.length)  warning += `未填成功（请手动）：${failed.join('、')}。`;
          if (skipped.length) warning += `已跳过：${skipped.join('、')}。`;
          sendResponse({ success: true, warning: warning || null, filled });
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });
})();
