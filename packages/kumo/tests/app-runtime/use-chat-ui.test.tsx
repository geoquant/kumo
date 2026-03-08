import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { APP_SPEC_VERSION, type AppSpec } from "../../src/app-runtime";
import { useChatUI } from "../../src/app-runtime/react";

const sessionSpec: AppSpec = {
  version: APP_SPEC_VERSION,
  root: "root",
  state: {
    form: {
      name: "Ada",
    },
  },
  elements: {
    root: {
      key: "root",
      type: "Stack",
      children: ["field"],
    },
    field: {
      key: "field",
      type: "Input",
      props: {
        value: {
          $bind: {
            source: "state",
            path: "/form/name",
          },
        },
      },
    },
  },
};

describe("useChatUI", () => {
  it("accumulates mixed text and UI updates in one assistant turn", () => {
    const { result } = renderHook(() =>
      useChatUI({ initialSpec: sessionSpec }),
    );

    act(() => {
      result.current.pushUserMessage("Build a profile form");
      result.current.startAssistantTurn({ resetUI: true, spec: sessionSpec });
      result.current.appendAssistantText("Here is ");
      result.current.applyPatch({
        op: "replace",
        path: "/state/form/name",
        value: "Grace",
      });
      result.current.appendAssistantText("your form.");
      result.current.completeAssistantTurn();
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      text: "Here is your form.",
      status: "complete",
      snapshot: {
        state: {
          form: {
            name: "Grace",
          },
        },
      },
    });
    expect(result.current.messages[1]?.spec?.state).toEqual({
      form: {
        name: "Grace",
      },
    });
  });

  it("keeps the latest assistant session in sync after local interactions", () => {
    const { result } = renderHook(() =>
      useChatUI({ initialSpec: sessionSpec }),
    );

    act(() => {
      result.current.startAssistantTurn({ resetUI: true, spec: sessionSpec });
      result.current.completeAssistantTurn();
    });

    act(() => {
      result.current.writeBinding({
        elementKey: "field",
        propPath: "/value",
        value: "Zoe",
      });
    });

    expect(result.current.messages[0]?.snapshot?.state).toEqual({
      form: {
        name: "Zoe",
      },
    });
  });
});
