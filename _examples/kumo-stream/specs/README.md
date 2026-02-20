# kumo-stream Specs

Branch requirement (critical)

- All kumo-stream work for this project must land on the `geoquant/streaming-ui` branch.
- Specs in this directory are written assuming that branch context (history, constraints, existing decisions).

Why

- kumo-stream is a reference impl; branch drift is how we accidentally fork behavior.

How to read these docs

- `_examples/kumo-stream/specs/full-stack-gaps.md` is the umbrella spec for remaining "full stack" work (actions, drift, progressive).

Status

- Active: `_examples/kumo-stream/specs/full-stack-gaps.md`
- Implemented on this branch (kept for context):
  - `_examples/kumo-stream/specs/streaming-patches.md`
  - `_examples/kumo-stream/specs/interactivity-and-exports.md`
  - `_examples/kumo-stream/specs/stateful-actions-components.md`
  - `_examples/kumo-stream/specs/demo-polish.md`
