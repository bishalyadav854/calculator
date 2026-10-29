const expressionDisplay = document.querySelector("#expression");
const resultDisplay = document.querySelector("#result");
const historyList = document.querySelector("#history-list");
const historyCount = document.querySelector("#history-count");
const keypad = document.querySelector(".keypad");
const scientificToggle = document.querySelector("#scientific-toggle");
const scientificKeys = document.querySelector("#scientific-keys");
const themeToggle = document.querySelector("#theme-toggle");
const copyrightYear = document.querySelector("#copyright-year");
const root = document.documentElement;

let expression = "";
let justCalculated = false;
let history = [];
let angleMode = "DEG";

copyrightYear.textContent = String(new Date().getFullYear());

const operators = ["+", "-", "*", "/"];

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error("Result is not a finite number");
  }

  const rounded = Number.parseFloat(value.toPrecision(12));
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 10,
    useGrouping: true,
  }).format(rounded);
}

function displayExpression(value) {
  return value
    .replaceAll("*", "×")
    .replaceAll("/", "÷")
    .replaceAll("-", "−")
    .replaceAll("sqrt", "√")
    .replaceAll("pi", "π");
}

function calculate(source) {
  let position = 0;

  function skipWhitespace() {
    while (source[position] === " ") position += 1;
  }

  function parseExpression() {
    let value = parseTerm();
    skipWhitespace();

    while (source[position] === "+" || source[position] === "-") {
      const operator = source[position];
      position += 1;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
      skipWhitespace();
    }

    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    skipWhitespace();

    while (source[position] === "*" || source[position] === "/") {
      const operator = source[position];
      position += 1;
      const right = parseUnary();
      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero");
      }
      value = operator === "*" ? value * right : value / right;
      skipWhitespace();
    }

    return value;
  }

  function parseUnary() {
    skipWhitespace();
    if (source[position] === "+") {
      position += 1;
      return parseUnary();
    }
    if (source[position] === "-") {
      position += 1;
      return -parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    let value = parsePostfix();
    skipWhitespace();
    if (source[position] === "^") {
      position += 1;
      value **= parseUnary();
    }
    return value;
  }

  function parsePostfix() {
    let value = parsePrimary();
    skipWhitespace();
    while (source[position] === "%") {
      value /= 100;
      position += 1;
      skipWhitespace();
    }
    return value;
  }

  function parsePrimary() {
    skipWhitespace();
    if (source[position] === "(") {
      position += 1;
      const value = parseExpression();
      skipWhitespace();
      if (source[position] !== ")") {
        throw new Error("Expected closing parenthesis");
      }
      position += 1;
      return value;
    }

    if (/[a-z]/i.test(source[position] || "")) {
      const start = position;
      while (/[a-z]/i.test(source[position] || "")) position += 1;
      const name = source.slice(start, position).toLowerCase();
      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;
      if (!["sin", "cos", "tan", "sqrt", "ln", "log", "abs"].includes(name)) {
        throw new Error("Unknown function");
      }
      if (source[position] !== "(") {
        throw new Error("Expected function argument");
      }
      position += 1;
      const argument = parseExpression();
      skipWhitespace();
      if (source[position] !== ")") {
        throw new Error("Expected closing parenthesis");
      }
      position += 1;

      const angle = angleMode === "DEG" ? (argument * Math.PI) / 180 : argument;
      const functions = {
        sin: () => Math.sin(angle),
        cos: () => Math.cos(angle),
        tan: () => Math.tan(angle),
        sqrt: () => Math.sqrt(argument),
        ln: () => Math.log(argument),
        log: () => Math.log10(argument),
        abs: () => Math.abs(argument),
      };
      return functions[name]();
    }

    return parseNumber();
  }

  function parseNumber() {
    skipWhitespace();
    const start = position;
    let hasDigit = false;

    while (/[0-9]/.test(source[position] || "")) {
      position += 1;
      hasDigit = true;
    }

    if (source[position] === ".") {
      position += 1;
      while (/[0-9]/.test(source[position] || "")) {
        position += 1;
        hasDigit = true;
      }
    }

    if (!hasDigit) {
      throw new Error("Expected a number");
    }

    const value = Number(source.slice(start, position));
    if (!Number.isFinite(value)) {
      throw new Error("Invalid number");
    }
    return value;
  }

  const value = parseExpression();
  skipWhitespace();
  if (position !== source.length) {
    throw new Error("Unexpected input");
  }
  if (!Number.isFinite(value)) {
    throw new Error("Result is not a finite number");
  }
  return value;
}

