// scripts/cdp-drive.mjs — minimal CDP driver for the debug Chrome (port 9222).
// Usage: node scripts/cdp-drive.mjs <name> [...]
//   open <url>            — new tab, return its target id
//   nav <targetIdx> <url> — navigate tab to url
//   text <targetIdx>      — print document.body.innerText (waits for SPA)
//   tabs                  — list targets
//   eval <targetIdx> <js> — evaluate JS, print result

const CDP = "http://127.0.0.1:9222";
const [, , cmd, ...args] = process.argv;

async function targets() {
  const r = await fetch(`${CDP}/json/list`);
  return r.json();
}

/** Attach to a target and run CDP calls over its websocket. */
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
    const waiters = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve: rs, reject: rj } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rj(new Error(JSON.stringify(msg.error))) : rs(msg.result);
      } else if (msg.method) {
        for (let i = waiters.length - 1; i >= 0; i--) {
          if (waiters[i].match(msg)) {
            waiters[i].resolve(msg);
            waiters.splice(i, 1);
          }
        }
        events.push(msg);
      }
    };
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((rs, rj) => {
            const mid = ++id;
            pending.set(mid, { resolve: rs, reject: rj });
            ws.send(JSON.stringify({ id: mid, method, params }));
          }),
        waitFor: (match, timeoutMs = 20000) =>
          new Promise((rs, rj) => {
            waiters.push({ match, resolve: rs });
            setTimeout(() => rj(new Error("waitFor timeout")), timeoutMs);
          }),
        close: () => ws.close(),
      });
    ws.onerror = reject;
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageText(t) {
  const c = await attach(t.webSocketDebuggerUrl);
  try {
    await c.send("Runtime.enable");
    await sleep(2500); // let SPA settle
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = await c.send("Runtime.evaluate", {
        expression: "document.body ? document.body.innerText : ''",
        returnByValue: true,
      });
      const text = r.result.value || "";
      if (text.trim().length > 60) {
        console.log(`URL: ${t.url}\n----\n${text.slice(0, 4000)}`);
        return;
      }
      await sleep(2000);
    }
    console.log(`URL: ${t.url}\n----\n(page still empty after 6 polls)`);
  } finally {
    c.close();
  }
}

switch (cmd) {
  case "tabs": {
    const ts = await targets();
    ts.forEach((t, i) => console.log(`${i}: [${t.type}] ${t.title.slice(0, 60)} | ${t.url.slice(0, 90)}`));
    break;
  }
  case "open": {
    const r = await fetch(`${CDP}/json/new?url=${encodeURIComponent(args[0])}`, { method: "PUT" });
    const t = await r.json();
    console.log(`opened target ${t.id} -> ${t.url}`);
    break;
  }
  case "close": {
    await fetch(`${CDP}/json/close/${args[0]}`);
    console.log("closed");
    break;
  }
  case "nav": {
    const ts = await targets();
    const t = ts[Number(args[0])];
    const c = await attach(t.webSocketDebuggerUrl);
    await c.send("Page.enable");
    await c.send("Page.navigate", { url: args[1] });
    console.log("navigating…");
    c.close();
    break;
  }
  case "text": {
    const ts = await targets();
    await pageText(ts[Number(args[0])]);
    break;
  }
  case "eval": {
    const ts = await targets();
    const t = ts[Number(args[0])];
    const c = await attach(t.webSocketDebuggerUrl);
    await c.send("Runtime.enable");
    const r = await c.send("Runtime.evaluate", { expression: args[1], returnByValue: true });
    console.log(JSON.stringify(r.result.value, null, 1).slice(0, 6000));
    c.close();
    break;
  }
  default:
    console.log("unknown cmd");
}
