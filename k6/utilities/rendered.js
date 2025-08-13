/**
 * Phoenix LiveView Renderer for K6
 *
 * This module handles the rendering and diff application for Phoenix LiveView
 * in a K6 testing environment. It maintains the current HTML state and applies
 * diffs received from the LiveView server.
 */

import { parseHTML } from "k6/html";

// Constants from Phoenix LiveView
const COMPONENTS = "c";
const STATIC = "s";
const TEMPLATES = "p";
const DYNAMICS = "d";
const EVENTS = "e";
const REPLY = "r";
const TITLE = "t";
const STREAM = "stream";
const ROOT = "root";
const KEYED = "k";
const KEYED_COUNT = "kc";

export default class Rendered {
  constructor(initialHTML) {
    this.magicId = 0;
    this.parentViewId = "phx-test";

    // Parse initial HTML to extract the LiveView container
    const doc = parseHTML(initialHTML);
    const liveViewElement =
      doc.find("[data-phx-main]").first() ||
      doc.find("[data-phx-view]").first();

    if (!liveViewElement) {
      throw new Error("No LiveView element found in initial HTML");
    }

    // Store the full document as a persistent DOM tree that we'll update
    this.fullDocument = parseHTML(initialHTML);
    this.viewId = liveViewElement.attr("id");
    this.rendered = {};
    this.currentHTML = "";

    // Extract the inner HTML of the LiveView element as the initial content
    const viewHTML = liveViewElement.html();
    if (viewHTML) {
      // Store the initial HTML as our current HTML
      this.currentHTML = viewHTML;
    }
  }

  /**
   * Apply a rendered response from the server (initial mount)
   */
  applyRendered(rendered) {
    if (!rendered) return this.getFullHTML();

    // Store the rendered tree and convert to HTML
    this.rendered = rendered;
    this.currentHTML = this.toHTML(this.rendered);
    this.updateFullDocument();

    return this.getFullHTML();
  }

  /**
   * Apply a diff from the server
   */
  applyDiff(diff) {
    if (!diff) return this.getFullHTML();

    // Handle components separately if present
    if (diff[COMPONENTS]) {
      this.mergeComponents(diff);
    }

    // Phoenix LiveView template resolution: if diff contains templates, resolve them first
    let processedDiff = diff;
    if (diff[TEMPLATES]) {
      processedDiff = this.resolveTemplatesInDiff(diff);
    }

    // Merge the diff into our rendered state
    this.rendered = this.mutableMerge(this.rendered, processedDiff);

    // Re-render the HTML from the updated tree
    this.currentHTML = this.toHTML(this.rendered);

    this.updateFullDocument();
    return this.getFullHTML();
  }

  /**
   * Resolve templates in diff - implementation based on Phoenix.LiveViewTest.Diff.resolve_templates
   */
  resolveTemplatesInDiff(diff) {
    if (!diff[TEMPLATES]) {
      return diff;
    }

    const template = diff[TEMPLATES];
    const processedDiff = { ...diff };
    delete processedDiff[TEMPLATES];

    return this.resolveTemplates(processedDiff, template);
  }

  /**
   * Recursively resolve templates in rendered content
   */
  resolveTemplates(rendered, template) {
    if (!rendered || !template) {
      return rendered;
    }

    // Handle template reference in rendered content
    if (rendered[TEMPLATES]) {
      const nestedTemplate = rendered[TEMPLATES];
      const withoutTemplate = { ...rendered };
      delete withoutTemplate[TEMPLATES];
      return this.resolveTemplates(withoutTemplate, nestedTemplate);
    }

    // Handle static template reference
    if (rendered[STATIC] !== undefined && typeof rendered[STATIC] === "number") {
      const resolvedStatic = template[rendered[STATIC]];
      if (resolvedStatic !== undefined) {
        const resolved = { ...rendered };
        resolved[STATIC] = resolvedStatic;
        return this.resolveTemplates(resolved, template);
      }
    }

    // Handle object - recursively resolve all properties
    if (this.isObject(rendered)) {
      const resolved = {};
      for (const [key, value] of Object.entries(rendered)) {
        resolved[key] = this.resolveTemplates(value, template);
      }
      return resolved;
    }

    // Handle arrays
    if (Array.isArray(rendered)) {
      return rendered.map(item => this.resolveTemplates(item, template));
    }

    // Return primitive values as-is
    return rendered;
  }

