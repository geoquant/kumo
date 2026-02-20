# Cross-Boundary Generative UI

## User experience guide for streaming interfaces at Cloudflare

## Dynamic Loadable

Rendering a component library typically requires an application to include the contents of said library in its bundle. For applications such as ChatGPT where a user might inquire about a product in Cloudflare, to keep the response on brand with Cloudflare’s we would prefer the response to include our component library. Not for the buttons and inputs necessarily, but for the components that make our product and brand unique – such as the Workflow diagram where we visualize how many steps in a workflow sequence, retry, try/catch, and more.

The challenge here becomes the inability for ChatGPT to include every component library on the planet in their bundle. Instead, it needs to be dynamically referenced and injected just-in-time (JIT).

Proposals could help standardize how products can make their UI’s discoverable and perhaps one version could include specific files living at the domain in a \`.well-known\` folder structure.

```
/.well-known/component-loadable.umd.cjs // or .mjs
/.well-known/component-registry.json
/.well-known/stylesheet.css
```

Three files that come to mind immediately include a JSON structure that AI can parse to understand what components are made available with which props, and a stylesheet that might likely need to be injected alongside the components, and a CJS file that loads the components into the browser to be consumed.

For Kumo in particular I made a version of our loadable that essentially creates a lightweight React application (importing React and Kumo libraries) and then with a \`vite build\` command have it output our \`component-loadable.umd.cjs\` that can be imported then by other websites. Even if a website is written in plain HTML without a framework associated to it at all, our loadable file is battery-included with what it requires to render.

## Component Response

A mechanism needs to exist where AI can consume a list of available components and be capable of responding with a data structure that we can then return UI components from. For example if I were to prompt “Show me a button inside a LayerCard” my expectations would be that AI could construct some JSON structure that would be passable to my \`component-loadable.umd.cjs\` file and within my loadable I could deconstruct that JSON and know precisely how to render my components.

### Internal Registry

Our component loader files first most important task is to import our component library into it so we have access to the individual components. No different than any other project, a simple import does the trick.

```ts
import { Badge, Banner, Button } from "@cloudflare/kumo";
```

Next, we define a registry constant that maps a string to a component (e.g. “Button” \= Button). Iterate through every component you want to make usable through your loader.

```ts
const REGISTRY: Record<string, any> = {
  Badge,
  Banner,
  Button,
  // ...
};
```

### Stateless Components

Basic components do not require state. Such components include Badge, Banner, and Button to name a few. For these it’s quite simple to know how to interpret a JSON structure and respond with a UI component. Rendering a button would require us to pass a string from the JSON (e.g. “button”) and map it to our component we imported from the Kumo library which we have defined in our aforementioned code registry. Same goes for the props that we might pass into the button component like \`variant\` or the text we want to render within it.

```ts
const { component, props } = def;
const Component = REGISTRY[component];
```

From the above we can respond quite trivially with the following and all the props should autofill, assuming the AI responds in a format provided by our hosted \`component-registry.json\` file.

```ts
<Component {...props}>{children}</Component>
```

### Stateful Components

When a component needs to maintain state we can no longer just pass the JSON response into a component to generate it. Instead we need to create a wrapper around our stateful component that can take in props and maintain state as a user interacts with it.

```ts
const REGISTRY: Record<string, any> = {
  Badge,
  Banner,
  Button,
  // ...
  Combobox: StatefulCombobox,
};
```

Our registry entry for stateful components changes a bit, instead of redirecting to the \`Combobox\` import from Kumo for example we instead map it to a custom implementation defined in our loadable as \`StatefulCombobox\`. Really this just tells us we’re going to handle it a bit differently but still pass it the same payload we received from the JSON response of our AI model and we’ll attach it all ourselves, as opposed to how we handled it for stateless components where we just passed it all in and it “just worked”.

```ts
const StatefulCombobox = ({ items, defaultValue, placeholder, label, ...props }: any) => {
  const [value, setValue] = useState<string | null>(defaultValue || null);

  return (
    <Combobox
      value={value}
      onValueChange={(v) => setValue(v as any)}
      items={items}
      {...props}
    >
	// ...
    </Combobox>
  );
};

