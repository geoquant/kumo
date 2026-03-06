import { defineRule } from "oxlint";

const RULE_NAME = "no-unlocalized-strings";

const CONSUMER_SURFACE_SEGMENTS = [
  "/src/components/",
  "/src/blocks/",
  "/src/code/",
];

const ATTRIBUTE_NAMES = new Set([
  "aria-label",
  "aria-description",
  "title",
  "placeholder",
  "alt",
]);

const ARIA_IDREF_NAMES = new Set([
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-details",
  "aria-flowto",
  "aria-owns",
  "aria-activedescendant",
  "aria-errormessage",
]);

const ARIA_NON_USER_TEXT_NAMES = new Set([
  "aria-hidden",
  "aria-live",
  "aria-current",
  "aria-atomic",
  "aria-busy",
  "aria-relevant",
  "aria-modal",
  "aria-haspopup",
  "aria-expanded",
  "aria-pressed",
  "aria-selected",
  "aria-checked",
  "aria-disabled",
  "aria-readonly",
  "aria-required",
  "aria-invalid",
  "aria-level",
  "aria-valuemin",
  "aria-valuemax",
  "aria-valuenow",
]);

const NON_USER_FACING_ATTRIBUTE_NAMES = new Set([
  "className",
  "id",
  "key",
  "name",
  "value",
  "type",
  "variant",
  "size",
  "role",
  "href",
  "src",
  "to",
  "target",
  "rel",
  "dir",
  "lang",
  "htmlFor",
  "tabIndex",
  "inputMode",
]);

const ALLOWED_UNLOCALIZED_STRINGS = new Set([
  "breadcrumb",
  "Select row",
  "Select all rows",
  "Powered by",
  "Cloudflare",
]);

const PUNCTUATION_ONLY_RE = /^[\s.,:;!?()[\]{}'"`~^*+\-_/|\\<>@#$%&=]+$/;
export function isConsumerSurfaceFile(filename) {
  if (typeof filename !== "string") return false;
  if (
    !CONSUMER_SURFACE_SEGMENTS.some((segment) => filename.includes(segment))
  ) {
    return false;
  }

  return !(
    filename.includes("/__tests__/") ||
    filename.includes("/stories/") ||
    filename.includes(".test.") ||
    filename.includes(".spec.") ||
    filename.includes(".stories.")
  );
}

function isIgnoredFilename(filename) {
  return !isConsumerSurfaceFile(filename);
}

function isLikelyUserFacingText(value) {
  const text = value.trim();
  if (text.length === 0) return false;
  if (PUNCTUATION_ONLY_RE.test(text)) return false;
  return /\p{L}/u.test(text);
}

function isAllowedUnlocalizedString(value) {
  return ALLOWED_UNLOCALIZED_STRINGS.has(value.trim());
}

export function isTermCallee(callee) {
  if (!callee) return false;

  if (callee.type === "Identifier") {
    return callee.name === "term";
  }

  if (
    callee.type === "MemberExpression" &&
    callee.computed === false &&
    callee.property?.type === "Identifier"
  ) {
    return callee.property.name === "term";
  }

  return false;
}

export function collectStringLiterals(node, out) {
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
    case "BinaryExpression": {
      if (node.operator !== "+") return;
      collectStringLiterals(node.left, out);
      collectStringLiterals(node.right, out);
      return;
    }
    case "LogicalExpression": {
      collectStringLiterals(node.left, out);
      collectStringLiterals(node.right, out);
      return;
    }
    case "ConditionalExpression": {
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
        collectStringLiterals(prop.value, out);
      }
      return;
    }
    case "CallExpression": {
      if (isTermCallee(node.callee)) {
        return;
      }

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

export function isTextBearingAttributeName(name) {
  if (ATTRIBUTE_NAMES.has(name)) return true;
  if (NON_USER_FACING_ATTRIBUTE_NAMES.has(name)) return false;
  if (name.startsWith("data-") || /^on[A-Z]/.test(name)) return false;
  if (ARIA_IDREF_NAMES.has(name)) return false;
  if (ARIA_NON_USER_TEXT_NAMES.has(name)) return false;
  if (name.startsWith("aria-")) return true;

  return /(label|description|message|text|title|placeholder|alt|caption)$/i.test(
    name,
  );
}

function isAllowedAttributeName(name) {
  return isTextBearingAttributeName(name);
}

function getJsxAttributeName(nameNode) {
  if (!nameNode) return undefined;
  if (nameNode.type === "JSXIdentifier") return nameNode.name;
  return undefined;
}

function getPropertyName(keyNode) {
  if (!keyNode) return undefined;
  if (keyNode.type === "Identifier") return keyNode.name;
  if (keyNode.type === "Literal" && typeof keyNode.value === "string") {
    return keyNode.value;
  }
  return undefined;
}

export function collectSpreadAttributeStrings(node, out) {
  if (!node) return;

  switch (node.type) {
    case "ObjectExpression": {
      for (const prop of node.properties) {
        if (prop.type === "SpreadElement") {
          collectSpreadAttributeStrings(prop.argument, out);
          continue;
        }

        if (prop.type !== "Property" || prop.computed) continue;

        const keyName = getPropertyName(prop.key);
        if (!keyName || !isAllowedAttributeName(keyName)) continue;

        collectStringLiterals(prop.value, out);
      }
      return;
    }
    case "ConditionalExpression": {
      collectSpreadAttributeStrings(node.consequent, out);
      collectSpreadAttributeStrings(node.alternate, out);
      return;
    }
    case "LogicalExpression": {
      collectSpreadAttributeStrings(node.left, out);
      collectSpreadAttributeStrings(node.right, out);
      return;
    }
    case "CallExpression": {
      for (const arg of node.arguments) {
        if (arg.type === "SpreadElement") {
          collectSpreadAttributeStrings(arg.argument, out);
          continue;
        }
        collectSpreadAttributeStrings(arg, out);
      }
      return;
    }
    case "ArrayExpression": {
      for (const element of node.elements) {
        if (element) collectSpreadAttributeStrings(element, out);
      }
      return;
    }
  }
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
      JSXElement(node) {
        if (isIgnoredFilename(context.filename)) return;

        const attributes = node.openingElement?.attributes ?? [];
        for (const attribute of attributes) {
          if (attribute.type !== "JSXSpreadAttribute") continue;

          const strings = [];
          collectSpreadAttributeStrings(attribute.argument, strings);
          if (
            strings.some(
              (value) =>
                isLikelyUserFacingText(value) &&
                !isAllowedUnlocalizedString(value),
            )
          ) {
            context.report({ node: attribute, messageId: RULE_NAME });
          }
        }

        for (const child of node.children ?? []) {
          if (child.type !== "JSXExpressionContainer") continue;

          const strings = [];
          collectStringLiterals(child.expression, strings);
          if (
            strings.some(
              (value) =>
                isLikelyUserFacingText(value) &&
                !isAllowedUnlocalizedString(value),
            )
          ) {
            context.report({ node: child, messageId: RULE_NAME });
          }
        }
      },
    };
  },
});
