/* oxlint-disable unicorn/no-thenable */

import {
  Badge,
  Button,
  Checkbox,
  Cluster,
  Input,
  Stack,
  Surface,
  Text,
} from "@cloudflare/kumo";
import {
  useChatUI,
  type JsonPatchOp,
  type UseChatUIReturn,
} from "@cloudflare/kumo/app-runtime/react";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import type { AppSpec } from "@cloudflare/kumo/app-runtime";

const TITLE_VALIDATION_META_PATH = "/validation/~1draft~1title/valid";

const BASE_TASK_SPEC: AppSpec = {
  version: "app/v1",
  root: "app-root",
  state: {
    taskSummary: "Tasks are stored in app state and repeated into the preview.",
    tasks: [
      {
        title: "Ship app runtime docs",
        urgent: true,
        done: false,
        preview: "Preview: Ship app runtime docs",
        assignee: "",
      },
    ],
    draft: {
      title: "",
      urgent: false,
      preview: "Preview appears here",
      hint: "Regular tasks can wait.",
      assignee: "",
    },
  },
  elements: {
    "app-root": {
      key: "app-root",
      type: "Surface",
      children: ["app-stack"],
      watch: [
        {
          path: "/draft/title",
          actions: {
            action: "state.set",
            params: {
              path: "/draft/preview",
              value: {
                $switch: {
                  when: {
                    $compare: {
                      left: {
                        $read: { source: "state", path: "/draft/title" },
                      },
                      op: "neq",
                      right: "",
                    },
                  },
                  then: {
                    $format: [
                      "Preview: ",
                      { $read: { source: "state", path: "/draft/title" } },
                    ],
                  },
                  else: "Preview appears here",
                },
              },
            },
          },
        },
        {
          path: "/draft/urgent",
          actions: {
            action: "state.set",
            params: {
              path: "/draft/hint",
              value: {
                $switch: {
                  when: {
                    $compare: {
                      left: {
                        $read: { source: "state", path: "/draft/urgent" },
                      },
                      op: "eq",
                      right: true,
                    },
                  },
                  then: "Urgent tasks stay pinned in triage.",
                  else: "Regular tasks can wait.",
                },
              },
            },
          },
        },
        {
          path: "/tasks",
          actions: {
            action: "state.set",
            params: {
              path: "/taskSummary",
              value: "Task list changed from an AppSpec watcher.",
            },
          },
        },
      ],
    },
    "app-stack": {
      key: "app-stack",
      type: "Stack",
      props: { gap: "lg" },
      children: ["intro-stack", "form-surface", "tasks-surface"],
    },
    "intro-stack": {
      key: "intro-stack",
      type: "Stack",
      props: { gap: "sm" },
      children: ["intro-title", "intro-copy", "summary-text"],
    },
    "intro-title": {
      key: "intro-title",
      type: "Text",
      props: {
        children: "Task CRUD + forms via AppSpec",
        variant: "heading2",
      },
    },
    "intro-copy": {
      key: "intro-copy",
      type: "Text",
      props: {
        children:
          "This scripted chat uses AppSpec state, repeat, validation, and watchers. Add a task, then apply the follow-up turn to reveal assignees.",
        variant: "secondary",
      },
    },
    "summary-text": {
      key: "summary-text",
      type: "Text",
      props: {
        children: { $read: { source: "state", path: "/taskSummary" } },
        variant: "body",
      },
    },
    "form-surface": {
      key: "form-surface",
      type: "Surface",
      children: ["form-stack"],
    },
    "form-stack": {
      key: "form-stack",
      type: "Stack",
      props: { gap: "sm" },
      children: [
        "draft-title",
        "draft-urgent",
        "draft-preview",
        "draft-hint",
        "action-cluster",
      ],
    },
    "draft-title": {
      key: "draft-title",
      type: "Input",
      props: {
        label: "Task title",
        placeholder: "Add a runtime doc checklist item",
        value: { $bind: { source: "state", path: "/draft/title" } },
      },
      validation: {
        path: "/draft/title",
        mode: ["change", "blur", "submit"],
        rules: [
          {
            type: "required",
            message: "Give the task a title before adding it.",
          },
        ],
      },
    },
    "draft-urgent": {
      key: "draft-urgent",
      type: "Checkbox",
      props: {
        label: "Mark as urgent",
        checked: { $bind: { source: "state", path: "/draft/urgent" } },
      },
    },
    "draft-preview": {
      key: "draft-preview",
      type: "Text",
      props: {
        children: { $read: { source: "state", path: "/draft/preview" } },
        variant: "secondary",
      },
    },
    "draft-hint": {
      key: "draft-hint",
      type: "Text",
      props: {
        children: { $read: { source: "state", path: "/draft/hint" } },
        variant: "secondary",
      },
    },
    "action-cluster": {
      key: "action-cluster",
      type: "Cluster",
      props: { gap: "sm" },
      children: ["add-task", "clear-draft"],
    },
    "add-task": {
      key: "add-task",
      type: "Button",
      props: { children: "Add task", variant: "primary" },
      events: {
        press: [
          {
            action: "form.validate",
            params: { path: "/draft/title" },
          },
          {
            action: "list.append",
            when: {
              $compare: {
                left: {
                  $read: { source: "meta", path: TITLE_VALIDATION_META_PATH },
                },
                op: "eq",
                right: true,
              },
            },
            params: {
              path: "/tasks",
              value: {
                title: { $read: { source: "state", path: "/draft/title" } },
                urgent: { $read: { source: "state", path: "/draft/urgent" } },
                done: false,
                preview: { $read: { source: "state", path: "/draft/preview" } },
                assignee: {
                  $read: { source: "state", path: "/draft/assignee" },
                },
              },
            },
          },
          {
            action: "state.set",
            when: {
              $compare: {
                left: {
                  $read: { source: "meta", path: TITLE_VALIDATION_META_PATH },
                },
                op: "eq",
                right: true,
              },
            },
            params: { path: "/draft/title", value: "" },
          },
          {
            action: "state.set",
            when: {
              $compare: {
                left: {
                  $read: { source: "meta", path: TITLE_VALIDATION_META_PATH },
                },
                op: "eq",
                right: true,
              },
            },
            params: { path: "/draft/urgent", value: false },
          },
          {
            action: "state.set",
            when: {
              $compare: {
                left: {
                  $read: { source: "meta", path: TITLE_VALIDATION_META_PATH },
                },
                op: "eq",
                right: true,
              },
            },
            params: { path: "/draft/assignee", value: "" },
          },
        ],
      },
    },
    "clear-draft": {
      key: "clear-draft",
      type: "Button",
      props: { children: "Clear", variant: "outline" },
      events: {
        press: [
          {
            action: "form.clear",
            params: { paths: ["/draft/title", "/draft/assignee"] },
          },
          {
            action: "state.set",
            params: { path: "/draft/urgent", value: false },
          },
        ],
      },
    },
    "tasks-surface": {
      key: "tasks-surface",
      type: "Surface",
      children: ["tasks-stack"],
    },
    "tasks-stack": {
      key: "tasks-stack",
      type: "Stack",
      props: { gap: "sm" },
      children: ["tasks-heading", "task-row-template"],
    },
    "tasks-heading": {
      key: "tasks-heading",
      type: "Text",
      props: { children: "Queued tasks", variant: "heading3" },
    },
    "task-row-template": {
      key: "task-row-template",
      type: "Surface",
      repeat: {
        source: { source: "state", path: "/tasks" },
      },
      children: ["task-row-stack"],
    },
    "task-row-stack": {
      key: "task-row-stack",
      type: "Stack",
      props: { gap: "sm" },
      children: ["task-row-header", "task-row-preview", "task-row-actions"],
    },
    "task-row-header": {
      key: "task-row-header",
      type: "Cluster",
      props: { gap: "sm" },
      children: ["task-row-title", "task-row-badge", "task-row-status"],
    },
    "task-row-title": {
      key: "task-row-title",
      type: "Text",
      props: {
        children: { $read: { source: "item", path: "/title" } },
        variant: "heading3",
      },
    },
    "task-row-badge": {
      key: "task-row-badge",
      type: "Badge",
      visible: {
        $compare: {
          left: { $read: { source: "item", path: "/urgent" } },
          op: "eq",
          right: true,
        },
      },
      props: { children: "Urgent", variant: "primary" },
    },
    "task-row-status": {
      key: "task-row-status",
      type: "Text",
      props: {
        children: {
          $switch: {
            when: {
              $compare: {
                left: { $read: { source: "item", path: "/done" } },
                op: "eq",
                right: true,
              },
            },
            then: "Done",
            else: "Open",
          },
        },
        variant: {
          $switch: {
            when: {
              $compare: {
                left: { $read: { source: "item", path: "/done" } },
                op: "eq",
                right: true,
              },
            },
            then: "success",
            else: "secondary",
          },
        },
      },
    },
    "task-row-preview": {
      key: "task-row-preview",
      type: "Text",
      props: {
        children: { $read: { source: "item", path: "/preview" } },
        variant: "secondary",
      },
    },
    "task-row-actions": {
      key: "task-row-actions",
      type: "Cluster",
      props: { gap: "sm" },
      children: ["task-row-toggle", "task-row-remove"],
    },
    "task-row-toggle": {
      key: "task-row-toggle",
      type: "Button",
      props: {
        children: {
          $switch: {
            when: {
              $compare: {
                left: { $read: { source: "item", path: "/done" } },
                op: "eq",
                right: true,
              },
            },
            then: "Reopen",
            else: "Complete",
          },
        },
        variant: "outline",
      },
      events: {
        press: {
          action: "state.toggle",
          params: {
            path: {
              $format: ["/tasks/", { $read: { source: "index" } }, "/done"],
            },
          },
        },
      },
    },
    "task-row-remove": {
      key: "task-row-remove",
      type: "Button",
      props: { children: "Remove", variant: "outline" },
      events: {
        press: {
          action: "list.remove",
          params: {
            path: "/tasks",
            index: { $read: { source: "index" } },
          },
        },
      },
    },
  },
};

