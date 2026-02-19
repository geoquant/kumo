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
import {
  Badge,
  Banner,
  Button,
}  from '@cloudflare/kumo';
```

Next, we define a registry constant that maps a string to a component (e.g. “Button” \= Button). Iterate through every component you want to make usable through your loader.

```ts
const REGISTRY: Record<string, any> = {
  Badge,
  Banner,
  Button,
  // ...
}
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
}
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

Talk about how we should handle JSON being streamed back and in most cases an incomplete JSON object in flight that cannot be rendered but we should still render components as we can complete JSON structure.