function currentPreview() {
  if (!expression || operators.includes(expression.at(-1)) || expression.at(-1) === "." || expression.at(-1) === "^") {
    return null;
  }
  try {
    return { value: calculate(expression) };
  } catch (error) {
    if (["Expected a number", "Expected closing parenthesis", "Expected function argument"].includes(error.message)) {
      return null;
    }
    return { error };
  }
}

function render() {
  expressionDisplay.textContent = expression ? displayExpression(expression) : "0";
  const preview = currentPreview();
  if (preview === null) {
    resultDisplay.textContent = "—";
  } else if (preview.error) {
    resultDisplay.textContent = preview.error.message === "Cannot divide by zero"
      ? "Cannot divide by zero"
      : "Error";
  } else {
    resultDisplay.textContent = formatNumber(preview.value);
  }
}

function appendDigit(digit) {
  if (justCalculated) {
    expression = "";
    justCalculated = false;
  }

  if (expression.endsWith("%") || expression.endsWith(")") || expression.endsWith("pi")) {
    expression += "*";
  }
  expression += digit;
  render();
}

function appendOperator(operator) {
  justCalculated = false;

  if (!expression) {
    if (operator === "-") expression = "-";
    render();
    return;
  }

  const last = expression.at(-1);
  if (operators.includes(last)) {
    if (expression.length === 1 && last === "-" && operator !== "-") return;
    expression = expression.slice(0, -1) + operator;
  } else if (last !== ".") {
    expression += operator;
  }
  render();
}

function appendDecimal() {
  if (justCalculated) {
    expression = "";
    justCalculated = false;
  }
  if (expression.endsWith("%") || expression.endsWith(")") || expression.endsWith("pi")) expression += "*";
  const currentNumber = expression.split(/[+\-*/]/).at(-1);
  if (!currentNumber.includes(".")) {
    expression += currentNumber ? "." : "0.";
  }
  render();
}

function toggleSign() {
  if (justCalculated) justCalculated = false;
  const match = expression.match(/(\d*\.?\d+)%?$/);
  if (!match) {
    if (!expression) expression = "-";
    else if (operators.includes(expression.at(-1))) expression += "-";
    render();
    return;
  }

  const start = match.index;
  const numberStart = start;
  const hasUnaryMinus = numberStart > 0
    && expression[numberStart - 1] === "-"
    && (numberStart - 1 === 0 || operators.includes(expression[numberStart - 2]));
  if (hasUnaryMinus) {
    expression = expression.slice(0, numberStart - 1) + expression.slice(numberStart);
  } else {
    expression = expression.slice(0, numberStart) + "-" + expression.slice(numberStart);
  }
  render();
}

function applyPercent() {
  if (justCalculated) justCalculated = false;
  if (/\d(?:\.\d*)?$/.test(expression)) expression += "%";
  render();
}

function backspace() {
  if (justCalculated) {
    expression = "";
    justCalculated = false;
  } else {
    expression = expression.slice(0, -1);
  }
  render();
}