  /**
   * Update the full document with the current LiveView content
   * Implements a robust DOM update mechanism that works with k6's HTML parsing limitations
   */
  updateFullDocument() {
    // Find the LiveView element in the full document
    const liveViewElement =
      this.fullDocument.find("[data-phx-main]").first() ||
      this.fullDocument.find("[data-phx-view]").first();

    if (!liveViewElement) {
      return;
    }

    // Method 1: Try direct HTML replacement (works for simple cases)
    liveViewElement.html(this.currentHTML);

    // Method 2: If direct replacement doesn't work, use string-based replacement
    // This handles cases where k6's DOM manipulation has limitations
    if (!this.fullDocument.html().includes(this.currentHTML.substring(0, 50))) {
      this.recreateFullDocument();
    }

    // Update the ID to match the current LiveView
    if (this.viewId && liveViewElement.attr("id") !== this.viewId) {
      liveViewElement.attr("id", this.viewId);
    }
  }

  /**
   * Recreate the full document by rebuilding it with the current HTML
   */
  recreateFullDocument() {
    // Get the current full HTML as string
    let fullHtml = this.fullDocument.html();

    // Find the LiveView container in the string and replace its content
    const liveViewRegex = /(<div[^>]*data-phx-main[^>]*>)(.*?)(<\/div>)/s;
    const match = fullHtml.match(liveViewRegex);

    if (match) {
      const [, openTag, , closeTag] = match;
      const updatedHtml = fullHtml.replace(
        liveViewRegex,
        openTag + this.currentHTML + closeTag,
      );

      // Parse the updated HTML and replace the full document
      this.fullDocument = parseHTML(updatedHtml);
    }
  }

  /**
   * Get the full HTML document with LiveView content updated
   */
  getFullHTML() {
    // Return the current state of the full document
    return this.fullDocument.html();
  }

  /**
   * Convert rendered tree to HTML string
   */
  toHTML(rendered, templates = null) {
    if (!rendered) return "";

    // Update templates from the rendered object if available
    if (rendered[TEMPLATES]) {
      templates = rendered[TEMPLATES];
    }

    // Handle string content
    if (typeof rendered === "string") {
      return rendered;
    }

    // Handle numeric template reference
    if (typeof rendered === "number") {
      return templates && templates[rendered] ? templates[rendered] : "";
    }

    // Handle keyed content (comprehensions)
    if (rendered[KEYED]) {
      let html = "";
      const keyedObj = rendered[KEYED];
      const count = keyedObj[KEYED_COUNT] || 0;

      for (let i = 0; i < count; i++) {
        if (keyedObj[i]) {
          html += this.toHTML(keyedObj[i], templates);
        }
      }
      return html;
    }

    // Handle static reference
    if (rendered[STATIC] !== undefined) {
      if (typeof rendered[STATIC] === "string") {
        return rendered[STATIC];
      }
      if (typeof rendered[STATIC] === "number" && templates) {
        const template = templates[rendered[STATIC]];
        if (Array.isArray(template)) {
          // Process template array with dynamics - this handles the interleaving
          return this.processTemplateArray(template, rendered, templates);
        }
        return template || "";
      }
      // If we have numeric keys along with static, we need to interleave
      if (this.hasNumericKeys(rendered)) {
        return this.processNumericObject(rendered, templates);
      }
      
      // Check if any numeric key has keyed content before processing static only
      for (const key in rendered) {
        if (/^\d+$/.test(key) && rendered[key] && rendered[key][KEYED]) {
          return this.processNumericObject(rendered, templates);
        }
      }
      
      return this.toHTML(rendered[STATIC], templates);
    }

    // Handle arrays
    if (Array.isArray(rendered)) {
      return rendered.map((part) => this.toHTML(part, templates)).join("");
    }

    // Handle objects with numeric keys (Phoenix LiveView format)
    if (this.hasNumericKeys(rendered)) {
      return this.processNumericObject(rendered, templates);
    }

    // Handle object with dynamics
    if (rendered[DYNAMICS] !== undefined) {
      return this.dynamicsToHTML(rendered, templates);
    }

    // Recursively process nested objects
    let html = "";
    for (const key in rendered) {
      if (
        key !== COMPONENTS &&
        key !== TEMPLATES &&
        key !== EVENTS &&
        key !== REPLY &&
        key !== TITLE &&
        key !== ROOT &&
        key !== "r"
      ) {
        html += this.toHTML(rendered[key], templates);
      }
    }

    return html;
  }