const FOLLOW_UP_PATCHES: readonly JsonPatchOp[] = [
  {
    op: "add",
    path: "/elements/field-assignee",
    value: {
      key: "field-assignee",
      type: "Input",
      props: {
        label: "Assignee",
        placeholder: "Taylor",
        value: { $bind: { source: "state", path: "/draft/assignee" } },
      },
    },
  },
  {
    op: "add",
    path: "/elements/form-stack/children/2",
    value: "field-assignee",
  },
  {
    op: "add",
    path: "/elements/task-row-assignee",
    value: {
      key: "task-row-assignee",
      type: "Text",
      visible: {
        $compare: {
          left: { $read: { source: "item", path: "/assignee" } },
          op: "neq",
          right: "",
        },
      },
      props: {
        children: {
          $format: [
            "Owner: ",
            { $read: { source: "item", path: "/assignee" } },
          ],
        },
        variant: "secondary",
      },
    },
  },
  {
    op: "add",
    path: "/elements/task-row-stack/children/2",
    value: "task-row-assignee",
  },
  {
    op: "replace",
    path: "/state/draft/assignee",
    value: "Taylor",
  },
  {
    op: "replace",
    path: "/state/taskSummary",
    value: "Follow-up turn added assignees and seeded new draft state.",
  },
];

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readGap(value: unknown): "sm" | "base" | "lg" | undefined {
  return value === "sm" || value === "base" || value === "lg"
    ? value
    : undefined;
}

