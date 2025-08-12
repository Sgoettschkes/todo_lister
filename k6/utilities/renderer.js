import { parseHTML } from "k6/html";

/**
 * Renderer class for Phoenix LiveView diffs
 * Takes base HTML and applies diffs to maintain current state
 */
export default class Renderer {
  constructor(baseHTML) {
    this.html = baseHTML;
    this.components = {};
  }

  /**
   * Apply a diff to the current HTML
   * @param {Object} diff - The diff object from Phoenix LiveView WebSocket response
   */
  applyDiff(diff) {
    if (!diff || typeof diff !== "object") {
      return this.html;
    }

    // Handle full HTML replacement
    if (typeof diff === "string") {
      this.html = diff;
      return this.html;
    }

    // Extract components if present
    if (diff.c) {
      this.components = { ...this.components, ...diff.c };
      delete diff.c;
    }

    // Apply the diff recursively
    const doc = this.getParsedHTML();
    const rootElement = doc.find("[data-phx-main], [data-phx-view]").first();

    if (rootElement && rootElement.attr("id")) {
      const rootId = rootElement.attr("id");
      const updatedHTML = this._applyDiffToElement(this.html, rootId, diff);
      if (updatedHTML !== this.html) {
        this.html = updatedHTML;
      }
    } else {
      // If no root element found, try to apply diff directly
      this.html = this._mergeDiff(this.html, diff);
    }

    return this.html;
  }

  /**
   * Get the current HTML state
   * @returns {string} The current HTML
   */
  getParsedHTML() {
    return parseHTML(this.html);
  }

  extractLiveViewMetadata() {
    const doc = this.getParsedHTML();

    // Extract CSRF token
    const csrfMeta = doc.find('meta[name="csrf-token"]');
    const csrfToken = csrfMeta.attr("content");

    // Find the main LiveView element
    let liveViewElement = doc.find("[data-phx-main]").first();

    // If not found, try data-phx-view
    if (!liveViewElement || !liveViewElement.attr("id")) {
      liveViewElement = doc.find("[data-phx-view]").first();
    }

    // Extract LiveView attributes
    const phxId = liveViewElement.attr("id");
    const phxSession = liveViewElement.attr("data-phx-session");
    const phxStatic = liveViewElement.attr("data-phx-static");

    console.log(
      `Parsed LiveView: id=${phxId}, session=${phxSession ? "present" : "missing"}`,
    );

    return {
      csrfToken: csrfToken,
      phxId: phxId,
      phxSession: phxSession,
      phxStatic: phxStatic,
    };
  }

  /**
   * Apply diff to a specific element
   * @private
   */
  _applyDiffToElement(html, elementId, diff) {
    // Handle static content (s key means static replacement)
    if (diff.s !== undefined) {
      return this._replaceStaticContent(html, elementId, diff.s);
    }

    // Handle keyed updates
    if (diff.k) {
      return this._applyKeyedDiff(html, elementId, diff);
    }

    // Handle numbered indices (array-like updates)
    let updatedHTML = html;
    for (const key in diff) {
      if (key === "r" || key === "e" || key === "t") {
        continue; // Skip reply, events, and title
      }

      const value = diff[key];
      if (typeof value === "string" || typeof value === "number") {
        updatedHTML = this._updateChildAtIndex(
          updatedHTML,
          elementId,
          parseInt(key),
          value,
        );
      } else if (typeof value === "object" && value !== null) {
        // Recursively apply nested diffs
        updatedHTML = this._applyNestedDiff(updatedHTML, elementId, key, value);
      }
    }

    return updatedHTML;
  }

  /**
   * Replace static content
   * @private
   */
  _replaceStaticContent(html, elementId, content) {
    const doc = parseHTML(html);
    const element = elementId ? doc.find(`#${elementId}`).first() : doc.root();

    if (!element) {
      return html;
    }

    // Simple regex-based replacement for demonstration
    // In production, you'd want proper DOM manipulation
    const elementRegex = new RegExp(
      `(<[^>]*id="${elementId}"[^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`,
      "i",
    );
    const match = html.match(elementRegex);

    if (match) {
      const newContent = match[1] + this._renderContent(content) + match[3];
      return html.replace(match[0], newContent);
    }

    return html;
  }

  /**
   * Apply keyed diff for lists
   * @private
   */
  _applyKeyedDiff(html, elementId, diff) {
    // Handle keyed lists (used for streams and dynamic lists)
    // This is a simplified implementation
    let updatedHTML = html;

    if (diff.k && Array.isArray(diff.k)) {
      // k contains the keys in order
      // The diff object contains the actual content updates
      for (const key of diff.k) {
        if (diff[key] !== undefined) {
          updatedHTML = this._updateKeyedElement(
            updatedHTML,
            elementId,
            key,
            diff[key],
          );
        }
      }
    }

    return updatedHTML;
  }

  /**
   * Update a child element at a specific index
   * @private
   */
  _updateChildAtIndex(html, parentId, index, content) {
    // This is a simplified implementation
    // In a real scenario, you'd parse the DOM and update the specific child
    return html;
  }

  /**
   * Apply nested diff
   * @private
   */
  _applyNestedDiff(html, parentId, childKey, childDiff) {
    // Handle nested component or element updates
    if (childDiff.s !== undefined) {
      // Static content replacement
      return this._updateChildContent(html, parentId, childKey, childDiff.s);
    }

    // Recursively apply the diff
    return this._applyDiffToElement(html, `${parentId}_${childKey}`, childDiff);
  }

  /**
   * Update keyed element content
   * @private
   */
  _updateKeyedElement(html, parentId, key, content) {
    // Update specific keyed element
    // This would need proper DOM manipulation in production
    return html;
  }

  /**
   * Update child content
   * @private
   */
  _updateChildContent(html, parentId, childKey, content) {
    // Update specific child content
    // This would need proper DOM manipulation in production
    return html;
  }

  /**
   * Render content (handles various content types)
   * @private
   */
  _renderContent(content) {
    if (typeof content === "string") {
      return content;
    } else if (typeof content === "number") {
      return String(content);
    } else if (Array.isArray(content)) {
      return content.map((item) => this._renderContent(item)).join("");
    } else if (content && typeof content === "object") {
      // Handle component references
      if (content.d && this.components[content.d]) {
        return this._renderContent(this.components[content.d]);
      }
      // Handle static references
      if (content.s !== undefined) {
        return this._renderContent(content.s);
      }
    }
    return "";
  }

  /**
   * Simple diff merge for basic updates
   * @private
   */
  _mergeDiff(html, diff) {
    // This is a simplified merge that handles basic replacements
    // A full implementation would need proper DOM diffing
    if (typeof diff === "string") {
      return diff;
    }

    if (diff.s !== undefined) {
      return this._renderContent(diff.s);
    }

    // For complex diffs, return the current HTML unchanged
    // A real implementation would apply the diff properly
    return html;
  }
}
