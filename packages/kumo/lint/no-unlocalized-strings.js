import { defineRule } from "oxlint";

const RULE_NAME = "no-unlocalized-strings";

const COMPONENTS_SEGMENT = "/src/components/";

const ATTRIBUTE_NAMES = new Set([
  "aria-label",
  "aria-description",
  "title",
  "placeholder",
  "alt",
]);

const ALLOWED_UNLOCALIZED_STRINGS = new Set([
  "breadcrumb",
  "Select row",
  "Select all rows",
  "Powered by",
  "Cloudflare",
]);

const PUNCTUATION_ONLY_RE = /^[\s.,:;!?()[\]{}'"`~^*+\-_/|\\<>@#$%&=]+$/;

function isIgnoredFilename(filename) {
  if (typeof filename !== "string") return true;
  if (!filename.includes(COMPONENTS_SEGMENT)) return true;

  return (
    filename.includes("/__tests__/") ||
    filename.includes("/stories/") ||
    filename.includes(".test.") ||
    filename.includes(".spec.") ||
    filename.includes(".stories.")
  );
}

function isLikelyUserFacingText(value) {
  const text = value.trim();
  if (text.length === 0) return false;
  if (PUNCTUATION_ONLY_RE.test(text)) return false;
  return /[A-Za-z]/.test(text);
}

function isAllowedUnlocalizedString(value) {
  return ALLOWED_UNLOCALIZED_STRINGS.has(value.trim());
}

function isTermCallee(callee) {
  if (!callee) return false;

  if (callee.type === "Identifier") {
    return callee.name === "term";
  }

  if (callee.type === "MemberExpression") {
    if (callee.property.type === "Identifier") {
      return callee.property.name === "term";
    }
    if (callee.property.type === "Literal") {
      return callee.property.value === "term";
    }
  }

  return false;
}

function hasTermCall(node) {
  if (!node) return false;

  switch (node.type) {
    case "CallExpression": {
      if (isTermCallee(node.callee)) return true;
      if (hasTermCall(node.callee)) return true;
      for (const arg of node.arguments) {
        if (arg.type === "SpreadElement") {
          if (hasTermCall(arg.argument)) return true;
          continue;
        }
        if (hasTermCall(arg)) return true;
      }
      return false;
    }
    case "TemplateLiteral": {
      return node.expressions.some((expr) => hasTermCall(expr));
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      return hasTermCall(node.left) || hasTermCall(node.right);
    }
    case "ConditionalExpression": {
      return (
        hasTermCall(node.test) ||
        hasTermCall(node.consequent) ||
        hasTermCall(node.alternate)
      );
    }
    case "UnaryExpression":
    case "UpdateExpression": {
      return hasTermCall(node.argument);
    }
    case "ArrayExpression": {
      return node.elements.some((element) => element && hasTermCall(element));
    }
    case "ObjectExpression": {
      return node.properties.some((prop) => {
        if (prop.type !== "Property") return false;
        return hasTermCall(prop.key) || hasTermCall(prop.value);
      });
    }
    default:
      return false;
  }
}

function collectStringLiterals(node, out) {
  if (!node) return;

  switch (node.type) {
    case "Literal": {
      if (typeof node.value === "string") {
        out.push(node.value);
      }
      return;
    }
    case "TemplateLiteral": {
      for (const quasi of node.quasis) {
        if (typeof quasi.value.cooked === "string") {
          out.push(quasi.value.cooked);
        }
      }
      for (const expression of node.expressions) {
        collectStringLiterals(expression, out);
      }
      return;
    }
    case "BinaryExpression":
    case "LogicalExpression": {
      collectStringLiterals(node.left, out);
      collectStringLiterals(node.right, out);
      return;
    }
    case "ConditionalExpression": {
      collectStringLiterals(node.test, out);
      collectStringLiterals(node.consequent, out);
      collectStringLiterals(node.alternate, out);
      return;
    }
    case "UnaryExpression":
    case "UpdateExpression": {
      collectStringLiterals(node.argument, out);
      return;
    }
    case "ArrayExpression": {
      for (const element of node.elements) {
        if (element) collectStringLiterals(element, out);
      }
      return;
    }
    case "ObjectExpression": {
      for (const prop of node.properties) {
        if (prop.type !== "Property") continue;
        collectStringLiterals(prop.key, out);
        collectStringLiterals(prop.value, out);
      }
      return;
    }
    case "CallExpression": {
      collectStringLiterals(node.callee, out);
      for (const arg of node.arguments) {
        if (arg.type === "SpreadElement") {
          collectStringLiterals(arg.argument, out);
          continue;
        }
        collectStringLiterals(arg, out);
      }
      return;
    }
  }
}

function isAllowedAttributeName(name) {
  return ATTRIBUTE_NAMES.has(name);
}

function getJsxAttributeName(nameNode) {
  if (!nameNode) return undefined;
  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  return undefined;
}

export const noUnlocalizedStringsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow unlocalized user-facing string literals in component JSX",
    },
    messages: {
      [RULE_NAME]:
        "User-facing string should be localized via useLocalize().term(...).",
    },
    schema: [],
  },
  defaultOptions: [],
  createOnce(context) {
    return {
      JSXText(node) {
        if (isIgnoredFilename(context.filename)) return;
        if (!isLikelyUserFacingText(node.value)) return;
        if (isAllowedUnlocalizedString(node.value)) return;
        context.report({ node, messageId: RULE_NAME });
      },
      JSXAttribute(node) {
        if (isIgnoredFilename(context.filename)) return;
        const name = getJsxAttributeName(node.name);
        if (!name || !isAllowedAttributeName(name)) return;

        if (!node.value) return;

        if (
          node.value.type === "Literal" &&
          typeof node.value.value === "string" &&
          isLikelyUserFacingText(node.value.value) &&
          !isAllowedUnlocalizedString(node.value.value)
        ) {
          context.report({ node, messageId: RULE_NAME });
          return;
        }

        if (node.value.type !== "JSXExpressionContainer") return;

        if (hasTermCall(node.value.expression)) return;

        const strings = [];
        collectStringLiterals(node.value.expression, strings);
        if (
          strings.some(
            (value) =>
              isLikelyUserFacingText(value) &&
              !isAllowedUnlocalizedString(value),
          )
        ) {
          context.report({ node, messageId: RULE_NAME });
        }
      },
    };
  },
});