function readTextVariant(
  value: unknown,
): "heading2" | "heading3" | "body" | "secondary" | "success" | undefined {
  return value === "heading2" ||
    value === "heading3" ||
    value === "body" ||
    value === "secondary" ||
    value === "success"
    ? value
    : undefined;
}

function readButtonVariant(value: unknown): "primary" | "outline" | undefined {
  return value === "primary" || value === "outline" ? value : undefined;
}

function readBadgeVariant(value: unknown): "primary" | undefined {
  return value === "primary" ? value : undefined;
}

function AppRuntimeNode({
  elementKey,
  runtime,
}: {
  readonly elementKey: string;
  readonly runtime: UseChatUIReturn;
}): ReactNode {
  const resolved = runtime.resolveElement(elementKey);
  if (resolved == null || !resolved.visible) {
    return null;
  }

  const { element, props } = resolved;
  const children = (element.children ?? []).map((childKey) => (
    <AppRuntimeNode key={childKey} elementKey={childKey} runtime={runtime} />
  ));

  switch (element.type) {
    case "Surface":
      return <Surface>{children}</Surface>;
    case "Stack":
      return <Stack gap={readGap(props.gap)}>{children}</Stack>;
    case "Cluster":
      return <Cluster gap={readGap(props.gap)}>{children}</Cluster>;
    case "Text":
      return (
        <Text variant={readTextVariant(props.variant)}>
          {readString(props.children) ?? ""}
        </Text>
      );
    case "Badge":
      return (
        <Badge variant={readBadgeVariant(props.variant)}>
          {readString(props.children) ?? ""}
        </Badge>
      );
    case "Button":
      return (
        <Button
          variant={readButtonVariant(props.variant)}
          onClick={() => {
            runtime.dispatchEvent({ elementKey, event: "press" });
          }}
        >
          {readString(props.children) ?? ""}
        </Button>
      );
    case "Input": {
      const error = runtime.snapshot.meta.validation["/draft/title"]?.errors[0];
      return (
        <Input
          label={readString(props.label) ?? undefined}
          placeholder={readString(props.placeholder) ?? undefined}
          value={readString(props.value) ?? ""}
          error={elementKey === "draft-title" ? error : undefined}
          onChange={(event) => {
            runtime.writeBinding({
              elementKey,
              propPath: "/value",
              value: event.target.value,
            });
          }}
          onBlur={() => {
            runtime.dispatchEvent({ elementKey, event: "blur" });
          }}
        />
      );
    }
    case "Checkbox":
      return (
        <Checkbox
          label={readString(props.label) ?? ""}
          checked={readBoolean(props.checked)}
          onCheckedChange={(checked) => {
            runtime.writeBinding({
              elementKey,
              propPath: "/checked",
              value: checked,
            });
          }}
        />
      );
    default:
      return null;
  }
}

