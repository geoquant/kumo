import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { createContext, useContext, useImperativeHandle } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";

import type { UITree } from "@cloudflare/kumo/streaming";
const { streamJsonlUIMock, streamToolConfirmationMock } = vi.hoisted(() => ({
  streamJsonlUIMock: vi.fn(),
  streamToolConfirmationMock: vi.fn(),
}));

vi.mock("virtual:kumo-registry", () => ({
  kumoRegistryJson: JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../kumo/ai/component-registry.json"),
      "utf8",
    ),
  ),
}));

import { PlaygroundPage } from "./_PlaygroundPage";

vi.mock("~/components/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("~/components/HighlightedCode", () => ({
  HighlightedCode: ({ code }: { readonly code: string }) => <pre>{code}</pre>,
}));

vi.mock("./DemoButton", () => ({
  DemoButton: ({ children }: { readonly children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("~/lib/stream-jsonl-ui", () => ({
  streamJsonlUI: streamJsonlUIMock,
}));

vi.mock("~/lib/tool-middleware", async () => {
  const actual = await vi.importActual<typeof import("~/lib/tool-middleware")>(
    "~/lib/tool-middleware",
  );

  return {
    ...actual,
    streamToolConfirmation: streamToolConfirmationMock,
  };
});

vi.mock("react-resizable-panels", async () => {
  return {
    Group: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    Panel: ({
      children,
      panelRef,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      readonly panelRef?: React.Ref<{
        collapse: () => void;
        expand: () => void;
      }>;
    }) => {
      useImperativeHandle(panelRef, () => ({ collapse() {}, expand() {} }));
      return <div {...props}>{children}</div>;
    },
    Separator: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    useDefaultLayout: () => ({
      defaultLayout: undefined,
      onLayoutChanged: vi.fn(),
    }),
  };
});

vi.mock("@cloudflare/kumo", async (importOriginal) => {
  const react = await vi.importActual<typeof import("react")>("react");
  const actual = await importOriginal<typeof import("@cloudflare/kumo")>();

  const PopoverContext = createContext<
    | {
        readonly open: boolean;
        readonly setOpen: (open: boolean) => void;
      }
    | undefined
  >(undefined);

  function Button({
    children,
    icon,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly icon?: React.ReactNode;
  }) {
    return (
      <button {...props}>
        {icon}
        {children}
      </button>
    );
  }

  function Checkbox({
    label,
    checked,
    onCheckedChange,
  }: {
    readonly label: string;
    readonly checked?: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
  }) {
    return (
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
        {label}
      </label>
    );
  }

  function Select({
    children,
    value,
    onValueChange,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    readonly onValueChange?: (value: string) => void;
  }) {
    return (
      <select
        {...props}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {children}
      </select>
    );
  }
  Select.Option = function Option({
    children,
    ...props
  }: React.OptionHTMLAttributes<HTMLOptionElement>) {
    return <option {...props}>{children}</option>;
  };

  function InputArea({
    value,
    onValueChange,
    ...props
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    readonly onValueChange?: (value: string) => void;
  }) {
    return (
      <textarea
        {...props}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      />
    );
  }

  function Tabs({
    tabs,
    value,
    onValueChange,
  }: {
    readonly tabs: readonly {
      readonly value: string;
      readonly label: string;
    }[];
    readonly value: string;
    readonly onValueChange: (value: string) => void;
  }) {
    return (
      <div>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={tab.value === value}
            onClick={() => onValueChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  function Popover({
    open = false,
    onOpenChange,
    children,
  }: {
    readonly open?: boolean;
    readonly onOpenChange?: (open: boolean) => void;
    readonly children: React.ReactNode;
  }) {
    return (
      <PopoverContext.Provider
        value={{ open, setOpen: (next) => onOpenChange?.(next) }}
      >
        <div>{children}</div>
      </PopoverContext.Provider>
    );
  }

  Popover.Trigger = function PopoverTrigger({
    children,
  }: {
    readonly children: React.ReactElement<{ onClick?: () => void }>;
  }) {
    const context = useContext(PopoverContext);
    if (context === undefined) {
      return children;
    }

    return react.cloneElement(children, {
      onClick: () => context.setOpen(!context.open),
    });
  };

  Popover.Content = function PopoverContent({
    children,
  }: {
    readonly children: React.ReactNode;
  }) {
    const context = useContext(PopoverContext);
    return context?.open ? <div>{children}</div> : null;
  };

  Popover.Title = ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Popover.Description = ({
    children,
  }: {
    readonly children: React.ReactNode;
  }) => <div>{children}</div>;

  return {
    ...actual,
    Button,
    Checkbox,
    CloudflareLogo: () => <div>Cloudflare</div>,
    Cluster: ({ children }: { readonly children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    InputArea,
    Loader: () => <div>Loading</div>,
    Popover,
    Select,
    Stack: ({ children }: { readonly children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Tabs,
    cn: (...values: Array<string | false | null | undefined>) =>
      values.filter(Boolean).join(" "),
  };
});

function buildPatchOps(tree: UITree) {
  return [
    { op: "replace", path: "/root", value: tree.root },
    { op: "replace", path: "/elements", value: tree.elements },
  ] as const;
}

function buildAssistantJsonl(tree: UITree): string {
  return buildPatchOps(tree)
    .map((op) => JSON.stringify(op))
    .join("\n");
}

function buildPanelATree(counterText: string, includeNote: boolean): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack"],
      },
      stack: {
        key: "stack",
        type: "Stack",
        props: {},
        children: includeNote
          ? ["counter", "note", "button"]
          : ["counter", "button"],
        parentKey: "surface",
      },
      counter: {
        key: "counter",
        type: "Text",
        props: { children: counterText },
        parentKey: "stack",
      },
      ...(includeNote
        ? {
            note: {
              key: "note",
              type: "Text",
              props: { children: "Edited note" },
              parentKey: "stack",
            },
          }
        : {}),
      button: {
        key: "button",
        type: "Button",
        props: { children: "Increment" },
        parentKey: "stack",
        action: { name: "increment", params: { target: "counter" } },
      },
    },
  };
}

function buildWarnPanelATree(): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack"],
      },
      stack: {
        key: "stack",
        type: "Stack",
        props: { gap: "medium" },
        children: ["counter", "button"],
        parentKey: "surface",
      },
      counter: {
        key: "counter",
        type: "Text",
        props: { children: "0" },
        parentKey: "stack",
      },
      button: {
        key: "button",
        type: "Button",
        props: { children: "Increment" },
        parentKey: "stack",
      },
    },
  };
}

function buildPassPanelATree(): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack"],
      },
      stack: {
        key: "stack",
        type: "Stack",
        props: { gap: "base" },
        children: ["heading", "subheading", "badge"],
        parentKey: "surface",
      },
      heading: {
        key: "heading",
        type: "Text",
        props: { children: "Kumo", variant: "heading1" },
        parentKey: "stack",
      },
      subheading: {
        key: "subheading",
        type: "Text",
        props: { children: "Verifier", variant: "heading2" },
        parentKey: "stack",
      },
      badge: {
        key: "badge",
        type: "Badge",
        props: { children: "Healthy", variant: "success" },
        parentKey: "stack",
      },
    },
  };
}

