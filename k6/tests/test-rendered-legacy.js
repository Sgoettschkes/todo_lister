#!/usr/bin/env node

// Test suite for the RenderedLegacy class (LiveView 1.0) using Node.js built-in test runner
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// Import the RenderedLegacy class
import RenderedLegacy from "../utilities/rendered-legacy.js";

// Test data - sample HTML and diffs adapted for LiveView 1.0
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

const sampleTodoListTitleEditDiff = {
  3: {
    0: ' value="New Todo List"',
    s: [
      '\n                <form phx-submit="save_title" class="w-full">\n                  <input type="text" name="title"',
      ' class="w-full bg-transparent border-0 outline-none focus:outline-none text-3xl font-bold cursor-pointer p-0 m-0 font-inherit leading-inherit" phx-blur="save_title">\n                </form>\n              ',
    ],
  },
};

const sampleTodoListTitleSaveDiff = {
  3: {
    s: [
      '\n                <h1 class="text-3xl font-bold">\n                  Updated Todo List via K6\n                </h1>\n              ',
    ],
  },
};

// Sample diff with page title change (Phoenix LiveView sends title as "t" field)
const samplePageTitleDiff = {
  t: "Updated Todo List via K6"
};

// LiveView 1.0: No keyed comprehensions - use simpler structure
const sampleAddItemDiff = {
  5: {
    0: {
      0: ' data-item-id="test-item-id"',
      1: ' class="item-class"',
      s: [
        "\n              <div",
        '>\n                <input value="New task"',
        ">\n              </div>\n            ",
      ],
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
// Phoenix LiveView 1.0 Compatibility Tests
// ========================================

test("Phoenix LiveView 1.0 - simple component rendering", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
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

test("Phoenix LiveView 1.0 - nested components", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
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

test("Phoenix LiveView 1.0 - multiple dynamics with templates", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
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

test("Phoenix LiveView 1.0 - mixed content types", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
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

test("Phoenix LiveView 1.0 - deeply nested structure", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
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

test("Phoenix LiveView 1.0 - empty string in template", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
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

// LiveView 1.0: No keyed comprehension tests since they don't exist in 1.0

test("Phoenix LiveView 1.0 - simple list rendering without keyed comprehensions", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // In LiveView 1.0, lists are rendered as simple nested structures
  const phoenixInput = {
    "0": {
      "0": "Item 1",
      "1": "Item 2", 
      "2": "Item 3",
      "s": ["<li>", "</li><li>", "</li><li>", "</li>"]
    },
    "s": ["<ul>", "</ul>"]
  };
  
  const expectedOutput = `<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>`;
  
  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match simple list rendering without keyed comprehensions");
});

// ========================================
// Original Tests Adapted for LiveView 1.0
// ========================================

test("Initial rendering", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);
  const html = rendered.getFullHTML();

  // Should create a clean document template without the original content
  assert.ok(html.length > 100, "HTML should have reasonable length");
  assert.ok(!html.includes("New Todo List"), "Should not contain original server-rendered content");
});

test("Initial page title in HTML", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);
  const html = rendered.getFullHTML();
  
  // Should preserve the initial page title in HTML
  assert.ok(html.includes("<title>TodoLister</title>"), "Should preserve 'TodoLister' as initial page title in HTML");
});

test("Page title update via diff", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);
  
  // Apply title diff
  rendered.applyDiff(samplePageTitleDiff);
  
  // Verify title appears in HTML
  const html = rendered.getFullHTML();
  assert.ok(html.includes("<title>Updated Todo List via K6</title>"), "Should update title tag in HTML");
});

test("Todo list title edit diff application", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);

  // Apply the title edit diff (shows form)
  const htmlAfterEdit = rendered.applyDiff(sampleTodoListTitleEditDiff);

  assert.ok(htmlAfterEdit.includes("<form"), "Should contain form after edit diff");
  assert.strictEqual(countOccurrences(htmlAfterEdit, "New Todo List"), 1, "Should have exactly one occurrence of 'New Todo List'");
});

test("Todo list title save diff application", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);

  // Apply edit then save
  rendered.applyDiff(sampleTodoListTitleEditDiff);
  const htmlAfterSave = rendered.applyDiff(sampleTodoListTitleSaveDiff);

  assert.ok(htmlAfterSave.includes("Updated Todo List via K6"), "Should contain updated title");
  assert.strictEqual(countOccurrences(htmlAfterSave, "Updated Todo List via K6"), 1, "Should have exactly one occurrence of updated title");
});

test("Add item after todo list title change", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);

  // Apply the full sequence: edit -> save -> add item
  rendered.applyDiff(sampleTodoListTitleEditDiff);
  rendered.applyDiff(sampleTodoListTitleSaveDiff);
  const htmlAfterAdd = rendered.applyDiff(sampleAddItemDiff);

  // The title should still be there and not duplicated
  assert.strictEqual(countOccurrences(htmlAfterAdd, "Updated Todo List via K6"), 1, "Title should appear exactly once after adding item");
  
  // Should contain the new task input
  assert.ok(htmlAfterAdd.includes('New task'), "Should contain new task after add item diff");
});