function startStarterTurn(runtime: UseChatUIReturn): void {
  runtime.clear();
  runtime.pushUserMessage(
    "Build a task CRUD board with validation, repeat, and watchers.",
  );
  runtime.startAssistantTurn({ resetUI: true });
  runtime.appendAssistantText(
    "Added a task board that binds form state into an AppSpec-powered preview.",
  );
  runtime.setSpec(BASE_TASK_SPEC);
  runtime.completeAssistantTurn();
}

function applyFollowUpTurn(runtime: UseChatUIReturn): void {
  runtime.pushUserMessage(
    "Add assignee support and keep the draft synced across the follow-up turn.",
  );
  runtime.startAssistantTurn();
  runtime.appendAssistantText(
    "Follow-up patches added assignee inputs and seeded the next draft owner.",
  );
  runtime.applyPatches(FOLLOW_UP_PATCHES);
  runtime.completeAssistantTurn();
}

export function AppRuntimeTaskCrudDemo() {
  const runtime = useChatUI();
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) {
      return;
    }

    seededRef.current = true;
    startStarterTurn(runtime);
  }, [runtime]);

  const followUpApplied = useMemo(
    () => runtime.messages.length >= 4,
    [runtime.messages.length],
  );

  const handleReset = useCallback(() => {
    seededRef.current = true;
    startStarterTurn(runtime);
  }, [runtime]);

  const handleFollowUp = useCallback(() => {
    if (followUpApplied) {
      return;
    }

    applyFollowUpTurn(runtime);
  }, [followUpApplied, runtime]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Surface>
        <Stack gap="lg">
          <Cluster gap="sm">
            <Button
              variant="primary"
              onClick={handleFollowUp}
              disabled={followUpApplied}
            >
              {followUpApplied ? "Follow-up applied" : "Apply follow-up turn"}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset scripted chat
            </Button>
          </Cluster>

          <Stack gap="sm">
            {runtime.messages.map((message) => (
              <Surface key={message.id}>
                <Stack gap="sm">
                  <Cluster gap="sm">
                    <Badge
                      variant={
                        message.role === "assistant" ? "primary" : undefined
                      }
                    >
                      {message.role}
                    </Badge>
                    <Text variant="secondary">{message.status}</Text>
                  </Cluster>
                  <Text>{message.text}</Text>
                </Stack>
              </Surface>
            ))}
          </Stack>
        </Stack>
      </Surface>

      <Stack gap="lg">
        <AppRuntimeNode elementKey={runtime.expanded.root} runtime={runtime} />

        <Surface>
          <Stack gap="sm">
            <Text variant="heading3">App state snapshot</Text>
            <pre className="overflow-x-auto rounded-lg bg-kumo-recessed p-3 text-xs text-kumo-default">
              {JSON.stringify(runtime.snapshot.state, null, 2)}
            </pre>
          </Stack>
        </Surface>
      </Stack>
    </div>
  );
}
