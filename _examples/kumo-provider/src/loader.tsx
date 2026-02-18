import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  Checkbox,
  ClipboardText,
  CloudflareLogo,
  Code,
  Collapsible,
  Combobox,
  CommandPalette,
  Dialog,
  DropdownMenu,
  Empty,
  Field,
  Grid,
  Input,
  InputArea,
  Label,
  LayerCard,
  Link,
  Loader,
  Meter,
  Pagination,
  Popover,
  Radio,
  Select,
  SensitiveInput,
  SkeletonLine,
  Surface,
  Switch,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@cloudflare/kumo';
import '@cloudflare/kumo/styles/standalone';

/**
 * Stateful wrapper for Combobox that manages internal state.
 * This allows Combobox to work with JSON definitions without external state management.
 * 
 * Supports both formats:
 * - Simple strings: ["Apple", "Banana", "Cherry"]
 * - Objects: [{label: "Apple", value: "apple"}, {label: "Banana", value: "banana"}]
 */
const StatefulCombobox = ({ items, defaultValue, placeholder, label, ...props }: any) => {
  const [value, setValue] = useState<string | null>(defaultValue || null);
  
  console.log('[StatefulCombobox] Rendering with', items?.length || 0, 'items, value:', value);
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn('[StatefulCombobox] Missing or empty "items" array');
    return null;
  }

  // Normalize items to string array
  // If items are objects with {label, value}, extract the values
  // Otherwise, use items as-is (assume they're already strings)
  const normalizedItems = items.map((item: any) => {
    if (typeof item === 'object' && item !== null) {
      // If it's an object, try to extract value or label
      return item.value || item.label || String(item);
    }
    return String(item);
  });

  return (
    <Combobox 
      value={value} 
      onValueChange={(v) => setValue(v as any)} 
      items={normalizedItems}
      {...props}
    >
      <Combobox.TriggerInput placeholder={placeholder || "Please select"} label={label} />
      <Combobox.Content>
        <Combobox.Empty />
        <Combobox.List>
          {(item: string) => (
            <Combobox.Item key={item} value={item}>
              {item}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Content>
    </Combobox>
  );
};

/**
 * Stateful wrapper for Dialog that manages internal open/close state.
 * This allows Dialog to work with JSON definitions without external state management.
 */
const StatefulDialog = ({ 
  trigger, 
  title, 
  description, 
  children, 
  size = "base",
  variant = "default",
  actions,
  defaultOpen = false,
  ...props 
}: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  console.log('[StatefulDialog] Rendering, open:', isOpen);

  // Determine if this is a destructive/alert dialog
  const isDestructive = variant === "destructive" || variant === "alert";

  return (
    <Dialog.Root 
      open={isOpen} 
      onOpenChange={setIsOpen}
      disablePointerDismissal={isDestructive}
    >
      <Dialog.Trigger render={(p) => (
        <Button {...p} variant={isDestructive ? "destructive" : "primary"}>
          {trigger || "Open Dialog"}
        </Button>
      )} />
      <Dialog className="p-8" size={size} {...props}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <Dialog.Title className="text-2xl font-semibold">
            {title || "Dialog"}
          </Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            render={(closeProps) => (
              <Button
                {...closeProps}
                variant="secondary"
                shape="square"
                icon={<span>×</span>}
              />
            )}
          />
        </div>
        {description && (
          <Dialog.Description className="text-kumo-subtle">
            {description}
          </Dialog.Description>
        )}
        {children && (
          <div className="mt-4">
            {typeof children === 'string' ? children : children}
          </div>
        )}
        {actions && actions.length > 0 && (
          <div className="mt-8 flex justify-end gap-2">
            {actions.map((action: any, index: number) => (
              <Dialog.Close
                key={index}
                render={(closeProps) => (
                  <Button 
                    {...closeProps} 
                    variant={action.variant || "secondary"}
                  >
                    {action.label || action.children}
                  </Button>
                )}
              />
            ))}
          </div>
        )}
      </Dialog>
    </Dialog.Root>
  );
};

/**
 * Stateful wrapper for Popover that manages internal open/close state.
 * Simpler than Dialog - just shows content in a floating popup.
 */
const StatefulPopover = ({ 
  trigger, 
  title, 
  description, 
  children,
  side = "bottom",
  ...props 
}: any) => {
  console.log('[StatefulPopover] Rendering');

  return (
    <Popover>
      <Popover.Trigger asChild>
        <Button>{trigger || "Open"}</Button>
      </Popover.Trigger>
      <Popover.Content side={side} {...props}>
        {title && <Popover.Title>{title}</Popover.Title>}
        {description && <Popover.Description>{description}</Popover.Description>}
        {children && (
          <div className="mt-3">
            {typeof children === 'string' ? children : children}
          </div>
        )}
      </Popover.Content>
    </Popover>
  );
};

/**
 * Stateful wrapper for DropdownMenu that manages menu items from JSON array.
 * Supports simple menu items with labels and optional variants.
 */
const StatefulDropdown = ({ 
  trigger, 
  items = [],
  ...props 
}: any) => {
  console.log('[StatefulDropdown] Rendering with', items.length, 'items');
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn('[StatefulDropdown] Missing or empty "items" array');
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger render={<Button>{trigger || "Menu"}</Button>} />
      <DropdownMenu.Content>
        {items.map((item: any, index: number) => {
          // Support separator
          if (item.type === 'separator') {
            return <DropdownMenu.Separator key={index} />;
          }
          
          // Support label/group header
          if (item.type === 'label') {
            return <DropdownMenu.Label key={index}>{item.label}</DropdownMenu.Label>;
          }
          
          // Regular menu item
          return (
            <DropdownMenu.Item 
              key={index}
              variant={item.variant || "default"}
            >
              {item.label || item.children}
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

/**
 * Stateful wrapper for CommandPalette that manages search and open state.
 * Simplified version for JSON - uses flat items array with basic search.
 */
const StatefulCommandPalette = ({ 
  trigger,
  items = [],
  placeholder = "Search...",
  groups,
  renderTrigger = true,
  onOpenChange: externalOnOpenChange,
  ...props 
}: any) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  console.log('[StatefulCommandPalette] Rendering with', items?.length || 0, 'items');
  
  // Support both flat items and grouped items
  const commandItems = groups || items;
  
  if (!commandItems || (Array.isArray(commandItems) && commandItems.length === 0)) {
    console.warn('[StatefulCommandPalette] Missing or empty items/groups array');
    return null;
  }

  // Helper to convert item to string for filtering
  const itemToStringValue = (item: any) => {
    if (typeof item === 'string') return item;
    return item.title || item.label || item.value || '';
  };

  // For grouped items
  const isGrouped = groups && Array.isArray(groups) && groups[0]?.items;

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (externalOnOpenChange) {
      externalOnOpenChange(newOpen);
    }
  };

  // Expose open function for external control
  // Store in a ref accessible via props
  React.useEffect(() => {
    if (props._openRef) {
      props._openRef.current = () => setOpen(true);
    }
  }, [props._openRef]);

  const paletteContent = (
    <CommandPalette.Root
        open={open}
        onOpenChange={handleOpenChange}
        items={commandItems}
        value={search}
        onValueChange={setSearch}
        itemToStringValue={itemToStringValue}
        getSelectableItems={(items) => {
          if (isGrouped) {
            return items.flatMap((group: any) => group.items || []);
          }
          return items;
        }}
        onSelect={(item: any) => {
          console.log('[CommandPalette] Selected:', item);
          setOpen(false);
        }}
        {...props}
      >
        <CommandPalette.Input placeholder={placeholder} />
        <CommandPalette.List>
          <CommandPalette.Results>
            {isGrouped ? (
              // Grouped rendering
              (group: any) => (
                <CommandPalette.Group key={group.label}>
                  <CommandPalette.GroupLabel>{group.label}</CommandPalette.GroupLabel>
                  <CommandPalette.Items>
                    {(item: any) => (
                      <CommandPalette.Item 
                        key={item.id || item.title} 
                        value={item}
                        onClick={() => setOpen(false)}
                      >
                        {item.title || item.label}
                      </CommandPalette.Item>
                    )}
                  </CommandPalette.Items>
                </CommandPalette.Group>
              )
            ) : (
              // Flat rendering
              (item: any) => (
                <CommandPalette.Item 
                  key={item.id || item.title || item} 
                  value={item}
                  onClick={() => setOpen(false)}
                >
                  {itemToStringValue(item)}
                </CommandPalette.Item>
              )
            )}
          </CommandPalette.Results>
          <CommandPalette.Empty>No results found</CommandPalette.Empty>
        </CommandPalette.List>
      </CommandPalette.Root>
  );

  // If renderTrigger is true and we have a trigger, show the button
  if (renderTrigger && trigger) {
    return (
      <>
        <Button onClick={() => setOpen(true)}>{trigger}</Button>
        {paletteContent}
      </>
    );
  }

  // Otherwise just return the palette (can be controlled externally)
  return paletteContent;
};

/**
 * Wrapper component for Button + CommandPalette integration.
 * This allows Button to control CommandPalette without nested buttons.
 */
const ButtonWithCommandPalette = ({ buttonProps, paletteProps, buttonText }: any) => {
  const openRef = React.useRef<(() => void) | null>(null);
  
  return (
    <>
      <ErrorBoundary componentName="Button">
        <Button {...buttonProps} onClick={() => openRef.current?.()}>
          {buttonText || paletteProps.trigger || 'Open'}
        </Button>
      </ErrorBoundary>
      <ErrorBoundary componentName="CommandPalette">
        <StatefulCommandPalette 
          {...paletteProps} 
          renderTrigger={false} 
          _openRef={openRef} 
        />
      </ErrorBoundary>
    </>
  );
};

const REGISTRY: Record<string, any> = {
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  Checkbox,
  ClipboardText,
  CloudflareLogo,
  Code,
  Collapsible,
  Combobox: StatefulCombobox,
  CommandPalette: StatefulCommandPalette,
  Dialog: StatefulDialog,
  DropdownMenu: StatefulDropdown,
  Empty,
  Field,
  Grid,
  Input,
  InputArea,
  Label,
  LayerCard,
  Link,
  Loader,
  Meter,
  Pagination,
  Popover: StatefulPopover,
  Radio,
  Select,
  SensitiveInput,
  SkeletonLine,
  Surface,
  Switch,
  Table,
  Tabs,
  Text,
  Tooltip,
};

/**
 * Recursive helper to turn JSON definitions (string, object, or array) 
 * into actual React elements.
 */
const createKumoElement = (def: any): React.ReactNode => {
  // 1. Handle null/undefined
  if (def === null || def === undefined) return null;
  
  // 2. Handle plain text/numbers/booleans
  if (typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean') {
    return String(def);
  }
  
  // 3. Handle Arrays (Enables stacking multiple components in one slot)
  if (Array.isArray(def)) {
    console.log('[createKumoElement] Rendering array with', def.length, 'items');
    return (
      <>
        {def.map((childDef, index) => {
          console.log('[createKumoElement] Rendering array item', index, childDef);
          const childElement = createKumoElement(childDef);
          
          // Wrap each array item in its own ErrorBoundary
          // This prevents one bad component from breaking all siblings
          return (
            <ErrorBoundary key={index} componentName={childDef?.component || `Item ${index}`}>
              {childElement}
            </ErrorBoundary>
          );
        })}
      </>
    );
  }

  // 4. Handle Component Objects
  if (def && typeof def === 'object' && def.component) {
    try {
      const { component, props } = def;
      const Component = REGISTRY[component];
      
      if (!Component) {
        console.warn(`Component "${component}" not found in Kumo Registry.`);
        return null;
      }
      
      // Log component being rendered with its props for debugging
      console.log(`[Rendering] ${component}`, props);

      // Ensure props is an object
      const safeProps = props || {};
      
    // Extract special props
    const { options, primary, secondary, children, primaryClassName, items, rows, columns, tabs, content, links, headers, data, ...remainingProps } = safeProps;

    // Special handling for Select component with options
    if (component === 'Select') {
      if (!options || !Array.isArray(options) || options.length === 0) {
        console.warn(`[Select] Missing or empty "options" array. Skipping render to prevent crash.`);
        return null;
      }
      
      // Validate and convert options
      const selectChildren = options.map((opt: any, index: number) => {
        if (!opt || typeof opt !== 'object') {
          console.warn('[Select] Invalid option:', opt);
          return null;
        }
        if (!opt.value || !opt.label) {
          console.warn('[Select] Option missing value or label:', opt);
          return null;
        }
        return (
          <Select.Option key={opt.value || index} value={opt.value}>
            {String(opt.label)}
          </Select.Option>
        );
      }).filter(Boolean);
      
      if (selectChildren.length === 0) {
        console.warn('[Select] No valid options after validation. Skipping render.');
        return null;
      }
      
      return (
        <ErrorBoundary componentName="Select">
          <Component {...remainingProps}>{selectChildren}</Component>
        </ErrorBoundary>
      );
    }

    // Special handling for LayerCard component
    if (component === 'LayerCard') {
      const primaryClass = primaryClassName || "flex flex-col gap-4";
      console.log('[LayerCard] Rendering with primary:', primary);
      
      // Don't wrap LayerCard in ErrorBoundary - children will be wrapped individually
      return (
        <Component {...remainingProps}>
          {secondary && (
            <LayerCard.Secondary>
              {createKumoElement(secondary)}
            </LayerCard.Secondary>
          )}
          {primary && (
            <LayerCard.Primary className={primaryClass}>
              {createKumoElement(primary)}
            </LayerCard.Primary>
          )}
        </Component>
      );
    }

    // Special handling for Radio component with items
    // Radio requires Radio.Group wrapper with Radio.Item children
    if (component === 'Radio') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        console.warn(`[Radio] Missing or empty "items" array. Skipping render to prevent crash.`);
        return null;
      }
      
      console.log('[Radio] Items:', JSON.stringify(items, null, 2));
      
      // Validate each item has required properties
      const validItems = items.filter((item: any) => {
        if (!item || typeof item !== 'object') {
          console.warn('[Radio] Invalid item (not an object):', item);
          return false;
        }
        if (!item.value) {
          console.warn('[Radio] Item missing "value" property:', item);
          return false;
        }
        if (!item.label) {
          console.warn('[Radio] Item missing "label" property:', item);
          return false;
        }
        // Check if label is an object (React error #130)
        if (typeof item.label === 'object') {
          console.warn('[Radio] Item has object as label (must be string):', item);
          console.warn('[Radio] Label value:', item.label);
          return false;
        }
        return true;
      });
      
      if (validItems.length === 0) {
        console.warn('[Radio] No valid items after validation. Skipping render.');
        return null;
      }
      
      const radioChildren = validItems.map((item: any) => (
        <Radio.Item key={item.value} value={item.value} label={String(item.label)} />
      ));
      
      // Use Radio.Group as the wrapper component
      const { legend, ...radioGroupProps } = remainingProps;
      
      return (
        <ErrorBoundary componentName="Radio">
          <Radio.Group legend={legend || "Choose option"} {...radioGroupProps}>
            {radioChildren}
          </Radio.Group>
        </ErrorBoundary>
      );
    }

    // Special handling for Checkbox.Group with items
    if (component === 'Checkbox' && items) {
      const checkboxChildren = items.map((item: any) => (
        <Checkbox.Item key={item.value} value={item.value} label={item.label} />
      ));
      return <Checkbox.Group {...remainingProps}>{checkboxChildren}</Checkbox.Group>;
    }

    // Special handling for Combobox (needs items prop passed through)
    if (component === 'Combobox') {
      return (
        <ErrorBoundary componentName="Combobox">
          <Component items={items} {...remainingProps} />
        </ErrorBoundary>
      );
    }

    // Special handling for Tabs component with tabs array
    // Tabs just needs the tabs array prop and passes through
    // Example: {component: 'Tabs', props: {tabs: [{label: 'Tab 1', value: 'tab1'}], selectedValue: 'tab1'}}
    if (component === 'Tabs') {
      if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
        console.warn('[Tabs] Missing or empty "tabs" array. Skipping render.');
        return null;
      }
      return (
        <ErrorBoundary componentName="Tabs">
          <Component tabs={tabs} {...remainingProps} />
        </ErrorBoundary>
      );
    }

    // Special handling for Collapsible component
    // Collapsible just needs label prop and children content
    // Example: {component: 'Collapsible', props: {label: 'Click to expand', children: 'Hidden content'}}
    if (component === 'Collapsible') {
      const { label, onOpenChange, ...otherProps } = remainingProps;
      if (!label) {
        console.warn('[Collapsible] Missing "label" prop. Skipping render.');
        return null;
      }
      
      // Provide default no-op callback if not provided
      const handleOpenChange = onOpenChange || (() => {});
      
      return (
        <ErrorBoundary componentName="Collapsible">
          <Component label={label} onOpenChange={handleOpenChange} {...otherProps}>
            {createKumoElement(children)}
          </Component>
        </ErrorBoundary>
      );
    }

      // Special handling for Breadcrumbs with links array
      // Example: {component: 'Breadcrumbs', props: {links: [{label: 'Home', href: '#'}, {label: 'Products', href: '#'}], current: 'Current Page'}}
      if (component === 'Breadcrumbs' && (links || current)) {
        const { links, current, ...remainingProps } = props;
        const breadcrumbLinks = links || [];
        
        return (
          <ErrorBoundary componentName="Breadcrumbs">
            <Breadcrumbs {...remainingProps}>
              {breadcrumbLinks.map((link: any, index: number) => (
                <React.Fragment key={index}>
                  <Breadcrumbs.Link href={link.href}>
                    {link.label || link.children}
                  </Breadcrumbs.Link>
                  <Breadcrumbs.Separator />
                </React.Fragment>
              ))}
              {current && (
                <Breadcrumbs.Current>
                  {current}
                </Breadcrumbs.Current>
              )}
            </Breadcrumbs>
          </ErrorBoundary>
        );
      }

      // Special handling for Table with headers and rows
      // Example: {component: 'Table', props: {headers: ['Name', 'Email'], rows: [['John', 'john@ex.com']]}}
      if (component === 'Table') {
        if (!headers || !Array.isArray(headers) || headers.length === 0) {
          console.warn('[Table] Missing or empty "headers" array');
          return null;
        }
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          console.warn('[Table] Missing or empty "rows" array');
          return null;
        }
        
        console.log('[Table] Rendering with', headers.length, 'headers and', rows.length, 'rows');
        
        return (
          <ErrorBoundary componentName="Table">
            <Table {...remainingProps}>
              <Table.Header>
                <Table.Row>
                  {headers.map((header: any, i: number) => (
                    <Table.Head key={i}>{String(header)}</Table.Head>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row: any, rowIndex: number) => (
                  <Table.Row key={rowIndex}>
                    {Array.isArray(row) ? (
                      row.map((cell: any, cellIndex: number) => (
                        <Table.Cell key={cellIndex}>
                          {typeof cell === 'string' || typeof cell === 'number' 
                            ? String(cell) 
                            : createKumoElement(cell)}
                        </Table.Cell>
                      ))
                    ) : (
                      <Table.Cell>Invalid row data</Table.Cell>
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </ErrorBoundary>
        );
      }

      // Special handling for Pagination (skip setPage callback since we can't handle it in JSON)
      // Example: {component: 'Pagination', props: {page: 1, perPage: 10, totalCount: 100}}
      if (component === 'Pagination') {
        // Provide a no-op setPage function since it's required but we can't handle callbacks
        const noop = () => console.log('[Pagination] Page change clicked but no handler available');
        return (
          <ErrorBoundary componentName="Pagination">
            <Component setPage={noop} {...remainingProps} />
          </ErrorBoundary>
        );
      }

      // Special handling for Button with CommandPalette
      // Check both children and onClick (AI sometimes puts it in onClick)
      const paletteInChildren = children && typeof children === 'object' && children.component === 'CommandPalette';
      const paletteInOnClick = remainingProps.onClick && typeof remainingProps.onClick === 'object' && remainingProps.onClick.component === 'CommandPalette';
      
      if (component === 'Button' && (paletteInChildren || paletteInOnClick)) {
        console.log('[Button+CommandPalette] Detected Button with CommandPalette');
        
        const paletteProps = paletteInChildren ? children.props : remainingProps.onClick.props;
        const buttonText = paletteInChildren 
          ? (paletteProps.trigger || 'Open') 
          : (children || paletteProps.trigger || 'Open');
        
        // Remove onClick from remainingProps if it contains CommandPalette
        const { onClick, ...cleanButtonProps } = remainingProps;
        
        return (
          <ButtonWithCommandPalette 
            buttonProps={cleanButtonProps}
            paletteProps={paletteProps}
            buttonText={buttonText}
          />
        );
      }

      // Special validation for components that require specific props
      // Grid requires children to be valid React nodes
      if (component === 'Grid' && (!children || (Array.isArray(children) && children.length === 0))) {
        console.warn(`[Grid] Empty or missing children. Grid requires child elements.`);
        return <Component {...remainingProps}><div style={{padding: '20px', color: '#999'}}>Empty Grid</div></Component>;
      }
      
      // Default handling for other components
      let nestedChildren = children ? createKumoElement(children) : null;
      
      // Validate that nestedChildren is not a plain object (React error #130)
      if (nestedChildren !== null && 
          typeof nestedChildren === 'object' && 
          !React.isValidElement(nestedChildren) && 
          !Array.isArray(nestedChildren)) {
        console.error(`[${component}] Invalid children - received plain object:`, nestedChildren);
        console.error(`Original children prop:`, children);
        return <Component {...remainingProps}></Component>;
      }
      
      // Wrap each component in its own ErrorBoundary so one bad component doesn't kill others
      return (
        <ErrorBoundary componentName={component}>
          <Component {...remainingProps}>{nestedChildren}</Component>
        </ErrorBoundary>
      );
    } catch (error) {
      console.error(`[createKumoElement] Error rendering component "${def?.component}":`, error);
      console.error('Component def:', def);
      return null;
    }
  }

  // 5. Handle plain objects that aren't components (invalid - log warning)
  if (typeof def === 'object') {
    console.warn('[createKumoElement] Invalid object passed (missing "component" property):', def);
    return null;
  }

  return null;
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; componentName?: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; componentName?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Caught error in', this.props.componentName || 'component', ':', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '12px', 
          background: '#fff5f5', 
          border: '1px solid #fc8181', 
          borderRadius: '8px',
          marginBottom: '8px'
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#c53030', fontWeight: 600 }}>
            ⚠️ Failed to render {this.props.componentName || 'component'}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#742a2a' }}>
            {this.state.error?.message || 'Invalid props or configuration'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

const ThemeWrapper = ({ children, initialMode }: { children: React.ReactNode, initialMode: 'light' | 'dark' }) => {
  const [mode, setMode] = useState(initialMode);

  // Attach a listener to the window so the HTML site can trigger a change
  useEffect(() => {
    const handleThemeChange = (e: any) => setMode(e.detail.mode);
    window.addEventListener('kumo-theme-change', handleThemeChange);
    return () => window.removeEventListener('kumo-theme-change', handleThemeChange);
  }, []);

  return (
    <div data-mode={mode} className="kumo-root">
      {children}
    </div>
  );
};

window.CloudflareKumo = {
  // Method for the HTML site to call
  setTheme: (mode: 'light' | 'dark') => {
    // const event = new CustomEvent('kumo-theme-change', { detail: { mode } });
    // window.dispatchEvent(event);
    // 1. Update the body so Portals (Select menus) find the correct tokens
    document.body.setAttribute('data-mode', mode);
    document.body.classList.toggle('kumo-dark', mode === 'dark');
    
    // 2. Trigger the event for existing React components
    const event = new CustomEvent('kumo-theme-change', { detail: { mode } });
    window.dispatchEvent(event);
  },

  // Store React roots for reuse during progressive rendering
  _roots: new Map(),

  /**
   * Renders a JSON component definition into a container.
   * Perfect for streaming generative UI from AI responses.
   * 
   * @param jsonDef - JSON object with { component: string, props: object }
   * @param containerId - ID of the DOM element to render into
   * 
   * @example
   * window.CloudflareKumo.renderFromJSON({
   *   component: 'LayerCard',
   *   props: {
   *     secondary: 'Worker Settings',
   *     primary: [
   *       { component: 'Input', props: { label: 'Name', placeholder: 'my-worker' } },
   *       { component: 'Button', props: { children: 'Save' } }
   *     ]
   *   }
   * }, 'container-id');
   */
  renderFromJSON: (jsonDef: any, containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container "${containerId}" not found.`);
      return;
    }

    console.log('Rendering JSON:', jsonDef);

    // Create React element from JSON definition
    const element = createKumoElement(jsonDef);
    
    if (!element) {
      console.error('Failed to create element from JSON definition:', jsonDef);
      return;
    }

    console.log('Element created successfully');

    // Reuse existing root or create new one
    let root = window.CloudflareKumo._roots.get(containerId);
    if (!root) {
      root = createRoot(container);
      window.CloudflareKumo._roots.set(containerId, root);
    }

    // Use flushSync to force immediate synchronous rendering
    // This ensures progressive updates appear immediately without batching
    flushSync(() => {
      root.render(
        <ThemeWrapper initialMode="light">
          {element}
        </ThemeWrapper>
      );
    });
  },

  render: (name, props, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const Component = REGISTRY[name];
    if (!Component) return console.error(`Root component "${name}" not found.`);

    const { options, primary, secondary, children, ...remainingProps } = props;
    
    let finalChildren = children;

    // --- Logic for Select Root ---
    if (name === 'Select' && Array.isArray(options)) {
      finalChildren = options.map((opt: any) => (
        <Select.Option key={opt.value} value={opt.value}>
          {opt.label}
        </Select.Option>
      ));
    }

    // --- Logic for LayerCard Slots ---
    if (name === 'LayerCard') {
      // Look for a custom className specifically for the primary slot
      const primaryClass = props.primaryClassName || "flex flex-col gap-4";

      finalChildren = (
        <>
          {secondary && (
            <LayerCard.Secondary>
              {createKumoElement(secondary)}
            </LayerCard.Secondary>
          )}
          {primary && (
            <LayerCard.Primary className={primaryClass}>
              {createKumoElement(primary)}
            </LayerCard.Primary>
          )}
        </>
      );
    }

    const root = createRoot(container);
    root.render(
      <ThemeWrapper initialMode="light">
        <Component {...remainingProps}>
          {finalChildren}
        </Component>
      </ThemeWrapper>
    );
  }
};