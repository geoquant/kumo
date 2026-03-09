export const kumoRegistryJson = {
  components: {
    Surface: {
      name: "Surface",
      description: "Container surface",
      category: "layout",
      importPath: "@cloudflare/kumo",
      props: {
        heading: {
          type: "string",
          description: "Heading text",
          required: false,
          optional: true,
        },
      },
    },
    Stack: {
      name: "Stack",
      description: "Vertical layout stack",
      category: "layout",
      importPath: "@cloudflare/kumo",
      props: {
        gap: {
          type: "string",
          description: "Spacing token",
          required: false,
          optional: true,
          values: ["sm", "md", "lg"],
        },
      },
    },
    Text: {
      name: "Text",
      description: "Text content",
      category: "content",
      importPath: "@cloudflare/kumo",
      props: {
        children: {
          type: "string",
          description: "Displayed text",
          required: true,
          optional: false,
        },
      },
    },
    Button: {
      name: "Button",
      description: "Action button",
      category: "actions",
      importPath: "@cloudflare/kumo",
      props: {
        children: {
          type: "string",
          description: "Label",
          required: true,
          optional: false,
        },
        variant: {
          type: "string",
          description: "Button style",
          required: false,
          optional: true,
          values: ["primary", "secondary", "ghost"],
        },
      },
    },
  },
  search: {
    byCategory: {
      actions: ["Button"],
      content: ["Text"],
      layout: ["Surface", "Stack"],
    },
  },
} as const;
