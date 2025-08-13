import { check } from "k6";
// Test Scenario class to manage step execution
export default class TestScenario {
  constructor() {
    this.steps = [];
    this.context = {};
    this.checks = {};
  }

  addStep(name, executor) {
    this.steps.push({ name, executor });
    return this;
  }

  addCheck(name, validator) {
    this.checks[name] = validator;
    return this;
  }

  runStep(step, callback) {
    console.log(`Running: ${step.name}`);
    step.executor(this.context, callback);
  }

  run() {
    let index = 0;

    const next = () => {
      if (index < this.steps.length) {
        this.runStep(this.steps[index++], next);
      } else {
        this.complete();
      }
    };

    next();
  }

  complete() {
    // Run all checks with collected context
    const checkResults = {};
    for (const [name, validator] of Object.entries(this.checks)) {
      checkResults[name] = validator;
    }
    check(this.context, checkResults);
  }
}