function buildFailPanelATree(): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["table"],
      },
      table: {
        key: "table",
        type: "Table",
        props: {},
        children: ["head"],
        parentKey: "surface",
      },
      head: {
        key: "head",
        type: "TableHead",
        props: { children: "Broken header" },
        parentKey: "table",
      },
    },
  };
}

function buildPanelBTree(text: string): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: { heading: "Baseline" },
        children: ["body"],
      },
      body: {
        key: "body",
        type: "Text",
        props: { children: text },
        parentKey: "surface",
      },
    },
  };
}

function buildConfirmationTree(toolId: string): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: ["stack"],
      },
      stack: {
        key: "stack",
        type: "Stack",
        props: {},
        children: ["copy", "cancel", "approve"],
        parentKey: "surface",
      },
      copy: {
        key: "copy",
        type: "Text",
        props: { children: "Create a new worker now" },
        parentKey: "stack",
      },
      cancel: {
        key: "cancel",
        type: "Button",
        props: { children: "Cancel" },
        parentKey: "stack",
        action: { name: "tool_cancel", params: { toolId } },
      },
      approve: {
        key: "approve",
        type: "Button",
        props: { children: "Approve" },
        parentKey: "stack",
        action: { name: "tool_approve", params: { toolId } },
      },
    },
  };
}

