import type { ToolCall, ToolResult } from "./types";

/** Tool definitions available to the model */
export const BROWSER_TOOLS = [
  {
    name: "navigate",
    description: "Open a URL in the browser",
    parameters: "url (string) - The full URL to navigate to",
  },
  {
    name: "read_page",
    description: "Read the visible text content of the current page",
    parameters: "none",
  },
  {
    name: "click",
    description: "Click on an element on the page",
    parameters: "selector (string) - CSS selector of the element to click",
  },
  {
    name: "type_text",
    description: "Type text into an input field on the page",
    parameters:
      'selector (string) - CSS selector of the input field, text (string) - The text to type',
  },
  {
    name: "scroll",
    description: "Scroll the page up or down",
    parameters: 'direction (string) - Either "up" or "down"',
  },
  {
    name: "get_page_info",
    description:
      "Get a list of interactive elements on the page (links, buttons, inputs)",
    parameters: "none",
  },
] as const;

/**
 * Build the system prompt that tells the model about available browser tools.
 * This is prepended as a user/assistant pair at the start of the conversation.
 */
export function buildToolSystemPrompt(): string {
  const toolList = BROWSER_TOOLS.map(
    (t, i) => `${i + 1}. ${t.name} - ${t.description}\n   Parameters: ${t.parameters}`,
  ).join("\n");

  return `You are a helpful AI assistant with access to browser tools. You can interact with web pages.

Available tools:
${toolList}

To use a tool, include exactly one tool call in your response using this format:
<tool_call>{"name": "tool_name", "arguments": {"param": "value"}}</tool_call>

Rules:
- Use ONE tool call per response when needed.
- Always briefly explain what you are about to do before the tool call.
- After receiving a tool result, describe what happened or what you see.
- If you don't need a tool, just respond normally.

Example:
User: Open example.com
Assistant: I'll open example.com for you.
<tool_call>{"name": "navigate", "arguments": {"url": "https://example.com"}}</tool_call>`;
}

/**
 * Parse model output text for a tool call.
 * Returns the text before the tool call and the parsed ToolCall (or null).
 */
export function parseToolCall(output: string): {
  textBefore: string;
  toolCall: ToolCall | null;
} {
  // Look for <tool_call>...</tool_call> pattern
  const tagMatch = output.match(
    /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/,
  );
  if (tagMatch) {
    const textBefore = output.slice(0, tagMatch.index).trim();
    try {
      const parsed = JSON.parse(tagMatch[1]);
      if (parsed.name && typeof parsed.name === "string") {
        return {
          textBefore,
          toolCall: {
            name: parsed.name,
            arguments: parsed.arguments ?? {},
          },
        };
      }
    } catch {
      // JSON parse failed, try to extract name/args manually
      const nameMatch = tagMatch[1].match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch) {
        const argsMatch = tagMatch[1].match(/"arguments"\s*:\s*(\{[^}]*\})/);
        let args: Record<string, string> = {};
        if (argsMatch) {
          try {
            args = JSON.parse(argsMatch[1]);
          } catch {
            // ignore
          }
        }
        return {
          textBefore,
          toolCall: { name: nameMatch[1], arguments: args },
        };
      }
    }
  }

  // Fallback: look for ```tool_code blocks (alternate Gemma format)
  const codeBlockMatch = output.match(
    /```tool_code\s*\n([\s\S]*?)\n```/,
  );
  if (codeBlockMatch) {
    const textBefore = output.slice(0, codeBlockMatch.index).trim();
    const code = codeBlockMatch[1].trim();
    // Try to parse as function call: tool_name(arg1="val1", arg2="val2")
    const funcMatch = code.match(/^(\w+)\((.*)\)$/s);
    if (funcMatch) {
      const name = funcMatch[1];
      const argsStr = funcMatch[2];
      const args: Record<string, string> = {};
      const argRegex = /(\w+)\s*=\s*"([^"]*)"/g;
      let m;
      while ((m = argRegex.exec(argsStr)) !== null) {
        args[m[1]] = m[2];
      }
      return { textBefore, toolCall: { name, arguments: args } };
    }
  }

  return { textBefore: output, toolCall: null };
}

/**
 * Format a tool result for inclusion in the model conversation.
 */
export function formatToolResult(result: ToolResult): string {
  return `<tool_result>${JSON.stringify(result)}</tool_result>`;
}

/**
 * Execute a tool call against the browser iframe.
 */
