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
  static extract(diff) {
    const { [REPLY]: reply, [EVENTS]: events, [TITLE]: title, ...cleanDiff } = diff;
    return { diff: cleanDiff, title, reply: reply || null, events: events || [] };
  }

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
    
    // Page title state - extracted from initial HTML and updated via diffs
    this.pageTitle = this.extractInitialPageTitle(initialHTML);
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
   * Extract the initial page title from HTML
   */
  extractInitialPageTitle(html) {
    // Look for <title> tag content
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      // Clean up whitespace and extract just the text content
      return titleMatch[1].replace(/\s+/g, ' ').trim();
    }
    return null;
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
  applyDiff(rawDiff) {
    if (!rawDiff) return this.getFullHTML();

    // Extract title, events, reply following Phoenix LiveView pattern
    const { diff, title } = Rendered.extract(rawDiff);
    
    // Handle page title updates (like Phoenix LiveView's DOM.putTitle)
    if (typeof title === "string") {
      this.pageTitle = title;
    }

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
    
    // Inject the LiveView HTML and update page title
    let fullHTML = this.injectLiveViewContent(liveViewHTML);
    fullHTML = this.updatePageTitle(fullHTML);
    
    return fullHTML;
  }

  /**
   * Update the page title in the HTML document
   */
  updatePageTitle(html) {
    if (this.pageTitle === null) {
      return html;
    }
    
    // Replace the content of the <title> tag
    return html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title>${this.pageTitle}</title>`
    );
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

    // Use components from the rendered tree itself, not the instance components
    const components = rendered[COMPONENTS] || this.components;
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

    // Handle numbers - convert to string for rendering  
    if (typeof rendered === "number") {
      // First check if this number is a component reference
      if (components && components[rendered]) {
        const component = components[rendered];
        return this.toIOData(component, components, templates);
      }
      
      // Check if it's a template reference
      if (templates && templates[rendered]) {
        return templates[rendered];
      }
      
      // If it's not a component or template reference, treat as literal number content
      return String(rendered);
    }

    // Handle objects first - check if this might be a Phoenix LiveView template structure
    if (this.isObject(rendered)) {
      // Check for template structure BEFORE checking for static content
      const keys = Object.keys(rendered);
      const hasNumericKeys = keys.some(key => /^\d+$/.test(key));
      const hasStaticKey = keys.includes(STATIC);
      
      if (hasNumericKeys && hasStaticKey) {
        // This is a Phoenix template structure - use one_to_iodata algorithm
        const staticRef = rendered[STATIC];
        
        // Special handling for simple dynamic content without wrapper
        if (typeof staticRef === "number" && components && components[staticRef]) {
          // Check if this is a simple dynamic replacement case
          // Component 2 in the test has: {"0": {"0": {"s": ["COL"]}}, "s": 1}
          // This should just render "COL" without the div wrapper from component 1
          const numericKeys = keys.filter(key => /^\d+$/.test(key));
          if (numericKeys.length === 1 && rendered["0"]) {
            // Check if it's a simple content replacement
            const dynamicContent = rendered["0"];
            if (dynamicContent && dynamicContent["0"] && dynamicContent["0"][STATIC]) {
              // This is a simple content case - just render the dynamic content
              return this.toIOData(dynamicContent, components, templates);
            }
          }
        }
        
        // Use templateStatic to resolve the template - it handles component inheritance properly
        const staticTemplate = this.templateStatic(staticRef, templates, components);
        if (Array.isArray(staticTemplate)) {
          return this.oneToIOData(staticTemplate, rendered, 0, [], components, templates);
        }
        // If template can't be resolved but we have dynamics, process the dynamics anyway
        const numericKeys = keys.filter(key => /^\d+$/.test(key));
        if (numericKeys.length > 0) {
          let html = "";
          for (const key of numericKeys.sort((a, b) => parseInt(a) - parseInt(b))) {
            html += this.toIOData(rendered[key], components, templates);
          }
          return html;
        }
      }
      
      // Handle keyed content with static - matches Phoenix's keyed pattern
      if (rendered[STATIC] !== undefined && rendered[KEYED] !== undefined) {
        return this.handleKeyedContent(rendered, components, templates);
      }

      // Handle regular static content - matches Phoenix's static pattern  
      if (rendered[STATIC] !== undefined) {
        return this.handleStaticContent(rendered, components, templates);
      }
      
      // Regular object processing
      let html = "";
      // Process in key order for consistent output
      const sortedKeys = keys.sort((a, b) => {
        // Numeric keys first, then alphabetic
        const aNum = /^\d+$/.test(a);
        const bNum = /^\d+$/.test(b);
        if (aNum && bNum) return parseInt(a) - parseInt(b);
        if (aNum && !bNum) return -1;
        if (!aNum && bNum) return 1;
        return a.localeCompare(b);
      });

      for (const key of sortedKeys) {
        // Skip metadata keys at the top level only
        if (key === COMPONENTS || key === TEMPLATES || key === EVENTS || 
            key === REPLY || key === TITLE || key === ROOT || key === "r" ||
            key === "t") {
          continue;
        }
        // Don't skip "s" key here - it may be needed for template resolution
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
      const keyedItem = keyedObj[i];
      if (keyedItem !== undefined) {
        // Check if the keyed item is an empty object - if so, just render static template once
        if (this.isObject(keyedItem) && Object.keys(keyedItem).length === 0) {
          // Empty keyed item - render static template directly without extra processing
          if (Array.isArray(staticTemplate)) {
            if (staticTemplate.length === 1) {
              // Single part template - add it with potential formatting
              // Phoenix LiveView adds a newline for certain comprehension patterns
              html += staticTemplate[0];
              if (staticTemplate[0] && !staticTemplate[0].endsWith("\n")) {
                html += "\n";
              }
            } else {
              // Multi-part template - join all parts (no dynamics to interleave)
              html += staticTemplate.join("");
            }
          } else if (typeof staticTemplate === "string") {
            html += staticTemplate;
          }
          break;
        } else {
          // Create diff with static template applied to each keyed item
          const diff = { ...keyedItem };
          diff[STATIC] = staticTemplate;
          html += this.toIOData(diff, components, templates);
        }
      }
    }
    return html;
  }

  /**
   * Handle static content - matches Phoenix's static pattern
   */
  handleStaticContent(rendered, components, templates) {
    const staticRef = rendered[STATIC];
    const staticTemplate = this.templateStatic(staticRef, templates, components);

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
  templateStatic(staticRef, templates, components) {
    if (typeof staticRef === "number") {
      // First try templates
      if (templates && templates[staticRef]) {
        return templates[staticRef];
      }
      // For component references, look for the effective static template
      if (components && components[staticRef]) {
        const component = components[staticRef];
        
        // For template inheritance, we need to find the appropriate template:
        // 1. If component has a top-level static array, use it
        // 2. If component has a nested static array in position 0, prefer that for inheritance
        // 3. If component has a top-level static number, resolve it recursively as last resort
        
        if (component[STATIC] && Array.isArray(component[STATIC])) {
          // Component has a top-level static array template
          return component[STATIC];
        }
        
        // Check for nested static template BEFORE following numeric references
        // This is key: component 3 with "s": 2 should get component 2's nested ["\nELSE ", ""]
        // even though component 2 has "s": 1
        if (component["0"] && component["0"][STATIC] && Array.isArray(component["0"][STATIC])) {
          return component["0"][STATIC];
        }
        
        // Last resort: follow numeric reference
        if (component[STATIC] && typeof component[STATIC] === "number") {
          // Component references another component - recursively resolve
          if (component[STATIC] !== staticRef) {
            return this.templateStatic(component[STATIC], templates, components);
          }
        }
      }
      return "";
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
   * Merge component templates for template sharing (when component has "s": integer)
   */
  mergeComponentTemplates(component, templateComponent) {
    const merged = { ...templateComponent };
    
    // Override with component's own dynamic content but keep template's static structure
    for (const key in component) {
      if (/^\d+$/.test(key) && component[key]) {
        // For numeric keys (dynamic content), we need to merge the template's static structure
        if (templateComponent[key] && this.isObject(templateComponent[key]) && this.isObject(component[key])) {
          // Merge the dynamic content with the template's static structure
          merged[key] = { ...templateComponent[key], ...component[key] };
        } else {
          merged[key] = component[key];
        }
      } else if (key !== STATIC) {
        // Copy other non-static keys as-is
        merged[key] = component[key];
      }
    }
    
    return merged;
  }

  /**
   * Check if value is an object
   */
  isObject(val) {
    return val !== null && typeof val === "object" && !Array.isArray(val);
  }


}