```

Above is a sample implementation most notably showcasing our \`value\` state we defined. When a user interacts with this component and the value changes, this wrapper implementation allows us to retain the value the user selected which then provides the correct visual representation on screen. Without it a user might make a selection but never see that value shown in the combobox UI element.

Any component where state matters a wrapper implementation will be required and how you handle it and what you include allows the AI user interface to be more aware and able. Because that particular component has specific props

```ts
// Special handling for Combobox (needs items prop passed through)
if (component === 'Combobox') {
  return (
    <ErrorBoundary componentName="Combobox">
      <Component items={items} {...remainingProps} />
    </ErrorBoundary>
  );
}
```

### Error Boundaries

To prevent crashing out and causing the remaining stream of components from rendering, we need to place an ErrorBoundary around each individual component. If a situation where AI were to create a JSON structure that did not include valid props (or missed out on required props altogether) then this boundary would protect us from an application crash and keep it isolated, with the only notable downside of the current component in question being unrendered.

```ts
<ErrorBoundary componentName={component}>
  <Component {...remainingProps}>{nestedChildren}</Component>
</ErrorBoundary>
```

In my code base you can find a class in the \`loadable.tsx\` file named \`ErrorBoundary\` as well that includes more details on its implementation.

## Component Styles

Many component libraries support themes and modes. Modes are often defined as “light” or “dark” to support user preference on component brightness. Themes allow component libraries to apply distinct alterations in their appearance, predominantly in color. You can imagine changing your IDE or command line theme as the same utility here.

### Supporting Modes

For a component to adhere to a specific mode (light or dark) it is commonly wrapped in a root tag that has an attribute applied to it, such as \`data-mode=”light”\` which signals to all children components within it to adhere to that treatment. Since our loadable does not own the entire DOM, instead only the components we return to be rendered, we must wrap each of those components in a div element that applies the correct tag and theme to it.

```ts
<ThemeWrapper initialMode="light">
  <Component {...props}>
    {children}
  </Component>
</ThemeWrapper>