function renderHistory() {
  historyCount.textContent = String(history.length).padStart(2, "0");
  if (!history.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <span class="empty-icon" aria-hidden="true">∑</span>
        <p>Your calculations will<br />show up here.</p>
      </div>`;
    return;
  }

  historyList.replaceChildren(...history.map((item) => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.type = "button";
    button.setAttribute("aria-label", `Reuse ${item.equation} equals ${item.answer}`);

    const equation = document.createElement("span");
    equation.className = "history-equation";
    equation.textContent = item.equation;
    const answer = document.createElement("span");
    answer.className = "history-answer";
    answer.textContent = item.answer;

    button.append(equation, answer);
    button.addEventListener("click", () => {
      expression = item.rawAnswer;
      justCalculated = true;
      render();
    });
    return button;
  }));
}

function commitCalculation() {
  const openParentheses = [...expression].filter((character) => character === "(").length;
  const closeParentheses = [...expression].filter((character) => character === ")").length;
  if (openParentheses > closeParentheses) {
    expression += ")".repeat(openParentheses - closeParentheses);
  }
  const preview = currentPreview();
  if (preview === null) return;
  if (preview.error) {
    resultDisplay.textContent = preview.error.message === "Cannot divide by zero" ? "Cannot divide by zero" : "Error";
    return;
  }
  const value = preview.value;

  const rawAnswer = String(Number.parseFloat(value.toPrecision(12)));
  const answer = formatNumber(value);
  history.unshift({
    equation: displayExpression(expression),
    answer,
    rawAnswer,
  });
  history = history.slice(0, 8);
  expression = rawAnswer;
  justCalculated = true;
  render();
  renderHistory();
}

function handleAction(action) {
  if (action === "clear") {
    expression = "";
    justCalculated = false;
    render();
  } else if (action === "decimal") {
    appendDecimal();
  } else if (action === "sign") {
    toggleSign();
  } else if (action === "percent") {
    applyPercent();
  } else if (action === "equals") {
    commitCalculation();
  } else if (action === "square" && expression) {
    expression = `(${expression})^2`;
    justCalculated = false;
    render();
  }
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.value !== undefined) {
    const value = button.dataset.value;
    if (operators.includes(value)) appendOperator(value);
    else if (/^\d$/.test(value)) appendDigit(value);
    else {
      if (justCalculated) justCalculated = false;
      if (value === "(" && /(?:\d|pi|\)|%)$/.test(expression)) expression += "*";
      if (value === "pi" && /(?:\d|pi|\)|%)$/.test(expression)) expression += "*";
      expression += value;
      render();
    }
  } else if (button.dataset.function) {
    if (justCalculated) {
      expression = `${button.dataset.function}(${expression})`;
      justCalculated = false;
    } else {
      if (/(?:\d|pi|\)|%)$/.test(expression)) expression += "*";
      expression += `${button.dataset.function}(`;
    }
    render();
  } else {
    handleAction(button.dataset.action);
  }
});

document.querySelector("#backspace").addEventListener("click", backspace);
scientificToggle.addEventListener("click", () => {
  const isExpanded = scientificToggle.getAttribute("aria-expanded") === "true";
  scientificToggle.setAttribute("aria-expanded", String(!isExpanded));
  scientificKeys.hidden = isExpanded;
});

document.querySelectorAll("[data-angle]").forEach((button) => {
  button.addEventListener("click", () => {
    angleMode = button.dataset.angle;
    document.querySelectorAll("[data-angle]").forEach((option) => {
      const isActive = option === button;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-pressed", String(isActive));
    });
    render();
  });
});

themeToggle.addEventListener("click", () => {
  const isLight = root.dataset.theme !== "light";
  root.dataset.theme = isLight ? "light" : "dark";
  themeToggle.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} theme`);
  document.querySelector('meta[name="theme-color"]').content = isLight ? "#f1f3ed" : "#101511";
});

document.querySelector("#clear-history").addEventListener("click", () => {
  history = [];
  renderHistory();
});

document.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLElement
    && event.target.closest("button")
    && ["Enter", " "].includes(event.key)
  ) return;
  if (/^[0-9]$/.test(event.key)) {
    appendDigit(event.key);
  } else if (operators.includes(event.key)) {
    appendOperator(event.key);
  } else if (event.key === ".") {
    appendDecimal();
  } else if (event.key === "%") {
    applyPercent();
  } else if (event.key === "(" || event.key === ")") {
    if (justCalculated) justCalculated = false;
    expression += event.key;
    render();
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    commitCalculation();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    backspace();
  } else if (event.key === "Escape" || event.key === "Delete") {
    expression = "";
    justCalculated = false;
    render();
  }
});

render();
