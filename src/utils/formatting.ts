/**
 * Formats accessibility snapshots into a clean, hierarchical string representation
 * optimized for LLM token usage and fast semantic reasoning.
 */
export function formatAccessibilityTree(node: any, depth = 0): string {
  if (!node) return "";

  const indent = "  ".repeat(depth);
  const role = node.role || "generic";
  const name = node.name ? ` "${node.name}"` : "";
  const value = node.value ? ` [value=${node.value}]` : "";
  const description = node.description ? ` (${node.description})` : "";
  const disabled = node.disabled ? " [disabled]" : "";
  const focused = node.focused ? " [focused]" : "";
  const checked = node.checked !== undefined ? ` [checked=${node.checked}]` : "";
  const pressed = node.pressed !== undefined ? ` [pressed=${node.pressed}]` : "";

  let result = `${indent}- ${role}${name}${value}${description}${disabled}${focused}${checked}${pressed}\n`;

  if (Array.isArray(node.children) && node.children.length > 0) {
    for (const child of node.children) {
      result += formatAccessibilityTree(child, depth + 1);
    }
  }

  return result;
}

/**
 * Truncates string to a max character length with an explanatory suffix
 * to prevent runaway token expenditure.
 */
export function truncateOutput(content: string, maxLength = 25000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + `\n\n... [Content truncated at ${maxLength} characters to preserve token context]`;
}
