#!/usr/bin/env node

// Test suite for the Rendered class using Node.js built-in test runner
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// Import the Rendered class
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

// Helper function
function countOccurrences(html, text) {
  return (html.match(new RegExp(text, "g")) || []).length;
}

// Tests using Node.js built-in test runner

// ========================================
// Phoenix LiveView Compatibility Tests
// ========================================

test("Phoenix LiveView - subtrees chain", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Input from Phoenix LiveView test case
  const phoenixInput = {
    "0": {
      "k": {
        "0": {"0": "1", "1": 1},
        "1": {"0": "2", "1": 2}, 
        "2": {"0": "3", "1": 3},
        "kc": 3
      },
      "s": ["\n", ":", ""]
    },
    "c": {
      "1": {"0": {"0": "index_1", "s": ["\nIF ", ""]}, "s": ["", ""]},
      "2": {"0": {"0": "index_2", "s": ["\nELSE ", ""]}, "s": 1},
      "3": {"0": {"0": "index_3"}, "s": 2}
    },
    "s": ["<div>", "\n</div>"]
  };
  
  // Expected output from Phoenix LiveView
  const expectedOutput = `<div>
1:
IF index_1
2:
ELSE index_2
3:
ELSE index_3
</div>`;

  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match Phoenix LiveView subtrees chain output");
});

test("Phoenix LiveView - subtrees with comprehension replacement", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Input from Phoenix LiveView test case  
  const phoenixInput = {
    "0": 1,
    "1": 2,
    "c": {
      "1": {
        "0": {
          "0": {"k": {"0": {}, "1": {}, "2": {}, "kc": 3}, "s": ["ROW"]},
          "s": ["\n", ""]
        },
        "s": ["<div>", "</div>"]
      },
      "2": {
        "0": {
          "0": {"s": ["COL"]}
        },
        "s": 1
      }
    },
    "s": ["", "", "", ""]
  };
  
  // Expected output from Phoenix LiveView test 
  const expectedOutput = `<div>
ROW
</div>COL`;

  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match Phoenix LiveView subtrees with comprehension replacement output");
});

test("Phoenix LiveView - simple component rendering", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Simple component structure - one component with static template
  const phoenixInput = {
    "0": 1,
    "c": {
      "1": {
        "0": "Hello World",
        "s": ["<p>", "</p>"]
      }
    },
    "s": ["<div>", "</div>"]
  };
  
  const expectedOutput = `<div><p>Hello World</p></div>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match simple component rendering");
});

test("Phoenix LiveView - nested components", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Nested component structure 
  const phoenixInput = {
    "0": {
      "0": 1,
      "s": ["<div class=\"outer\">", "</div>"]
    },
    "c": {
      "1": {
        "0": "Inner Content",
        "s": ["<span>", "</span>"]
      }
    },
    "s": ["", ""]
  };
  
  const expectedOutput = `<div class="outer"><span>Inner Content</span></div>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match nested component rendering");
});

test("Phoenix LiveView - multiple dynamics with templates", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Multiple dynamic slots with template interleaving
  const phoenixInput = {
    "0": "First",
    "1": "Second", 
    "2": "Third",
    "s": ["<div>", " | ", " | ", "</div>"]
  };
  
  const expectedOutput = `<div>First | Second | Third</div>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match multiple dynamics with templates");
});

test("Phoenix LiveView - empty keyed comprehension", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Empty keyed comprehension - should render nothing
  const phoenixInput = {
    "0": {
      "k": {
        "kc": 0
      },
      "s": ["<li>", "</li>"]
    },
    "s": ["<ul>", "</ul>"]
  };
  
  const expectedOutput = `<ul></ul>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match empty keyed comprehension");
});

test("Phoenix LiveView - keyed comprehension with data", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Keyed comprehension with actual data
  const phoenixInput = {
    "0": {
      "k": {
        "0": {"0": "Item 1"},
        "1": {"0": "Item 2"},
        "2": {"0": "Item 3"},
        "kc": 3
      },
      "s": ["<li>", "</li>"]
    },
    "s": ["<ul>", "</ul>"]
  };
  
  const expectedOutput = `<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match keyed comprehension with data");
});

test("Phoenix LiveView - mixed content types", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Mix of strings, numbers, and components
  const phoenixInput = {
    "0": "Hello",
    "1": 42,
    "2": 1,
    "c": {
      "1": {
        "0": "Component Content",
        "s": ["<em>", "</em>"]
      }
    },
    "s": ["<div>", " - ", " - ", "</div>"]
  };
  
  const expectedOutput = `<div>Hello - 42 - <em>Component Content</em></div>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match mixed content types");
});

