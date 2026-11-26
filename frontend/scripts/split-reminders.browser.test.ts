import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

// No DOM test package: use a real installed Chrome. CI must set CHROME_BIN.
const chrome = process.env.CHROME_BIN || Bun.which("google-chrome") || Bun.which("chromium");
test.skipIf(!chrome)("live reminder form: keyboard, retries, duplicate guard and list refresh", async () => {
  const profile = await mkdtemp(join(tmpdir(), "cashus-browser-"));
  const server = await createServer({ server: { port: 0 } });
  let browser: ReturnType<typeof Bun.spawn> | undefined;
  let socket: WebSocket | undefined;
  try {
    await server.listen();
    browser = Bun.spawn([chrome!, "--headless", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
    const startupErrors = new Response(browser.stderr).text();
    let port = "";
    for (let i = 0; i < 100; i++) {
      try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch {
        if (browser.exitCode !== null) break;
        await Bun.sleep(50);
      }
    }
    if (!port) {
      browser.kill();
      const code = await browser.exited;
      throw new Error(`Chrome did not start (exit ${code}): ${await startupErrors}`);
    }
    const targets = await (await fetch(`http://localhost:${port}/json`)).json();
    socket = new WebSocket(targets.find((target: { type: string }) => target.type === "page").webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = reject; });
    let id = 0;
    const pending = new Map<number, (result: any) => void>();
    socket.onmessage = (event) => { const result = JSON.parse(String(event.data)); pending.get(result.id)?.(result); pending.delete(result.id); };
    const command = (method: string, params = {}) => new Promise<any>((resolve, reject) => {
      const current = ++id;
      pending.set(current, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result));
      socket!.send(JSON.stringify({ id: current, method, params }));
    });
    const evaluate = async (expression: string) => {
      const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async (expression: string) => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await Bun.sleep(50); }
      throw new Error(`Timed out: ${expression}: ${await evaluate("JSON.stringify({requests: window.requests, body: document.body.innerText, value: document.querySelector('input')?.value})")}`);
    };
    const edit = async (value: string, field = "description") => {
      await evaluate(`{ const input = document.querySelector('[name=${field}]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }`);
    };
    const enter = async () => {
      await evaluate("document.querySelector('[name=description]').focus()");
      await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    };
    await command("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
    await command("Emulation.setLocaleOverride", { locale: "en-US" });
    await command("Page.navigate", { url: `${server.resolvedUrls!.local[0]}scripts/__fixtures__/split-reminders.html` });
    await wait("!!document.querySelector('[name=description]')");
    expect(await evaluate("document.querySelector('h1').textContent.trim()")).toBe("Test Friend");
    expect(await evaluate("document.querySelector('label[for=split-description]').control.name")).toBe("description");
    expect(await evaluate("document.querySelector('label[for=split-meal-date]').control.name")).toBe("mealDate");
    await edit("2026-07-04", "mealDate");
    await edit("Lunch");
    await enter();
    await wait("window.requests.length === 1 && !document.querySelector('fieldset').disabled");
    expect(await evaluate("document.querySelector('[name=description]').value")).toBe("Lunch");
    expect(await evaluate("document.querySelector('[name=mealDate]').value")).toBe("2026-07-04");
    expect(await evaluate("document.querySelector('[role=alert]').textContent.length > 0")).toBe(true);
    expect(await evaluate("window.requests[0].data.mealDate")).toBe("2026-07-03T15:00:00.000Z");
    expect(await evaluate("window.requests.every(request => !request.headers['idempotency-key'])")).toBe(true);
    await evaluate("window.failureStatus = 409");
    await command("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
    await enter();
    await wait("window.requests.length === 2 && !document.querySelector('fieldset').disabled");
    expect(await evaluate("window.requests[1].data.mealDate")).toBe("2026-07-03T15:00:00.000Z");
    expect(await evaluate("document.querySelector('[role=alert]').textContent")).toContain("This meal already has an open reminder.");
    await edit("Lunch   ");
    await enter();
    await wait("window.requests.length === 3 && !document.querySelector('fieldset').disabled");
    expect(await evaluate("window.requests[2].data.description")).toBe("Lunch");
    await edit("2026-07-05", "mealDate");
    await enter();
    await wait("window.requests.length === 4 && !document.querySelector('fieldset').disabled");
    expect(await evaluate("window.requests[3].data.mealDate")).toBe("2026-07-05T07:00:00.000Z");
    await command("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
    await edit("Dinner");
    await evaluate("window.hold = true; window.fail = false");
    await enter();
    await wait("window.requests.length === 5 && document.querySelector('fieldset').disabled");
    expect(await evaluate("[...document.querySelectorAll('fieldset input, fieldset button')].every(control => control.matches(':disabled'))")).toBe(true);
    // Even direct submit events cannot bypass the in-flight ref guard.
    await evaluate("document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))");
    expect(await evaluate("window.requests.length")).toBe(5);
    await evaluate("window.release()");
    await wait("!!document.querySelector('li') && document.querySelector('li').textContent.includes('Dinner')");
    expect(await evaluate("document.querySelector('time').dateTime")).toBe("2026-07-04T15:00:00.000Z");
    expect(await evaluate("document.querySelector('time').textContent")).toBe("7/5/2026");
    expect(await evaluate("document.querySelector('[name=description]').value")).toBe("");
    expect(await evaluate("document.body.textContent.includes('Split reminder sent.')")).toBe(true);
    expect(await evaluate("window.requests.every(request => !('idempotency-key' in request.headers))")).toBe(true);
  } finally {
    socket?.close();
    browser?.kill();
    if (browser) await browser.exited;
    await server.close();
    await rm(profile, { recursive: true, force: true });
  }
}, 30000);