```

But that’s not enough. We need to support theme changing on a website. If a user were to toggle between light and dark mode and these wrapped components did not change that would not be desirable. Now our ThemeWrapper component needs to attach some logic to the window to listen to changes, but here is one of those moments where we would prefer if there was some standardized event that could be emitted from websites so our loader knows how to listen by default. An alternative to predefining an event name such as “model-change”, and/or “theme-change”, is to also allow for the client to pass in the value loadables should listen for in the event of a mode change – explicitly tell loadables what the value they should listen for is.

```ts
const ThemeWrapper = ({ children, initialMode }: { children: React.ReactNode, initialMode: 'light' | 'dark' }) => {
  const [mode, setMode] = useState(initialMode);

  // Attach a listener to the window so the HTML site can trigger a change
  useEffect(() => {
    const handleThemeChange = (e: any) => setMode(e.detail.mode);
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  return (
    <div data-mode={mode} className="kumo-root">
      {children}
    </div>
  );
};

```

## Streaming Responses

Streaming generative UI introduces a core problem: the LLM produces text token-by-token, yet the UI renderer needs complete, structured data. Sending a monolithic JSON blob only after the LLM finishes would mean the user stares at a blank screen for seconds. We need a wire format that lets us render incrementally — showing components as they are defined, not after the entire response is complete.

### Wire Format: JSONL + RFC 6902 JSON Patch

The solution is **JSONL** (newline-delimited JSON) where each line is a self-contained [RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902) JSON Patch operation. Each patch mutates a flat `UITree` structure:

```
{ root: "element-key", elements: { [key]: UIElement } }
```

Where each `UIElement` is:

```
{ key: string, type: string, props: object, children?: string[], parentKey?: string }
```

The LLM emits one patch per line. As each line arrives and is parsed, it produces a valid, renderable tree at every intermediate step. No partial JSON. No waiting for closing braces.

#### Example: A simple card with heading and button

The LLM response (raw text, one JSON object per line):

```jsonl
{"op":"add","path":"/root","value":"card-1"}
{"op":"add","path":"/elements/card-1","value":{"key":"card-1","type":"Surface","props":{},"children":["heading-1","action-btn"]}}
{"op":"add","path":"/elements/heading-1","value":{"key":"heading-1","type":"Text","props":{"children":"Welcome","variant":"heading2"},"parentKey":"card-1"}}
{"op":"add","path":"/elements/action-btn","value":{"key":"action-btn","type":"Button","props":{"children":"Get Started","variant":"primary"},"parentKey":"card-1"}}
```

After line 1, the tree has a root but no elements — nothing renders yet. After line 2, the root element exists (though its children are forward-referenced). After lines 3–4, all elements are present and the full card renders. The renderer checks for missing children gracefully, so intermediate states never crash.

#### Supported Operations

Only three RFC 6902 operations are used (a deliberate subset):

| Operation | Purpose                     | Example                                                                      |
| --------- | --------------------------- | ---------------------------------------------------------------------------- |
| `add`     | Set a new field or element  | `{"op":"add","path":"/elements/btn-1","value":{...}}`                        |
| `replace` | Overwrite an existing value | `{"op":"replace","path":"/elements/btn-1/props/children","value":"Updated"}` |
| `remove`  | Delete a field or element   | `{"op":"remove","path":"/elements/btn-1"}`                                   |

Paths follow [RFC 6901](https://datatracker.ietf.org/doc/html/rfc6901) JSON Pointer syntax:

- `/root` — the tree's root element key
- `/elements/key` — a complete UIElement
- `/elements/key/props/label` — a nested prop within an element
- `/elements/key/children/-` — append to a children array

### SSE Transport (Server → Client)

When proxying through a backend (recommended for production — keeps the API key server-side), responses stream as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-Sent_Events):

```
POST /api/chat
Content-Type: application/json

{ "message": "Show me a button", "history": [] }
```

The server streams SSE frames:

```
data: {"type":"text","delta":"{"}\n\n
data: {"type":"text","delta":"\"op\":\"add\""}\n\n
data: {"type":"text","delta":",\"path\":\"/root\",\"value\":\"btn-1\"}\n"}\n\n
data: {"type":"text","delta":"{"}\n\n
...
data: {"type":"done"}\n\n
```

Each frame carries a `type` discriminant:

| Type    | Payload               | Meaning                                  |
| ------- | --------------------- | ---------------------------------------- |
| `text`  | `{ delta: string }`   | A chunk of streamed text (partial JSONL) |
| `done`  | —                     | Stream completed successfully            |
| `error` | `{ message: string }` | Stream failed                            |

Note that `delta` values are raw text fragments, not complete JSON lines. A single JSONL line may arrive across many `text` frames. This is why the client needs a streaming parser.

### Client-Side Pipeline

The client assembles deltas into patch operations through a three-stage pipeline:

```
SSE text deltas → JSONL Parser → RFC 6902 Applicator → UITree State → Renderer
```

#### Stage 1: JSONL Parser

A stateful parser buffers incoming text chunks and emits parsed patch operations whenever a complete line (terminated by `\n`) is found:

```ts
interface JsonlParser {
  /** Feed a text chunk. Returns parsed patch ops from any complete lines. */
  push(chunk: string): readonly JsonPatchOp[];
  /** Parse whatever remains in the buffer (call on stream end). */
  flush(): readonly JsonPatchOp[];
}

const parser = createJsonlParser();

// As each SSE delta arrives:
const ops = parser.push(delta); // [] if no complete line yet, [op, ...] if lines completed

// When the stream ends:
const remaining = parser.flush(); // Parse any trailing content
```

Empty lines and markdown fences (` ``` `) are silently skipped, making the parser tolerant of minor LLM formatting deviations.

#### Stage 2: Patch Application

Each parsed `JsonPatchOp` is applied to the `UITree` immutably — every `applyPatch` call returns a new tree, never mutating the previous one:

```ts
import { applyPatch, type JsonPatchOp } from "./rfc6902";

function applyPatches(tree: UITree, ops: readonly JsonPatchOp[]): UITree {
  let current = tree;
  for (const op of ops) {
    current = applyPatch(current, op);
  }
  return current;
}
```

This immutability is critical for React rendering — each new tree reference triggers a re-render, showing the latest state of the UI as it streams in.

#### Stage 3: Wiring It Together

In a React application, the full pipeline connects SSE → parser → state → renderer:

```ts
const { tree, applyPatches, reset } = useUITree();
const parser = createJsonlParser();

startStream(config, messages, {
  onText: (delta) => {
    const ops = parser.push(delta);
    if (ops.length > 0) applyPatches(ops);
  },
  onDone: () => {
    const remaining = parser.flush();
    if (remaining.length > 0) applyPatches(remaining);
  },
  onError: (err) => {
    const remaining = parser.flush(); // preserve partial UI
    if (remaining.length > 0) applyPatches(remaining);
  },
});
```

Key behaviors:

- **Incremental rendering**: Components appear on screen as their JSONL lines complete, not when the full response finishes.
- **Graceful partial states**: If a parent references children that haven't arrived yet, the renderer skips them without crashing. They appear once their elements are streamed.
- **Error resilience**: On stream failure, `flush()` parses any remaining buffer so partial UI stays visible rather than disappearing.
- **Multi-turn conversations**: Before starting a new stream, the current tree is snapshot into conversation history and the tree is reset to empty.