test("Phoenix LiveView - deeply nested structure", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Deeply nested structure with multiple levels
  const phoenixInput = {
    "0": {
      "0": {
        "0": "Deep Content",
        "s": ["<span>", "</span>"]
      },
      "s": ["<div class=\"inner\">", "</div>"]
    },
    "s": ["<div class=\"outer\">", "</div>"]
  };
  
  const expectedOutput = `<div class="outer"><div class="inner"><span>Deep Content</span></div></div>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match deeply nested structure");
});

test("Phoenix LiveView - empty string in template", () => {
  const rendered = new Rendered("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Test that empty strings in templates are properly handled
  const phoenixInput = {
    "0": "CONTENT",
    "s": ["\n", ""]  // Should render as \nCONTENT + empty string = \nCONTENT\n
  };
  
  const expectedOutput = `\nCONTENT`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should properly handle empty string in template");
});

// ========================================
// Original Tests
// ========================================

test("Initial rendering", () => {
  const rendered = new Rendered(sampleInitialHTML);
  const html = rendered.getFullHTML();

  // Should create a clean document template without the original content
  assert.ok(html.length > 100, "HTML should have reasonable length");
  assert.ok(!html.includes("New Todo List"), "Should not contain original server-rendered content");
});

test("Title edit diff application", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply the title edit diff (shows form)
  const htmlAfterEdit = rendered.applyDiff(sampleTitleEditDiff);

  assert.ok(htmlAfterEdit.includes("<form"), "Should contain form after edit diff");
  assert.strictEqual(countOccurrences(htmlAfterEdit, "New Todo List"), 1, "Should have exactly one occurrence of 'New Todo List'");
});

test("Title save diff application", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply edit then save
  rendered.applyDiff(sampleTitleEditDiff);
  const htmlAfterSave = rendered.applyDiff(sampleTitleSaveDiff);

  assert.ok(htmlAfterSave.includes("Updated Todo List via K6"), "Should contain updated title");
  assert.strictEqual(countOccurrences(htmlAfterSave, "Updated Todo List via K6"), 1, "Should have exactly one occurrence of updated title");
});

test("Add item after title change", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply the full sequence: edit -> save -> add item
  rendered.applyDiff(sampleTitleEditDiff);
  rendered.applyDiff(sampleTitleSaveDiff);
  const htmlAfterAdd = rendered.applyDiff(sampleAddItemDiff);

  // The title should still be there and not duplicated
  assert.strictEqual(countOccurrences(htmlAfterAdd, "Updated Todo List via K6"), 1, "Title should appear exactly once after adding item");
  
  // Should contain the new task input
  assert.ok(htmlAfterAdd.includes('New task'), "Should contain new task after add item diff");
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
  assert.ok(generatedHTML.includes("<nav>"), "Should contain nav element");
  assert.ok(generatedHTML.includes("Updated Todo List via K6"), "Should contain title");
  assert.ok(generatedHTML.includes("<div>content</div>"), "Should contain content div");
  assert.strictEqual(countOccurrences(generatedHTML, "Updated Todo List via K6"), 1, "Should have exactly one title in generated HTML");
});

test("No duplication in final HTML", () => {
  const rendered = new Rendered(sampleInitialHTML);

  // Apply full sequence
  rendered.applyDiff(sampleTitleEditDiff);
  rendered.applyDiff(sampleTitleSaveDiff);
  rendered.applyDiff(sampleAddItemDiff);
  
  const finalHTML = rendered.getFullHTML();
  
  // Critical test: no duplicated content
  assert.strictEqual(countOccurrences(finalHTML, "Updated Todo List via K6"), 1, "Final HTML should have no duplicate titles");
  assert.strictEqual(countOccurrences(finalHTML, "<body"), 1, "Should have exactly one body tag");
  assert.strictEqual(countOccurrences(finalHTML, "</body>"), 1, "Should have exactly one closing body tag");
});