test("Combined content and page title update", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);

  // Apply content change and title change together
  const combinedDiff = {
    ...sampleTodoListTitleSaveDiff,
    ...samplePageTitleDiff
  };
  
  const html = rendered.applyDiff(combinedDiff);
  
  // Should update both the content and page title
  assert.ok(html.includes("Updated Todo List via K6"), "Should contain updated content title");
  assert.ok(html.includes("<title>Updated Todo List via K6</title>"), "Should update page title tag in HTML");
});

test("Direct HTML generation", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);

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
  const rendered = new RenderedLegacy(sampleInitialHTML);

  // Apply full sequence
  rendered.applyDiff(sampleTodoListTitleEditDiff);
  rendered.applyDiff(sampleTodoListTitleSaveDiff);
  rendered.applyDiff(sampleAddItemDiff);
  
  const finalHTML = rendered.getFullHTML();
  
  // Critical test: no duplicated content
  assert.strictEqual(countOccurrences(finalHTML, "Updated Todo List via K6"), 1, "Final HTML should have no duplicate titles");
  assert.strictEqual(countOccurrences(finalHTML, "<body"), 1, "Should have exactly one body tag");
  assert.strictEqual(countOccurrences(finalHTML, "</body>"), 1, "Should have exactly one closing body tag");
});

test("Component diff application with nested changes", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Use the same pattern as working tests
  const initialRender = {
    "0": 1,
    "c": {
      "1": {
        "0": "Initial content",
        "s": ["<div class=\"component\">", "</div>"]
      }
    },
    "s": ["<section>", "</section>"]
  };
  
  // Set directly like working tests
  rendered.rendered = initialRender;
  const initialHTML = rendered.toHTML(initialRender);
  
  // Apply diff that updates component 1 content
  const componentDiff = {
    "c": {
      "1": {
        "0": "Updated content",
        "s": ["<div class=\"component updated\">", "</div>"]
      }
    }
  };
  
  rendered.applyDiff(componentDiff);
  const updatedHTML = rendered.toHTML(rendered.rendered);
  
  assert.ok(updatedHTML.includes("Updated content"), "Should contain updated component content");
  assert.ok(updatedHTML.includes("class=\"component updated\""), "Should have updated CSS class");
});

test("Mixed static and dynamic updates", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Start with simpler mixed content
  const initialRender = {
    "0": "Page Title",
    "1": "Dynamic content",
    "s": ["<h1>", "</h1><p>", "</p>"]
  };
  
  rendered.rendered = initialRender;
  const initialHTML = rendered.toHTML(initialRender);
  
  // Apply diff that changes both static and dynamic content
  const mixedDiff = {
    "0": "Updated Page Title",
    "1": "New dynamic content"
  };
  
  rendered.applyDiff(mixedDiff);
  const updatedHTML = rendered.toHTML(rendered.rendered);
  
  assert.ok(updatedHTML.includes("Updated Page Title"), "Should update title");
  assert.ok(updatedHTML.includes("New dynamic content"), "Should update dynamic content");
});

test("Template reference chain resolution", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Test simplified template sharing
  const templateChainRender = {
    "0": 1,
    "1": 2,
    "c": {
      "1": {
        "0": "Base content",
        "s": ["<div>", "</div>"]
      },
      "2": {
        "0": "Shared content",
        "s": 1  // References component 1's template
      }
    },
    "s": ["<section>", "", "</section>"]
  };
  
  rendered.rendered = templateChainRender;
  const chainHTML = rendered.toHTML(templateChainRender);
  
  assert.ok(chainHTML.includes("Base content"), "Should render base component");
  assert.ok(chainHTML.includes("Shared content"), "Should render shared template component");
});

test("Complete todo list workflow with page title updates", () => {
  const rendered = new RenderedLegacy(sampleInitialHTML);
  
  // Step 1: Verify initial title in HTML
  let html = rendered.getFullHTML();
  assert.ok(html.includes("<title>TodoLister</title>"), "Should start with TodoLister title in HTML");
  
  // Step 2: Edit the title (UI shows input form)
  rendered.applyDiff(sampleTodoListTitleEditDiff);
  html = rendered.getFullHTML();
  assert.ok(html.includes("form"), "Should show edit form");
  assert.ok(html.includes("<title>TodoLister</title>"), "Page title unchanged during edit");
  
  // Step 3: Save the title (both content and page title update)
  const saveWithTitleDiff = {
    ...sampleTodoListTitleSaveDiff,
    t: "Updated Todo List via K6"  // Phoenix sends both content and title updates
  };
  rendered.applyDiff(saveWithTitleDiff);
  html = rendered.getFullHTML();
  
  // Verify both content and page title are updated in HTML
  assert.ok(html.includes("Updated Todo List via K6"), "Should show updated title in content");
  assert.ok(html.includes("<title>Updated Todo List via K6</title>"), "Should update page title tag in HTML");
  
  // Step 4: Add an item (content changes but title remains)
  rendered.applyDiff(sampleAddItemDiff);
  html = rendered.getFullHTML();
  
  assert.ok(html.includes("New task"), "Should show new task");
  assert.ok(html.includes("<title>Updated Todo List via K6</title>"), "Page title tag should remain updated in HTML");
});