  /**
   * Process dynamics array with statics
   */
  dynamicsToHTML(rendered, templates) {
    const dynamics = rendered[DYNAMICS];
    const statics = rendered[STATIC] || [];
    let html = "";

    // Interleave statics and dynamics
    for (let i = 0; i < dynamics.length; i++) {
      if (statics[i]) {
        html += this.templateStatic(statics[i], templates);
      }
      html += this.toHTML(dynamics[i], templates);
    }

    // Add any remaining static
    if (statics[dynamics.length]) {
      html += this.templateStatic(statics[dynamics.length], templates);
    }

    return html;
  }

  /**
   * Resolve template static references
   */
  templateStatic(part, templates) {
    if (typeof part === "number" && templates) {
      return templates[part] || "";
    }
    return part || "";
  }

  /**
   * Merge components from diff
   */
  mergeComponents(diff) {
    const newc = diff[COMPONENTS];
    if (!newc) return;

    if (!this.rendered[COMPONENTS]) {
      this.rendered[COMPONENTS] = {};
    }

    const oldc = this.rendered[COMPONENTS];
    const cache = {};

    for (const cid in newc) {
      newc[cid] = this.cachedFindComponent(cid, newc[cid], oldc, newc, cache);
    }

    for (const cid in newc) {
      oldc[cid] = newc[cid];
    }

    diff[COMPONENTS] = newc;
  }

  /**
   * Find and cache component
   */
  cachedFindComponent(cid, cdiff, oldc, newc, cache) {
    if (cache[cid]) {
      return cache[cid];
    }

    let ndiff;
    const scid = cdiff[STATIC];

    if (typeof scid === "number") {
      let tdiff;
      if (scid > 0) {
        tdiff = this.cachedFindComponent(scid, newc[scid], oldc, newc, cache);
      } else {
        tdiff = oldc[-scid];
      }

      if (tdiff) {
        const stat = tdiff[STATIC];
        ndiff = this.cloneMerge(tdiff, cdiff, true);
        ndiff[STATIC] = stat;
      } else {
        ndiff = cdiff;
      }
    } else {
      ndiff =
        cdiff[STATIC] !== undefined || !oldc[cid]
          ? cdiff
          : this.cloneMerge(oldc[cid], cdiff, false);
    }

    cache[cid] = ndiff;
    return ndiff;
  }

  /**
   * Mutable merge for applying diffs
   */
  mutableMerge(target, source) {
    if (!source) return target;
    if (!target) return source;

    if (source[STATIC] !== undefined) {
      return source;
    }

    this.doMutableMerge(target, source);
    return target;
  }

  /**
   * Perform mutable merge
   */
  doMutableMerge(target, source) {
    if (source[KEYED]) {
      this.mergeKeyed(target, source);
      return;
    }

    for (const key in source) {
      const val = source[key];
      const targetVal = target[key];

      if (
        this.isObject(val) &&
        val[STATIC] === undefined &&
        this.isObject(targetVal)
      ) {
        this.doMutableMerge(targetVal, val);
      } else {
        target[key] = val;
      }
    }

    if (target[ROOT]) {
      target.newRender = true;
    }
  }