function buildFollowupTree(includeTable: boolean): UITree {
  return {
    root: "surface",
    elements: {
      surface: {
        key: "surface",
        type: "Surface",
        props: {},
        children: includeTable
          ? ["logo", "heading", "chart", "badge", "table"]
          : ["logo", "heading", "badge"],
      },
      logo: {
        key: "logo",
        type: "CloudflareLogo",
        props: {},
        parentKey: "surface",
      },
      heading: {
        key: "heading",
        type: "Text",
        props: { children: "hello-world", variant: "heading2" },
        parentKey: "surface",
      },
      ...(includeTable
        ? {
            chart: {
              key: "chart",
              type: "TimeseriesChart",
              props: {
                data: [
                  {
                    name: "Requests",
                    data: [
                      [1710000000000, 10],
                      [1710000060000, 18],
                    ],
                    color: "#f38020",
                  },
                ],
              },
              parentKey: "surface",
            },
          }
        : {}),
      badge: {
        key: "badge",
        type: "Badge",
        props: { children: "Active" },
        parentKey: "surface",
      },
      ...(includeTable
        ? {
            table: {
              key: "table",
              type: "Table",
              props: {},
              children: ["head", "body"],
              parentKey: "surface",
            },
            head: {
              key: "head",
              type: "TableHead",
              props: {},
              children: ["head-row"],
              parentKey: "table",
            },
            "head-row": {
              key: "head-row",
              type: "TableRow",
              props: {},
              children: ["head-cell"],
              parentKey: "head",
            },
            "head-cell": {
              key: "head-cell",
              type: "TableHeader",
              props: { children: "Name" },
              parentKey: "head-row",
            },
            body: {
              key: "body",
              type: "TableBody",
              props: {},
              children: ["row"],
              parentKey: "table",
            },
            row: {
              key: "row",
              type: "TableRow",
              props: {},
              children: ["cell"],
              parentKey: "body",
            },
            cell: {
              key: "cell",
              type: "TableCell",
              props: { children: "hello-world" },
              parentKey: "row",
            },
          }
        : {}),
    },
  };
}

const INITIAL_A_TREE = buildPanelATree("0", false);
const INITIAL_B_TREE = buildPanelBTree("Baseline body");

