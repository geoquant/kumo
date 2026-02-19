import { Cluster, Surface, Text } from "@cloudflare/kumo";

/** Basic Cluster layout with default gap. */
export function ClusterDemo() {
  return (
    <Cluster gap="base">
      <Surface className="rounded-lg p-4">
        <Text bold>Item 1</Text>
      </Surface>
      <Surface className="rounded-lg p-4">
        <Text bold>Item 2</Text>
      </Surface>
      <Surface className="rounded-lg p-4">
        <Text bold>Item 3</Text>
      </Surface>
    </Cluster>
  );
}

/** Cluster with different gap sizes. */
export function ClusterGapDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-kumo-subtle">gap="none"</p>
        <Cluster gap="none">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>3</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="sm"</p>
        <Cluster gap="sm">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>3</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="base" (default)</p>
        <Cluster gap="base">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>3</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="xl"</p>
        <Cluster gap="xl">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>3</Text>
          </Surface>
        </Cluster>
      </div>
    </div>
  );
}

/** Cluster with different justify options. */
export function ClusterJustifyDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-kumo-subtle">justify="start" (default)</p>
        <Cluster gap="sm" justify="start">
          <Surface className="rounded-lg p-4">
            <Text>A</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>B</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">justify="center"</p>
        <Cluster gap="sm" justify="center">
          <Surface className="rounded-lg p-4">
            <Text>A</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>B</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">justify="end"</p>
        <Cluster gap="sm" justify="end">
          <Surface className="rounded-lg p-4">
            <Text>A</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>B</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">justify="between"</p>
        <Cluster gap="sm" justify="between">
          <Surface className="rounded-lg p-4">
            <Text>A</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>B</Text>
          </Surface>
        </Cluster>
      </div>
    </div>
  );
}

/** Cluster with wrap and align options. */
export function ClusterWrapAlignDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-kumo-subtle">wrap="wrap" (default)</p>
        <Cluster gap="sm" wrap="wrap" className="max-w-xs">
          <Surface className="rounded-lg p-4">
            <Text>One</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Two</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Three</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Four</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">wrap="nowrap"</p>
        <Cluster gap="sm" wrap="nowrap">
          <Surface className="rounded-lg p-4">
            <Text>One</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Two</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Three</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Four</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="start"</p>
        <Cluster gap="sm" align="start">
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text size="lg">Large</Text>
          </Surface>
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="center" (default)</p>
        <Cluster gap="sm" align="center">
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text size="lg">Large</Text>
          </Surface>
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="baseline"</p>
        <Cluster gap="sm" align="baseline">
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text size="lg">Large</Text>
          </Surface>
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
        </Cluster>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="stretch"</p>
        <Cluster gap="sm" align="stretch">
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text size="lg">Large</Text>
          </Surface>
          <Surface className="rounded-lg p-2">
            <Text size="sm">Small</Text>
          </Surface>
        </Cluster>
      </div>
    </div>
  );
}