  /**
   * Merge keyed comprehensions
   */
  mergeKeyed(target, source) {
    if (!target[KEYED]) {
      target[KEYED] = {};
    }

    const clonedTarget = this.clone(target);

    Object.entries(source[KEYED]).forEach(([i, entry]) => {
      if (i === KEYED_COUNT) {
        target[KEYED][KEYED_COUNT] = entry;
        return;
      }

      if (Array.isArray(entry)) {
        // [old_idx, diff] - moved with diff
        const [oldIdx, diff] = entry;
        if (clonedTarget[KEYED] && clonedTarget[KEYED][oldIdx]) {
          target[KEYED][i] = this.clone(clonedTarget[KEYED][oldIdx]);
          this.doMutableMerge(target[KEYED][i], diff);
        }
      } else if (typeof entry === "number") {
        // moved without diff
        if (clonedTarget[KEYED] && clonedTarget[KEYED][entry]) {
          target[KEYED][i] = clonedTarget[KEYED][entry];
        }
      } else if (typeof entry === "object") {
        // diff, same position
        if (!target[KEYED][i]) {
          target[KEYED][i] = {};
        }
        this.doMutableMerge(target[KEYED][i], entry);
      }
    });

    // Copy stream and templates if present
    if (source[STREAM]) {
      target[STREAM] = source[STREAM];
    }
    if (source[TEMPLATES]) {
      target[TEMPLATES] = source[TEMPLATES];
    }
  }

  /**
   * Clone merge for components
   */
  cloneMerge(target, source, pruneMagicId) {
    const merged = { ...target, ...source };

    for (const key in merged) {
      const val = source[key];
      const targetVal = target[key];

      if (
        this.isObject(val) &&
        val[STATIC] === undefined &&
        this.isObject(targetVal)
      ) {
        merged[key] = this.cloneMerge(targetVal, val, pruneMagicId);
      } else if (val === undefined && this.isObject(targetVal)) {
        merged[key] = this.cloneMerge(targetVal, {}, pruneMagicId);
      }
    }

    if (pruneMagicId) {
      delete merged.magicId;
      delete merged.newRender;
    } else if (target[ROOT]) {
      merged.newRender = true;
    }

    return merged;
  }

  /**
   * Clone helper
   */
  clone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map((item) => this.clone(item));
    if (obj instanceof Object) {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.clone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  /**
   * Check if value is an object
   */
  isObject(val) {
    return val !== null && typeof val === "object" && !Array.isArray(val);
  }

  /**
   * Check if object has numeric keys (Phoenix LiveView format)
   */
  hasNumericKeys(obj) {
    if (!this.isObject(obj)) return false;
    const keys = Object.keys(obj);
    return keys.some((key) => /^\d+$/.test(key));
  }

  /**
   * Process object with numeric keys
   */
  processNumericObject(obj, templates) {
    // This should follow the Phoenix LiveView algorithm from one_to_iodata
    // We need to interleave static parts with dynamic parts

    const staticParts = obj[STATIC];
    if (!staticParts) {
      let html = "";
      const keys = Object.keys(obj)
        .filter((key) => /^\d+$/.test(key))
        .sort((a, b) => parseInt(a) - parseInt(b));

      for (const key of keys) {
        html += this.toHTML(obj[key], templates);
      }

      return html;
    }

    // Resolve static parts (could be array or template reference)
    const statics = this.templateStatic(staticParts, templates);
    if (!Array.isArray(statics)) {
      return "";
    }

    // Interleave static and dynamic parts
    let html = "";
    for (let i = 0; i < statics.length; i++) {
      if (i < statics.length - 1) {
        // Add static part
        html += statics[i];
        // Add corresponding dynamic part if it exists
        if (obj[i] !== undefined) {
          html += this.toHTML(obj[i], templates);
        }
      } else {
        // Last static part (no dynamic after it)
        html += statics[i];
      }
    }

    return html;
  }

  /**
   * Process template array with dynamics
   */
  processTemplateArray(templateArray, rendered, templates) {
    let html = "";

    for (let i = 0; i < templateArray.length; i++) {
      const part = templateArray[i];

      // Check if there's a dynamic value for this position
      if (rendered[i] !== undefined) {
        const dynamicHtml = this.toHTML(rendered[i], templates);
        html += dynamicHtml;
      } else {
        html += this.toHTML(part, templates);
      }
    }

    return html;
  }
}
