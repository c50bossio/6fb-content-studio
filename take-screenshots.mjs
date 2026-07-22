import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(modulePath);
const appUrl = process.env.SIXFB_SCREENSHOT_URL || 'http://127.0.0.1:5173/';
const outputDir = path.resolve(process.env.SIXFB_SCREENSHOT_DIR || path.join(rootDir, 'out/qa/phase2'));
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = Number(process.env.SIXFB_CDP_PORT || 9333);
const widths = (process.env.SIXFB_SCREENSHOT_WIDTHS || '375,768,1440').split(',').map(Number);
const height = Number(process.env.SIXFB_SCREENSHOT_HEIGHT || 900);

const screens = [
  ['dashboard', 'Dashboard'],
  ['video-planner', 'Video Planner'],
  ['clips', 'Clips'],
  ['carousel', 'Carousel'],
  ['blog-writer', 'Blog Writer'],
  ['video-editor', 'Video Editor'],
  ['brand-and-brain', 'Brand & Brain'],
  ['analytics', 'Analytics'],
  ['scheduler', 'Scheduler'],
  ['settings', 'Settings'],
];

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.closedError = null;

    this.socket.on('error', error => {
      this.rejectPending(error instanceof Error ? error : new Error(String(error)));
    });
    this.socket.on('close', (code, reason) => {
      const detail = reason?.length ? `: ${String(reason)}` : '';
      this.rejectPending(new Error(`CDP socket closed (${code})${detail}`));
    });
  }

  rejectPending(error) {
    this.closedError ||= error;
    for (const waiter of this.pending.values()) waiter.reject(this.closedError);
    this.pending.clear();
  }

  async open() {
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = error => {
        cleanup();
        reject(error);
      };
      const onClose = (code, reason) => {
        cleanup();
        const detail = reason?.length ? `: ${String(reason)}` : '';
        reject(new Error(`CDP socket closed before opening (${code})${detail}`));
      };
      const cleanup = () => {
        this.socket.off('open', onOpen);
        this.socket.off('error', onError);
        this.socket.off('close', onClose);
      };
      this.socket.once('open', onOpen);
      this.socket.once('error', onError);
      this.socket.once('close', onClose);
    });
    this.socket.on('message', data => {
      let message;
      try {
        message = JSON.parse(String(data));
      } catch (error) {
        this.rejectPending(new Error(`Invalid CDP response: ${error instanceof Error ? error.message : String(error)}`));
        return;
      }
      if (message.id) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      } else {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      if (this.closedError) {
        reject(this.closedError);
        return;
      }
      if (this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error(`Cannot send CDP command ${method}: socket is not open`));
        return;
      }
      this.pending.set(id, { resolve, reject });
      try {
        this.socket.send(JSON.stringify({ id, method, params }), error => {
          if (!error) return;
          const waiter = this.pending.get(id);
          if (!waiter) return;
          this.pending.delete(id);
          waiter.reject(error);
        });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close() {
    this.rejectPending(new Error('CDP client closed'));
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForJson(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitForContent(client, expectedText, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ready = await evaluate(client, `document.readyState === 'complete' && document.body.innerText.replace(/\\s+/g, ' ').includes(${JSON.stringify(expectedText)})`);
    if (ready) return;
    await delay(100);
  }
  const diagnostic = await evaluate(client, `({ url: location.href, readyState: document.readyState, text: document.body?.innerText?.slice(0, 500) || '', html: document.body?.innerHTML?.slice(0, 500) || '' })`);
  throw new Error(`Timed out waiting for visible text: ${expectedText}\n${JSON.stringify(diagnostic, null, 2)}`);
}

async function setViewport(client, width) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
}

async function capture(client, filePath) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  await writeFile(filePath, Buffer.from(result.data, 'base64'));
}

async function clickScreen(client, label) {
  const clicked = await evaluate(client, `(() => {
    const label = ${JSON.stringify(label)};
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().includes(label));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Navigation button not found: ${label}`);
  await waitForContent(client, label === 'Clips' ? 'Clip Extractor' : label);
  await delay(250);
}

async function clickButton(client, label) {
  const clicked = await evaluate(client, `(() => {
    const label = ${JSON.stringify(label)};
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().replace(/\\s+/g, ' ') === label);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button not found: ${label}`);
  await delay(150);
}

async function setInputValue(client, selector, value) {
  const changed = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    return true;
  })()`);
  if (!changed) throw new Error(`Input not found: ${selector}`);
  await delay(100);
}

async function auditLayout(client) {
  return evaluate(client, `(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !element.closest('[aria-hidden="true"]') && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const descriptor = element => {
      const text = (
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.getAttribute('placeholder') ||
        ('value' in element && typeof element.value === 'string' ? element.value : '') ||
        element.textContent ||
        element.tagName
      ).trim().replace(/\\s+/g, ' ');
      return text.slice(0, 90);
    };
    const allowsHorizontalScroll = element => {
      for (let current = element.parentElement; current; current = current.parentElement) {
        const overflow = getComputedStyle(current).overflowX;
        if (overflow === 'auto' || overflow === 'scroll') return true;
      }
      return false;
    };
    const elements = [...document.querySelectorAll('body *')].filter(visible);
    const horizontalOverflow = elements.filter(element => {
      const rect = element.getBoundingClientRect();
      return (rect.left < -1 || rect.right > viewport.width + 1) && !allowsHorizontalScroll(element);
    }).slice(0, 30).map(element => ({ element: descriptor(element), rect: element.getBoundingClientRect().toJSON() }));
    const interactive = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')].filter(visible);
    const smallTargets = interactive.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).slice(0, 50).map(element => {
      const rect = element.getBoundingClientRect();
      return { element: descriptor(element), width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    const clippedLeaves = elements.filter(element => {
      const style = getComputedStyle(element);
      return !element.matches('input, textarea, select, button, a[href], [role="button"]') &&
        element.childElementCount === 0 &&
        (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) &&
        style.overflow !== 'visible';
    }).map(descriptor);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const measuredControlText = interactive.filter(element => {
      const style = getComputedStyle(element);
      const text = element instanceof HTMLSelectElement
        ? element.selectedOptions[0]?.text || ''
        : element instanceof HTMLInputElement
        ? element.value || element.placeholder
        : '';
      if (!text || !context) return false;
      context.font = style.font;
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const nativeSelectAllowance = element instanceof HTMLSelectElement ? 24 : 0;
      return context.measureText(text).width + horizontalPadding + nativeSelectAllowance > element.clientWidth + 1;
    }).map(descriptor);
    const clippedText = [...new Set([...clippedLeaves, ...measuredControlText])].slice(0, 30);
    return {
      viewport,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      bodyTextLength: document.body.innerText.trim().length,
      horizontalOverflow,
      smallTargets,
      clippedText,
      interactiveCount: interactive.length,
      errorOverlay: Boolean(document.querySelector('.vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]')),
    };
  })()`);
}

async function main() {
  try {
    await access(chromePath);
  } catch {
    throw new Error(`Chrome executable not found: ${chromePath}. Set CHROME_PATH to a Chromium-compatible browser executable.`);
  }
  await mkdir(outputDir, { recursive: true });
  const chromeProfile = await mkdtemp(path.join(tmpdir(), '6fb-visual-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErrors = '';
  chrome.stderr.on('data', chunk => { chromeErrors += String(chunk); });

  let client;
  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`, { method: 'PUT' });
    if (!targetResponse.ok) throw new Error(`Could not create Chrome target: ${targetResponse.status}`);
    const target = await targetResponse.json();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Network.enable'),
    ]);

    await waitForContent(client, 'Welcome to 6FB Content Studio');
    const report = { appUrl, height, widths, screens: {}, focus: {}, console: [], network: [] };

    for (const width of widths) {
      await setViewport(client, width);
      await delay(150);
      const dir = path.join(outputDir, String(width));
      await mkdir(dir, { recursive: true });
      report.screens[`${width}/setup`] = await auditLayout(client);
      await capture(client, path.join(dir, 'setup.png'));

      await clickButton(client, 'Get Started');
      await waitForContent(client, 'Connect Claude');
      await setInputValue(client, 'input[type="password"]', 'invalid-key');
      await evaluate(client, `document.querySelector('form')?.requestSubmit()`);
      await waitForContent(client, 'Claude keys start with');
      report.screens[`${width}/setup-error-focus`] = await auditLayout(client);
      await capture(client, path.join(dir, 'setup-error-focus.png'));
      await clickButton(client, 'Back');
      await waitForContent(client, 'Welcome to 6FB Content Studio');
    }

    await evaluate(client, `(() => {
      localStorage.setItem('contentStudio:setupComplete', 'true');
      localStorage.setItem('contentStudio:brandProfile', JSON.stringify({
        brandName: '6FB Mentorship', primaryColor: '#00C851', accentColor: '#ffffff',
        backgroundColor: '#0f0f0f', fontPreset: 'clean-pro', headlineFont: 'Space Grotesk',
        bodyFont: 'Inter', layoutStyle: 'bold', tone: 'professional', logoPath: null
      }));
      location.reload();
    })()`);
    await waitForContent(client, 'Dashboard');

    if (process.env.SIXFB_QA_INJECT_FAILURES === '1') {
      await evaluate(client, `(() => {
        console.error('6FB visual gate self-test console error');
        fetch('http://127.0.0.1:1/__6fb-visual-gate-missing__').catch(() => {});
        const button = document.createElement('button');
        button.textContent = 'Injected undersized target';
        button.style.cssText = 'position:fixed;left:0;top:0;overflow:hidden;z-index:99999';
        for (const property of ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height']) {
          button.style.setProperty(property, '10px', 'important');
        }
        document.body.appendChild(button);
      })()`);
      await delay(150);
    }

    for (const width of widths) {
      await setViewport(client, width);
      for (const [slug, label] of screens) {
        await clickScreen(client, label);
        const key = `${width}/${slug}`;
        report.screens[key] = await auditLayout(client);
        await capture(client, path.join(outputDir, String(width), `${slug}.png`));
      }

      await clickScreen(client, 'Scheduler');
      const hoverPoint = await evaluate(client, `(() => {
        const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().replace(/\\s+/g, ' ') === 'New Post');
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`);
      if (hoverPoint) {
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverPoint.x, y: hoverPoint.y });
        await delay(100);
        report.screens[`${width}/scheduler-hover`] = await auditLayout(client);
        await capture(client, path.join(outputDir, String(width), 'scheduler-hover.png'));
      }
      if (width === 375) {
        const openedFromFocus = await evaluate(client, `(() => {
          const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim().replace(/\\s+/g, ' ') === 'New Post');
          if (!button) return false;
          button.focus();
          button.click();
          return true;
        })()`);
        if (!openedFromFocus) throw new Error('Could not focus and open the Scheduler dialog');
      } else {
        await clickButton(client, 'New Post');
      }
      await waitForContent(client, 'Schedule Post');
      report.screens[`${width}/scheduler-modal`] = await auditLayout(client);
      await capture(client, path.join(outputDir, String(width), 'scheduler-modal.png'));
      if (width === 375) {
        const focusProof = await evaluate(client, `(() => {
          const dialog = document.querySelector('[role="dialog"][aria-labelledby="schedule-post-title"]');
          const root = document.getElementById('root');
          if (!(dialog instanceof HTMLElement)) return { error: 'Scheduler dialog not found' };
          const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(element => element instanceof HTMLElement && element.getClientRects().length > 0);
          const entered = document.activeElement === dialog;
          const backgroundInert = Boolean(root?.hasAttribute('inert'));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          last?.focus();
          last?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
          const tabWrapped = document.activeElement === first;
          first?.focus();
          first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
          const shiftTabWrapped = document.activeElement === last;
          document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          return { entered, backgroundInert, tabWrapped, shiftTabWrapped, focusableCount: focusable.length };
        })()`);
        await delay(150);
        const closeProof = await evaluate(client, `(() => {
          const active = document.activeElement;
          return {
            closed: !document.querySelector('[role="dialog"][aria-labelledby="schedule-post-title"]'),
            backgroundRestored: !document.getElementById('root')?.hasAttribute('inert'),
            openerRestored: active instanceof HTMLButtonElement && active.textContent?.trim().replace(/\\s+/g, ' ') === 'New Post',
          };
        })()`);
        report.focus['375/scheduler-modal'] = { ...focusProof, ...closeProof };
        if (Object.entries(report.focus['375/scheduler-modal']).some(([key, value]) => key !== 'focusableCount' && value !== true) || focusProof.focusableCount < 1) {
          throw new Error(`Scheduler focus contract failed: ${JSON.stringify(report.focus['375/scheduler-modal'])}`);
        }
      } else {
        await clickButton(client, 'Cancel');
      }

      await clickScreen(client, 'Video Planner');
      await evaluate(client, `window.electronAPI.generateVideoPlan = () => new Promise(() => {})`);
      await setInputValue(client, 'input[placeholder^="e.g. Build a loyal"]', 'How to build a loyal barber clientele');
      await clickButton(client, 'Generate Shoot Plan');
      await waitForContent(client, 'Building shoot plan...');
      report.screens[`${width}/planner-loading`] = await auditLayout(client);
      await capture(client, path.join(outputDir, String(width), 'planner-loading.png'));

      if (width < 1024) {
        await evaluate(client, `(() => {
          const trigger = document.querySelector('button[aria-label="Open navigation"]');
          if (!(trigger instanceof HTMLButtonElement)) return false;
          if (${width} === 375) trigger.focus();
          trigger.click();
          return true;
        })()`);
        await delay(300);
        report.screens[`${width}/navigation-open`] = await auditLayout(client);
        await capture(client, path.join(outputDir, String(width), 'navigation-open.png'));
        if (width === 375) {
          const focusProof = await evaluate(client, `(() => {
            const drawer = document.querySelector('[role="dialog"][aria-label="Navigation"]');
            const root = document.getElementById('root');
            if (!(drawer instanceof HTMLElement)) return { error: 'Navigation drawer not found' };
            const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
              .filter(element => element instanceof HTMLElement && element.getClientRects().length > 0);
            const entered = document.activeElement === drawer;
            const backgroundInert = Boolean(root?.hasAttribute('inert'));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            last?.focus();
            last?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            const tabWrapped = document.activeElement === first;
            first?.focus();
            first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
            const shiftTabWrapped = document.activeElement === last;
            document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            return { entered, backgroundInert, tabWrapped, shiftTabWrapped, focusableCount: focusable.length };
          })()`);
          await delay(150);
          const closeProof = await evaluate(client, `(() => ({
            closed: document.querySelector('[role="dialog"][aria-label="Navigation"]')?.closest('[aria-hidden="true"]') !== null,
            backgroundRestored: !document.getElementById('root')?.hasAttribute('inert'),
            openerRestored: document.activeElement === document.querySelector('button[aria-label="Open navigation"]'),
          }))()`);
          report.focus['375/navigation-drawer'] = { ...focusProof, ...closeProof };
          if (Object.entries(report.focus['375/navigation-drawer']).some(([key, value]) => key !== 'focusableCount' && value !== true) || focusProof.focusableCount < 1) {
            throw new Error(`Navigation focus contract failed: ${JSON.stringify(report.focus['375/navigation-drawer'])}`);
          }
        } else {
          await evaluate(client, `document.querySelector('button[aria-label="Close navigation"]')?.click()`);
        }
      }
    }

    report.console = client.events.flatMap(event => {
      if (event.method === 'Runtime.exceptionThrown') {
        return [{
          method: event.method,
          text: event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || '',
          level: 'error',
          url: event.params?.exceptionDetails?.url || '',
        }];
      }
      if (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error') {
        const text = (event.params.args || []).map(argument => argument.value ?? argument.description ?? '').join(' ');
        return [{ method: event.method, text, level: 'error', url: '' }];
      }
      if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') {
        return [{
          method: event.method,
          text: event.params.entry.text || '',
          level: event.params.entry.level,
          url: event.params.entry.url || '',
        }];
      }
      return [];
    });
    const requestUrls = new Map();
    for (const event of client.events) {
      if (event.method === 'Network.requestWillBeSent') {
        requestUrls.set(event.params?.requestId, event.params?.request?.url || '');
      }
    }
    report.network = client.events.flatMap(event => {
      if (event.method === 'Network.loadingFailed' && !event.params?.canceled) {
        return [{
          method: event.method,
          url: requestUrls.get(event.params?.requestId) || '',
          error: event.params?.errorText || 'Network request failed',
        }];
      }
      if (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400) {
        return [{
          method: event.method,
          url: event.params.response.url || '',
          status: event.params.response.status,
          error: event.params.response.statusText || `HTTP ${event.params.response.status}`,
        }];
      }
      return [];
    });
    await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

    const failures = Object.entries(report.screens).filter(([, result]) => (
      result.errorOverlay ||
      result.horizontalOverflow.length > 0 ||
      result.smallTargets.length > 0 ||
      result.clippedText.length > 0
    ));
    console.log(JSON.stringify({
      outputDir,
      captured: Object.keys(report.screens).length,
      consoleErrors: report.console.length,
      networkErrors: report.network.length,
      screensWithFindings: failures.length,
      focusContracts: Object.keys(report.focus).length,
    }, null, 2));
    if (failures.length > 0 || report.console.length > 0 || report.network.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    client?.close();
    chrome.kill('SIGTERM');
    await delay(200);
    await rm(chromeProfile, { recursive: true, force: true });
    if (chrome.exitCode && chrome.exitCode !== 0) process.stderr.write(chromeErrors);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

export { CdpClient };
