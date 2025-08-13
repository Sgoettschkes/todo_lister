#!/usr/bin/env node

// Simple test runner for the Rendered class
// This allows us to test the HTML generation in isolation

// Mock k6's parseHTML for Node.js environment
import { JSDOM } from "jsdom";

// Create a simple jQuery-like interface that mimics k6's parseHTML
function parseHTML(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  return {
    find: (selector) => {
      const elements = document.querySelectorAll(selector);
      return {
        first: () => {
          if (elements.length === 0) return null;
          const el = elements[0];
          return {
            attr: (name) => el.getAttribute(name),
            html: (content) => {
              if (content !== undefined) {
                el.innerHTML = content;
                return el;
              }
              return el.innerHTML;
            },
          };
        },
      };
    },
    html: () => dom.serialize(),
  };
}

// Import the Rendered class (no k6 dependency now)
import Rendered from "../utilities/rendered.js";

// Test data - sample HTML and diffs from actual k6 runs
const sampleInitialHTML = `<!DOCTYPE html>
<html>
<head>
    <title>TodoLister</title>
</head>
<body>
    <div id="phx-test" data-phx-main data-phx-session="test">
        <h1>New Todo List</h1>
        <div>Initial content</div>
    </div>
</body>
</html>`;

const sampleTitleEditDiff = {
  3: {
    0: ' value="New Todo List"',
    s: [
      '\n                <form phx-submit="save_title" class="w-full">\n                  <input type="text" name="title"',
      ' class="w-full bg-transparent border-0 outline-none focus:outline-none text-3xl font-bold cursor-pointer p-0 m-0 font-inherit leading-inherit" phx-blur="save_title">\n                </form>\n              ',
    ],
  },
};

const sampleTitleSaveDiff = {
  3: {
    s: [
      '\n                <h1 class="text-3xl font-bold">\n                  Updated Todo List via K6\n                </h1>\n              ',
    ],
  },
};

const sampleAddItemDiff = {
  5: {
    0: {
      k: {
        0: {
          0: ' data-item-id="test-item-id"',
          1: ' class="item-class"',
          s: [
            "\n              <div",
            '>\n                <input value="New task"',
            ">\n              </div>\n            ",
          ],
        },
        kc: 1,
      },
    },
    s: 4,
  },
};

// Simple assertion functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message || 'Expected condition to be false');
  }
}

// Simple test framework
function test(name, testFn) {
  try {
    testFn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

function countOccurrences(html, text) {
  return (html.match(new RegExp(text, "g")) || []).length;
}

// Tests
test("Initial rendering", () => {
  const rendered = new Rendered(sampleInitialHTML);
  const html = rendered.getFullHTML();

  // Should create a clean document template without the original content
  assertTrue(html.length > 100, "HTML should have reasonable length");
  assertFalse(html.includes("New Todo List"), "Should not contain original server-rendered content");
});

test("Title edit diff application", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply the title edit diff (shows form)
  const htmlAfterEdit = rendered.applyDiff(sampleTitleEditDiff);

  assertTrue(htmlAfterEdit.includes("<form"), "Should contain form after edit diff");
  assertEqual(countOccurrences(htmlAfterEdit, "New Todo List"), 1, "Should have exactly one occurrence of 'New Todo List'");
});

test("Title save diff application", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply edit then save
  rendered.applyDiff(sampleTitleEditDiff);
  const htmlAfterSave = rendered.applyDiff(sampleTitleSaveDiff);

  assertTrue(htmlAfterSave.includes("Updated Todo List via K6"), "Should contain updated title");
  assertEqual(countOccurrences(htmlAfterSave, "Updated Todo List via K6"), 1, "Should have exactly one occurrence of updated title");
});

test("Add item after title change", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply the full sequence: edit -> save -> add item
  rendered.applyDiff(sampleTitleEditDiff);
  rendered.applyDiff(sampleTitleSaveDiff);
  const htmlAfterAdd = rendered.applyDiff(sampleAddItemDiff);

  // The title should still be there and not duplicated
  assertEqual(countOccurrences(htmlAfterAdd, "Updated Todo List via K6"), 1, "Title should appear exactly once after adding item");
  
  // Should contain the new task input
  assertTrue(htmlAfterAdd.includes('New task'), "Should contain new task after add item diff");
});

test("Direct HTML generation", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Set up a rendered state manually
  rendered.rendered = {
    0: { s: ["<nav>", "</nav>"] },
    3: { s: ["<h1>Updated Todo List via K6</h1>"] },
    5: { s: ["<div>content</div>"] },
  };

  const generatedHTML = rendered.toHTML(rendered.rendered);
  assertTrue(generatedHTML.includes("<nav>"), "Should contain nav element");
  assertTrue(generatedHTML.includes("Updated Todo List via K6"), "Should contain title");
  assertTrue(generatedHTML.includes("<div>content</div>"), "Should contain content div");
  assertEqual(countOccurrences(generatedHTML, "Updated Todo List via K6"), 1, "Should have exactly one title in generated HTML");
});

test("No duplication in final HTML", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply full sequence
  rendered.applyDiff(sampleTitleEditDiff);
  rendered.applyDiff(sampleTitleSaveDiff);
  rendered.applyDiff(sampleAddItemDiff);
  
  const finalHTML = rendered.getFullHTML();
  
  // Critical test: no duplicated content
  assertEqual(countOccurrences(finalHTML, "Updated Todo List via K6"), 1, "Final HTML should have no duplicate titles");
  assertEqual(countOccurrences(finalHTML, "<body"), 1, "Should have exactly one body tag");
  assertEqual(countOccurrences(finalHTML, "</body>"), 1, "Should have exactly one closing body tag");
});

console.log("\n🔬 Testing Rendered class in isolation\n");
