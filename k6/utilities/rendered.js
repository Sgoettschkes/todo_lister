/**
 * Phoenix LiveView Renderer for K6
 *
 * This module handles the rendering and diff application for Phoenix LiveView
 * in a K6 testing environment. It maintains the current HTML state and applies
 * diffs received from the LiveView server.
 */

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

    // Extract viewId for identification
    this.viewId = this.extractViewId(initialHTML);
    
    // Store the full HTML document structure - but REMOVE existing LiveView content
    // The server-rendered HTML includes the initial LiveView content, but we want to 
    // replace it entirely with our own rendered content from diffs
    this.fullDocumentHTML = this.extractDocumentTemplate(initialHTML);

    // The rendered state - this is our single source of truth (like Phoenix LiveView)
    this.rendered = {};
    
    // Components state (like Phoenix LiveView)
    this.components = {};
  }

  /**
   * Extract document template without the LiveView content
   * This removes the server-rendered LiveView content, keeping only the document structure
   */
  extractDocumentTemplate(html) {
    // We need to extract the viewId first to find the container
    const viewId = this.extractViewIdFromHTML(html);
    if (!viewId) {
      return html;
    }
    
    // Find the LiveView container
    const containerStart = html.indexOf('<div id="' + viewId + '"');
    if (containerStart === -1) {
      // If we can't find the container, return the original HTML
      return html;
    }
    
    // Find the end of the opening tag
    const openTagEnd = html.indexOf('>', containerStart);
    if (openTagEnd === -1) {
      return html;
    }
    
    // Find the matching closing div tag by counting nested divs
    let depth = 1;
    let pos = openTagEnd + 1;
    let containerEnd = -1;
    
    while (pos < html.length && depth > 0) {
      const nextDiv = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);
      
      if (nextClose === -1) break;
      
      if (nextDiv !== -1 && nextDiv < nextClose) {
        depth++;
        pos = nextDiv + 4;
      } else {
        depth--;
        if (depth === 0) {
          containerEnd = nextClose;
          break;
        }
        pos = nextClose + 6;
      }
    }
    
    if (containerEnd === -1) {
      return html;
    }
    
    // Return the document with an empty LiveView container
    const before = html.substring(0, openTagEnd + 1);
    const after = html.substring(containerEnd);
    
    return before + after;
  }

  /**
   * Extract the LiveView element ID from HTML using string parsing
   */
  extractViewId(html) {
    return this.extractViewIdFromHTML(html);
  }

  /**
   * Extract ViewId from HTML - helper method
   */
  extractViewIdFromHTML(html) {
    // Look for data-phx-main first, then data-phx-view
    const mainMatch = html.match(/<div[^>]*data-phx-main[^>]*id="([^"]+)"/i);
    if (mainMatch) {
      return mainMatch[1];
    }

    const viewMatch = html.match(/<div[^>]*data-phx-view[^>]*id="([^"]+)"/i);
    if (viewMatch) {
      return viewMatch[1];
    }

    // Also try the reverse order (id before data-phx-*)
    const mainIdMatch = html.match(/<div[^>]*id="([^"]+)"[^>]*data-phx-main/i);
    if (mainIdMatch) {
      return mainIdMatch[1];
    }

    const viewIdMatch = html.match(/<div[^>]*id="([^"]+)"[^>]*data-phx-view/i);
    if (viewIdMatch) {
      return viewIdMatch[1];
    }

    return null;
  }

  /**
   * Apply a rendered response from the server (initial mount)
   */
  applyRendered(rendered) {
    if (!rendered) return this.getFullHTML();

    // Store the rendered tree - keep as tree structure
    this.rendered = rendered;

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

    // No HTML conversion here - keep everything as tree structure until getFullHTML()
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
   * Get the full HTML document with LiveView content updated
   * This is the ONLY place where we convert from tree structure to HTML
   */
  getFullHTML() {
    // Convert the rendered tree to HTML using Phoenix LiveView algorithm
    const liveViewHTML = this.toHTML(this.rendered);
    
    // Inject the LiveView HTML into the full document template
    return this.injectLiveViewContent(liveViewHTML);
  }

  /**
   * Inject LiveView content into the full document HTML template
   */
  injectLiveViewContent(liveViewHTML) {
    // The issue: we need to find the LiveView container and replace its ENTIRE content
    // But the previous regex was not handling nested divs correctly
    
    // First, let's find the LiveView container opening tag
    const containerStart = this.fullDocumentHTML.indexOf('<div id="' + this.viewId + '"');
    if (containerStart === -1) {
      // Fallback: return just the LiveView HTML if we can't find the container
      return liveViewHTML;
    }
    
    // Find the end of the opening tag
    const openTagEnd = this.fullDocumentHTML.indexOf('>', containerStart);
    if (openTagEnd === -1) {
      return liveViewHTML;
    }
    
    // Find the matching closing div tag by counting nested divs
    let depth = 1;
    let pos = openTagEnd + 1;
    let containerEnd = -1;
    
    while (pos < this.fullDocumentHTML.length && depth > 0) {
      const nextDiv = this.fullDocumentHTML.indexOf('<div', pos);
      const nextClose = this.fullDocumentHTML.indexOf('</div>', pos);
      
      if (nextClose === -1) break;
      
      if (nextDiv !== -1 && nextDiv < nextClose) {
        depth++;
        pos = nextDiv + 4;
      } else {
        depth--;
        if (depth === 0) {
          containerEnd = nextClose;
          break;
        }
        pos = nextClose + 6;
      }
    }
    
    if (containerEnd === -1) {
      return liveViewHTML;
    }
    
    // Replace the content between the opening and closing tags
    const before = this.fullDocumentHTML.substring(0, openTagEnd + 1);
    const after = this.fullDocumentHTML.substring(containerEnd);
    
    return before + liveViewHTML + after;
  }

  /**
   * Convert rendered tree to HTML - exactly matches Phoenix LiveView's to_iodata
   * This is the main entry point, equivalent to Phoenix's to_iodata/2
   */
  toHTML(rendered) {
    if (!rendered) return "";

    const components = this.components;
    const templates = rendered[TEMPLATES] || null;
    
    return this.toIOData(rendered, components, templates);
  }

  /**
   * Core rendering function - matches Phoenix's to_iodata/4
   */
  toIOData(rendered, components, templates) {
    // Handle string content (binary in Elixir)
    if (typeof rendered === "string") {
      return rendered;
    }

    // Handle component references (integer cid)
    if (typeof rendered === "number") {
      // In our case, treat numbers as template references
      return templates && templates[rendered] ? templates[rendered] : "";
    }

    // Handle keyed content with static - matches Phoenix's keyed pattern
    if (rendered[STATIC] !== undefined && rendered[KEYED] !== undefined) {
      return this.handleKeyedContent(rendered, components, templates);
    }

    // Handle regular static content - matches Phoenix's static pattern  
    if (rendered[STATIC] !== undefined) {
      return this.handleStaticContent(rendered, components, templates);
    }

    // Handle objects - recursively process each key
    if (this.isObject(rendered)) {
      let html = "";
      // Process in key order for consistent output
      const keys = Object.keys(rendered).sort((a, b) => {
        // Numeric keys first, then alphabetic
        const aNum = /^\d+$/.test(a);
        const bNum = /^\d+$/.test(b);
        if (aNum && bNum) return parseInt(a) - parseInt(b);
        if (aNum && !bNum) return -1;
        if (!aNum && bNum) return 1;
        return a.localeCompare(b);
      });

      for (const key of keys) {
        // Skip metadata keys
        if (key === COMPONENTS || key === TEMPLATES || key === EVENTS || 
            key === REPLY || key === TITLE || key === ROOT || key === "r" ||
            key === "t" || key === "s") {
          continue;
        }
        html += this.toIOData(rendered[key], components, templates);
      }
      return html;
    }

    // Handle arrays
    if (Array.isArray(rendered)) {
      return rendered.map(item => this.toIOData(item, components, templates)).join("");
    }

    return "";
  }

  /**
   * Handle keyed content - matches Phoenix's keyed pattern
   */
  handleKeyedContent(rendered, components, templates) {
    const keyedObj = rendered[KEYED];
    const staticTemplate = rendered[STATIC];
    const count = keyedObj[KEYED_COUNT] || 0;

    // If no keyed items, return empty (like Phoenix)
    if (!keyedObj || count === 0) {
      return "";
    }

    let html = "";
    for (let i = 0; i < count; i++) {
      if (keyedObj[i]) {
        // Create diff with static template applied to each keyed item
        const diff = { ...keyedObj[i] };
        diff[STATIC] = staticTemplate;
        html += this.toIOData(diff, components, templates);
      }
    }
    return html;
  }

  /**
   * Handle static content - matches Phoenix's static pattern
   */
  handleStaticContent(rendered, components, templates) {
    const staticRef = rendered[STATIC];
    const staticTemplate = this.templateStatic(staticRef, templates);

    if (Array.isArray(staticTemplate)) {
      // Use one_to_iodata algorithm for template interleaving
      return this.oneToIOData(staticTemplate, rendered, 0, [], components, templates);
    }

    return staticTemplate || "";
  }

  /**
   * Interleave static template with dynamic content - matches Phoenix's one_to_iodata
   */
  oneToIOData(staticParts, rendered, counter, acc, components, templates) {
    if (staticParts.length === 0) {
      return acc.join("");
    }

    // Last static part (no more dynamics)
    if (staticParts.length === 1) {
      acc.push(staticParts[0]);
      return acc.join("");
    }

    // Process head + dynamic content + recurse on tail
    const [head, ...tail] = staticParts;
    acc.push(head);

    // Add dynamic content at this position
    if (rendered[counter] !== undefined) {
      const dynamicHTML = this.toIOData(rendered[counter], components, templates);
      acc.push(dynamicHTML);
    }

    return this.oneToIOData(tail, rendered, counter + 1, acc, components, templates);
  }

  /**
   * Resolve template references - matches Phoenix's template_static
   */
  templateStatic(staticRef, templates) {
    if (typeof staticRef === "number" && templates) {
      return templates[staticRef] || "";
    }
    if (Array.isArray(staticRef)) {
      return staticRef;
    }
    return staticRef;
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
   * Mutable merge for applying diffs - follows Phoenix LiveView deep_merge_diff exactly
   */
  mutableMerge(target, source) {
    if (!source) return target;
    if (!target) return source;

    // Handle template resolution first (like Phoenix LiveView)
    if (source[TEMPLATES]) {
      const template = source[TEMPLATES];
      const sourceWithoutTemplate = { ...source };
      delete sourceWithoutTemplate[TEMPLATES];
      const resolvedSource = this.resolveTemplates(sourceWithoutTemplate, template);
      return this.mutableMerge(target, resolvedSource);
    }

    // Key rule from Phoenix: if source has static key, it completely replaces target
    if (source[STATIC] !== undefined) {
      return source;
    }

    // Handle keyed content (special Phoenix LiveView logic)
    if (source[KEYED]) {
      const result = { ...target };
      this.mergeKeyed(result, source);
      return result;
    }

    // For objects, merge recursively (like Phoenix LiveView Map.merge with deep_merge_diff)
    if (this.isObject(target) && this.isObject(source)) {
      const result = { ...target };
      for (const key in source) {
        result[key] = this.mutableMerge(target[key], source[key]);
      }
      return result;
    }

    // For non-objects, source wins
    return source;
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
          target[KEYED][i] = this.mutableMerge(
            this.clone(clonedTarget[KEYED][oldIdx]),
            diff
          );
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
        target[KEYED][i] = this.mutableMerge(target[KEYED][i], entry);
      }
    });

    // When keyed content is added, we need to clear old static content
    // This prevents showing both old static content and new keyed content
    if (target[KEYED] && Object.keys(target[KEYED]).length > 0) {
      // Remove static template references that would show empty state
      if (typeof target[STATIC] === "number") {
        delete target[STATIC];
      }
      if (typeof target["s"] === "number") {
        delete target["s"];
      }
      
      // If 's' is an array with template references, we need to be more careful
      // Only clear if the diff provided a complete replacement
      if (Array.isArray(target["s"]) && source["s"] && Array.isArray(source["s"])) {
        target["s"] = source["s"]; // Use the new template structure from diff
      }
    }

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


}
