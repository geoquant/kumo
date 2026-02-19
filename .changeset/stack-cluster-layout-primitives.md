---
"@cloudflare/kumo": minor
---

Add Stack and Cluster layout primitives

**New Component: Stack**

- Vertical flex column layout with constrained gap scale
- `gap`: "none" | "xs" | "sm" | "base" | "lg" | "xl"
- `align`: "start" | "center" | "end" | "stretch" (default: "stretch")
- Composable via `render` prop (default: `<div />`)

**New Component: Cluster**

- Horizontal flex row layout with constrained gap scale
- `gap`: "none" | "xs" | "sm" | "base" | "lg" | "xl"
- `justify`: "start" | "center" | "end" | "between" (default: "start")
- `align`: "start" | "center" | "end" | "baseline" | "stretch" (default: "center")
- `wrap`: "wrap" | "nowrap" (default: "wrap")
- Composable via `render` prop (default: `<div />`)

**Usage:**

```tsx
<Stack gap="base" align="center">
  <Text variant="heading2">Title</Text>
  <Text variant="secondary">Subtitle</Text>
</Stack>

<Cluster gap="sm" justify="end">
  <Button variant="ghost">Cancel</Button>
  <Button variant="primary">Save</Button>
</Cluster>
```

Both components export variant constants (`KUMO_STACK_VARIANTS`, `KUMO_CLUSTER_VARIANTS`) and variant functions (`stackVariants()`, `clusterVariants()`) for advanced composition.