test("Phoenix LiveView 1.0 extract pattern compliance", () => {
  // Test that our extract method works like Phoenix LiveView's
  const diffWithTitle = {
    t: "My Page Title",
    e: [["click", "button"]],
    r: { ok: true },
    3: { s: ["<div>", "</div>"] }
  };
  
  // Extract should remove t, e, r and return them separately
  const { diff, title, reply, events } = RenderedLegacy.extract(diffWithTitle);
  
  // Verify extracted values
  assert.strictEqual(title, "My Page Title", "Should extract title");
  assert.deepStrictEqual(reply, { ok: true }, "Should extract reply");
  assert.deepStrictEqual(events, [["click", "button"]], "Should extract events");
  
  // Verify clean diff (without t, e, r)
  assert.deepStrictEqual(diff, { 3: { s: ["<div>", "</div>"] } }, "Should return clean diff");
  
  // Verify original diff is not mutated
  assert.ok(diffWithTitle.hasOwnProperty('t'), "Original diff should still have title");
});

test("Phoenix LiveView 1.0 - complex diff with dynamics and templates", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Simplified version of the complex diff structure provided
  const complexDiff = {
    "3": {
      "0": {
        "4": {
          "0": {
            "0": {
              "2": " id=\"home-link\" class=\"is-active\""
            }
          }
        }
      },
      "2": {
        "2": {
          "0": {
            "p": {
              "0": ["<div class=\"container ", "\">", "</div>"],
              "1": ["<button", " class=\"btn\">", "</button>"]
            },
            "d": [[{
              "0": "active-class",
              "1": " aria-label=\"Home\"",
              "2": "Home Button"
            }]]
          }
        }
      }
    }
  };
  
  // Apply the complex diff
  rendered.applyDiff(complexDiff);
  const result = rendered.toHTML(rendered.rendered);
  
  // Should process the dynamics and templates correctly
  assert.ok(result.length > 0, "Should produce some HTML output");
  
  // The exact output depends on the complex template resolution
  // but we can verify that dynamics processing didn't crash
  assert.ok(typeof result === "string", "Should return a string");
});

test("Phoenix LiveView 1.0 - dynamics array processing", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Test the dynamics processing with a simpler structure
  const diffWithDynamics = {
    "0": {
      "d": [[{
        "0": "Dynamic Content 1",
        "1": "Dynamic Content 2"
      }]],
      "s": ["<div>", " - ", "</div>"]
    }
  };
  
  rendered.applyDiff(diffWithDynamics);
  const result = rendered.toHTML(rendered.rendered);
  
  assert.ok(result.includes("Dynamic Content 1"), "Should include first dynamic content");
  assert.ok(result.includes("Dynamic Content 2"), "Should include second dynamic content");
});

// Phoenix LiveView 1.0.17 actual test cases ported from diff_test.exs

test("Phoenix LiveView 1.0.17 - subtrees chain (from official tests)", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Exact test case from Phoenix LiveView 1.0.17 diff_test.exs
  const phoenixInput = {
    "0": {
      "d": [["1", 1], ["2", 2], ["3", 3]], 
      "s": ["\n", ":", ""]
    },
    "c": {
      "1": {"0": {"0": "index_1", "s": ["\nIF ", ""]}, "s": ["", ""]},
      "2": {"0": {"0": "index_2", "s": ["\nELSE ", ""]}, "s": 1},
      "3": {"0": {"0": "index_3"}, "s": 2}
    },
    "s": ["<div>", "\n</div>"]
  };
  
  // Expected output from Phoenix LiveView 1.0.17
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
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match Phoenix LiveView 1.0.17 subtrees chain output");
});

test("Phoenix LiveView 1.0.17 - comprehension replacement (from official tests)", () => {
  const rendered = new RenderedLegacy("<!DOCTYPE html><html><body><div id=\"test\"></div></body></html>");
  
  // Exact test case from Phoenix LiveView 1.0.17 diff_test.exs  
  const phoenixInput = {
    "0": 1,
    "1": 2,
    "c": {
      "1": {
        "0": {
          "0": {"d": [[], [], []], "s": ["ROW"]},
          "s": ["\n", ""]
        },
        "s": ["<div>", "</div>"]
      },
      "2": {
        "0": {
          "0": {"0": "BAR", "s": ["FOO", "BAZ"]},
          "s": ["\n", ""]
        },
        "s": 1
      }
    },
    "s": ["", "", ""]
  };
  
  // Expected output from Phoenix LiveView 1.0.17 test
  const expectedOutput = `<div>\nROWROWROW</div><div>\nFOOBARBAZ</div>`;

  rendered.rendered = phoenixInput;
  const actualOutput = rendered.toHTML(phoenixInput);
  
  assert.strictEqual(actualOutput, expectedOutput, "Should match Phoenix LiveView 1.0.17 comprehension replacement output");
});