export function executeToolCall(
  toolCall: ToolCall,
  iframe: HTMLIFrameElement | null,
  setUrl: (url: string) => void,
): ToolResult {
  const fail = (msg: string): ToolResult => ({
    name: toolCall.name,
    result: msg,
    success: false,
  });

  const ok = (msg: string): ToolResult => ({
    name: toolCall.name,
    result: msg,
    success: true,
  });

  try {
    switch (toolCall.name) {
      case "navigate": {
        const url = toolCall.arguments.url;
        if (!url) return fail("Missing required parameter: url");
        // Ensure URL has protocol
        const fullUrl =
          url.startsWith("http://") || url.startsWith("https://")
            ? url
            : `https://${url}`;
        setUrl(fullUrl);
        if (iframe) iframe.src = fullUrl;
        return ok(`Navigated to ${fullUrl}`);
      }

      case "read_page": {
        if (!iframe) return fail("Browser not available");
        try {
          const doc = iframe.contentDocument;
          if (!doc) return fail("Cannot access page content (cross-origin restriction)");
          const text = doc.body?.innerText?.trim() ?? "";
          if (!text) return ok("Page is empty or still loading.");
          // Truncate to avoid overwhelming the model's context
          const truncated = text.length > 2000 ? text.slice(0, 2000) + "\n...(truncated)" : text;
          return ok(truncated);
        } catch {
          return fail(
            "Cannot read page content due to cross-origin restrictions. Try using a same-origin page like the built-in demo.",
          );
        }
      }

      case "click": {
        const selector = toolCall.arguments.selector;
        if (!selector) return fail("Missing required parameter: selector");
        if (!iframe) return fail("Browser not available");
        try {
          const doc = iframe.contentDocument;
          if (!doc) return fail("Cannot access page (cross-origin restriction)");
          const el = doc.querySelector(selector) as HTMLElement | null;
          if (!el) return fail(`Element not found: ${selector}`);
          el.click();
          return ok(`Clicked element: ${selector}`);
        } catch {
          return fail("Cannot interact with page due to cross-origin restrictions.");
        }
      }

      case "type_text": {
        const selector = toolCall.arguments.selector;
        const text = toolCall.arguments.text;
        if (!selector) return fail("Missing required parameter: selector");
        if (text === undefined) return fail("Missing required parameter: text");
        if (!iframe) return fail("Browser not available");
        try {
          const doc = iframe.contentDocument;
          if (!doc) return fail("Cannot access page (cross-origin restriction)");
          const el = doc.querySelector(selector) as HTMLInputElement | null;
          if (!el) return fail(`Element not found: ${selector}`);
          el.focus();
          el.value = text;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return ok(`Typed "${text}" into ${selector}`);
        } catch {
          return fail("Cannot interact with page due to cross-origin restrictions.");
        }
      }

      case "scroll": {
        const direction = toolCall.arguments.direction;
        if (!direction) return fail("Missing required parameter: direction");
        if (!iframe) return fail("Browser not available");
        try {
          const win = iframe.contentWindow;
          if (!win) return fail("Cannot access page (cross-origin restriction)");
          const amount = direction === "up" ? -400 : 400;
          win.scrollBy({ top: amount, behavior: "smooth" });
          return ok(`Scrolled ${direction}`);
        } catch {
          return fail("Cannot scroll page due to cross-origin restrictions.");
        }
      }

      case "get_page_info": {
        if (!iframe) return fail("Browser not available");
        try {
          const doc = iframe.contentDocument;
          if (!doc) return fail("Cannot access page (cross-origin restriction)");

          const elements: string[] = [];

          // Links
          doc.querySelectorAll("a[href]").forEach((el, i) => {
            if (i >= 15) return;
            const text = (el as HTMLElement).innerText?.trim().slice(0, 60);
            const href = (el as HTMLAnchorElement).href;
            if (text) elements.push(`Link: "${text}" (a[href="${href}"])`);
          });

          // Buttons
          doc.querySelectorAll("button").forEach((el, i) => {
            if (i >= 10) return;
            const text = (el as HTMLElement).innerText?.trim().slice(0, 60);
            const id = el.id ? `#${el.id}` : "";
            if (text) elements.push(`Button: "${text}" (button${id})`);
          });

          // Inputs
          doc.querySelectorAll("input, textarea, select").forEach((el, i) => {
            if (i >= 10) return;
            const input = el as HTMLInputElement;
            const id = input.id ? `#${input.id}` : "";
            const name = input.name ? `[name="${input.name}"]` : "";
            const type = input.type ? ` type="${input.type}"` : "";
            const placeholder = input.placeholder ? ` placeholder="${input.placeholder}"` : "";
            elements.push(
              `Input: ${el.tagName.toLowerCase()}${id}${name}${type}${placeholder}`,
            );
          });

          if (elements.length === 0) return ok("No interactive elements found on the page.");
          return ok("Interactive elements:\n" + elements.join("\n"));
        } catch {
          return fail("Cannot access page due to cross-origin restrictions.");
        }
      }

      default:
        return fail(`Unknown tool: ${toolCall.name}`);
    }
  } catch (e) {
    return fail(`Tool execution error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