describe("PlaygroundPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.innerWidth = 1280;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/chat/prompt")) {
          return new Response(
            JSON.stringify({ prompt: "System prompt from test" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/api/chat/skills")) {
          return new Response(
            JSON.stringify({
              skills: [
                {
                  id: "skill-one",
                  name: "Skill One",
                  description: "Skill description",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    streamJsonlUIMock.mockImplementation(
      async ({
        body,
        onPatches,
        onToken,
      }: {
        readonly body: Record<string, unknown>;
        readonly onPatches: (
          ops: readonly {
            readonly op: string;
            readonly path: string;
            readonly value: unknown;
          }[],
        ) => void;
        readonly onToken?: (token: string) => void;
      }) => {
        const isPanelB = body["skipSystemPrompt"] === true;
        const hasSkills = Array.isArray(body["skillIds"]);
        const tree = isPanelB
          ? buildPanelBTree(
              hasSkills
                ? "Skill-applied baseline"
                : (INITIAL_B_TREE.elements.body?.props.children as string),
            )
          : INITIAL_A_TREE;
        onToken?.(buildAssistantJsonl(tree));
        onPatches(buildPatchOps(tree));
        return isPanelB ? "panel-b-response" : "panel-a-response";
      },
    );

    streamToolConfirmationMock.mockImplementation(
      async (
        _request: unknown,
        callbacks: {
          readonly onTreeUpdate: (tree: UITree) => void;
          readonly onComplete: (tree: UITree) => void;
        },
      ) => {
        const tree = buildPanelBTree("Approve create-worker-hello-world");
        callbacks.onTreeUpdate(tree);
        callbacks.onComplete(tree);
      },
    );
  });

  it("covers a/b streaming, prompt view, and action log flows", async () => {
    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build me a counter" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(streamJsonlUIMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Increment")).toBeTruthy();
      expect(screen.getByText("Baseline body")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Increment"));
    await waitFor(() => {
      expect(screen.getByText("1")).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText("Actions")[0]);
    await waitFor(() => {
      expect(screen.getByText("increment")).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText("Prompt")[0]);
    await waitFor(() => {
      expect(screen.getByText("System prompt from test")).toBeTruthy();
    });
  });

  it("renders the all variants pill after create worker", async () => {
    render(<PlaygroundPage />);

    await waitFor(() => {
      const createWorkerButton = screen.getByText("Create worker");
      const allVariantsButton = screen.getByText("All variants");

      expect(
        createWorkerButton.compareDocumentPosition(allVariantsButton),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  it("adds an exhaustive panel a prompt supplement only", async () => {
    render(<PlaygroundPage />);

    fireEvent.click(screen.getByText("All variants"));

    await waitFor(() => {
      expect(streamJsonlUIMock).toHaveBeenCalledTimes(2);
      expect(streamJsonlUIMock.mock.calls[0]?.[0]?.body).toMatchObject({
        message: "show me every kumo component variant",
        systemPromptSupplement: expect.stringContaining(
          "# Exhaustive Variant Showcase",
        ),
      });
      expect(streamJsonlUIMock.mock.calls[1]?.[0]?.body).toMatchObject({
        skipSystemPrompt: true,
      });
      expect(screen.getByText("Increment")).toBeTruthy();
      expect(screen.getByText("Baseline body")).toBeTruthy();
    });
  });

  it("keeps panel a generated output visible when panel b fails", async () => {
    streamJsonlUIMock
      .mockImplementationOnce(async ({ onPatches, onToken }) => {
        const tree = INITIAL_A_TREE;
        onToken?.(buildAssistantJsonl(tree));
        onPatches(buildPatchOps(tree));
        return "panel-a-response";
      })
      .mockRejectedValueOnce(new Error("AI service temporarily unavailable."));

    render(<PlaygroundPage />);

    fireEvent.click(screen.getByText("All variants"));

    await waitFor(() => {
      expect(screen.getByText("Increment")).toBeTruthy();
      expect(screen.getByText("Comparison request failed")).toBeTruthy();
      expect(screen.getByText("Send")).toBeTruthy();
    });
  });

  it("renders panel a after verifier passes and keeps panel b unchanged", async () => {
    streamJsonlUIMock.mockImplementationOnce(async ({ onPatches, onToken }) => {
      const tree = buildPassPanelATree();
      onToken?.(buildAssistantJsonl(tree));
      onPatches(buildPatchOps(tree));
      return "panel-a-response";
    });

    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build me a counter" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Healthy")).toBeTruthy();
      expect(screen.getByText("Baseline body")).toBeTruthy();
      expect(screen.getByLabelText("Panel A verifier status")).toBeTruthy();
      expect(screen.getByText("Pass")).toBeTruthy();
      expect(screen.queryByText("Verifier warnings")).toBeNull();
      expect(screen.queryByText("Verifier blocked panel A render")).toBeNull();
    });

    fireEvent.click(screen.getByLabelText("Panel A verifier status"));

    await waitFor(() => {
      expect(screen.getByText("Panel A verifier")).toBeTruthy();
      expect(screen.getByText("No verifier issues found.")).toBeTruthy();
      expect(screen.getByText("patch ops 2")).toBeTruthy();
    });
  });

  it("surfaces verifier warnings while still rendering panel a", async () => {
    streamJsonlUIMock.mockImplementationOnce(async ({ onPatches, onToken }) => {
      const tree = buildWarnPanelATree();
      onToken?.(buildAssistantJsonl(tree));
      onPatches(buildPatchOps(tree));
      return "panel-a-response";
    });

    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build me a counter" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Verifier warnings")).toBeTruthy();
      expect(
        screen.getByText("Repair count exceeds warning budget."),
      ).toBeTruthy();
      expect(screen.getByText("Increment")).toBeTruthy();
      expect(screen.getByText("Baseline body")).toBeTruthy();
      expect(screen.getByText("Warn")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Panel A verifier status"));

    await waitFor(() => {
      expect(screen.getByText("Panel A verifier")).toBeTruthy();
      expect(
        screen.getAllByText("Repair count exceeds warning budget.").length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText("JSONL").length).toBeGreaterThan(0);
    });
  });

  it("blocks pathological panel a output before preview mount", async () => {
    streamJsonlUIMock.mockImplementationOnce(async ({ onPatches, onToken }) => {
      const tree = buildFailPanelATree();
      onToken?.(buildAssistantJsonl(tree));
      onPatches(buildPatchOps(tree));
      return "panel-a-response";
    });

    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build a broken table" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Verifier blocked panel A render")).toBeTruthy();
      expect(
        screen.getByText(
          "Malformed compound structure exceeds verifier budget.",
        ),
      ).toBeTruthy();
      expect(screen.queryByText("Broken header")).toBeNull();
      expect(screen.getByText("Baseline body")).toBeTruthy();
      expect(screen.getByText("Fail")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Panel A verifier status"));

    await waitFor(() => {
      expect(screen.getByText("Panel A verifier")).toBeTruthy();
      expect(
        screen.getAllByText(
          "Malformed compound structure exceeds verifier budget.",
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText("Grade").length).toBeGreaterThan(0);
    });
  });

  it("replays panel b with selected skills", async () => {
    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build me a counter" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(streamJsonlUIMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByText("Skills"));
    fireEvent.click(screen.getByLabelText("Skill One"));
    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() => {
      expect(streamJsonlUIMock).toHaveBeenCalledTimes(3);
      expect(streamJsonlUIMock.mock.calls[2]?.[0]?.body).toMatchObject({
        skipSystemPrompt: true,
        skillIds: ["skill-one"],
      });
    });
  });

  it("renders inline tool confirmation cards for intercepted tool prompts", async () => {
    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "create a new hello world worker" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(streamToolConfirmationMock).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("Approve create-worker-hello-world"),
      ).toBeTruthy();
    });
  });

  it("keeps create-worker confirmation in chat and out of workspace panels", async () => {
    streamJsonlUIMock.mockImplementation(
      async ({
        body,
        onPatches,
        onToken,
      }: {
        readonly body: Record<string, unknown>;
        readonly onPatches: (
          ops: readonly {
            readonly op: string;
            readonly path: string;
            readonly value: unknown;
          }[],
        ) => void;
        readonly onToken?: (token: string) => void;
      }) => {
        const message = String(body["message"] ?? "");
        const isPanelB = body["skipSystemPrompt"] === true;
        const tree = message.includes("deployment dashboard")
          ? isPanelB
            ? buildPanelBTree("bad followup")
            : buildFollowupTree(true)
          : buildConfirmationTree(
              isPanelB ? "create-worker-b" : "create-worker-a",
            );

        onToken?.(buildAssistantJsonl(tree));
        onPatches(buildPatchOps(tree));
        return isPanelB ? "panel-b-response" : "panel-a-response";
      },
    );

    streamToolConfirmationMock.mockImplementation(
      async (
        _request: unknown,
        callbacks: {
          readonly onTreeUpdate: (tree: UITree) => void;
          readonly onComplete: (tree: UITree) => void;
        },
      ) => {
        const tree = buildConfirmationTree("create-worker-hello-world");
        callbacks.onTreeUpdate(tree);
        callbacks.onComplete(tree);
      },
    );

    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "create a new hello world worker" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(streamToolConfirmationMock).toHaveBeenCalledTimes(1);
      expect(streamJsonlUIMock).not.toHaveBeenCalled();
      expect(screen.getByText("Awaiting follow-up stage.")).toBeTruthy();
    });
  });

  it("scrubs prior chat and a/b outputs with the history slider", async () => {
    streamJsonlUIMock.mockImplementation(
      async ({
        body,
        onPatches,
        onToken,
      }: {
        readonly body: Record<string, unknown>;
        readonly onPatches: (
          ops: readonly {
            readonly op: string;
            readonly path: string;
            readonly value: unknown;
          }[],
        ) => void;
        readonly onToken?: (token: string) => void;
      }) => {
        const message = String(body["message"] ?? "");
        const isPanelB = body["skipSystemPrompt"] === true;
        const tree = message.includes("dashboard")
          ? isPanelB
            ? buildPanelBTree("Dashboard baseline")
            : buildFollowupTree(false)
          : isPanelB
            ? INITIAL_B_TREE
            : INITIAL_A_TREE;

        onToken?.(buildAssistantJsonl(tree));
        onPatches(buildPatchOps(tree));
        return isPanelB ? "panel-b-response" : "panel-a-response";
      },
    );

    render(<PlaygroundPage />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build me a counter" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Baseline body")).toBeTruthy();
      expect(screen.getAllByText("build me a counter").length).toBeGreaterThan(
        0,
      );
    });

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "build dashboard" },
    });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(screen.getByText("Dashboard baseline")).toBeTruthy();
      expect(screen.getByText("hello-world")).toBeTruthy();
      expect(screen.getAllByText("build dashboard").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Output history"), {
      target: { value: "1" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Dashboard baseline")).toBeNull();
      expect(screen.queryByText("hello-world")).toBeNull();
      expect(
        screen.getByText("Viewing history. Return to latest to keep editing."),
      ).toBeTruthy();
      expect(screen.getAllByText("build me a counter").length).toBeGreaterThan(
        0,
      );
      expect(screen.queryAllByText("build dashboard")).toHaveLength(0);
    });
  });

  it("captures tool confirmations in history before later panel generations", async () => {
    streamToolConfirmationMock.mockImplementation(
      async (
        _request: unknown,
        callbacks: {
          readonly onTreeUpdate: (tree: UITree) => void;
          readonly onComplete: (tree: UITree) => void;
        },
      ) => {
        const tree = buildConfirmationTree("create-worker-hello-world");
        callbacks.onTreeUpdate(tree);
        callbacks.onComplete(tree);
      },
    );

    render(<PlaygroundPage />);

    fireEvent.click(screen.getByText("Create worker"));

    await waitFor(() => {
      expect(screen.getByText("1/1")).toBeTruthy();
      expect(screen.getByText("Create a new worker now")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Counter"));

    await waitFor(() => {
      expect(screen.getByText("2/2")).toBeTruthy();
      expect(screen.getAllByText("Increment").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Output history"), {
      target: { value: "1" },
    });

    await waitFor(() => {
      expect(screen.getByText("Create a new worker now")).toBeTruthy();
      expect(
        screen.queryByText(
          "Viewing history. Return to latest to keep editing.",
        ),
      ).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Output history"), {
      target: { value: "0" },
    });

    await waitFor(() => {
      expect(
        screen.getByText("Describe the UI you want to generate"),
      ).toBeTruthy();
      expect(screen.queryByText("Create a new worker now")).toBeNull();
    });
  });
});
