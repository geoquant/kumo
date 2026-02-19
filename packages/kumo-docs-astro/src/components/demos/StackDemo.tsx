import { Stack, Surface, Text } from "@cloudflare/kumo";

/** Basic Stack layout with default gap. */
export function StackDemo() {
  return (
    <Stack gap="base">
      <Surface className="rounded-lg p-4">
        <Text bold>Item 1</Text>
        <div className="mt-1">
          <Text variant="secondary">First stack item</Text>
        </div>
      </Surface>
      <Surface className="rounded-lg p-4">
        <Text bold>Item 2</Text>
        <div className="mt-1">
          <Text variant="secondary">Second stack item</Text>
        </div>
      </Surface>
      <Surface className="rounded-lg p-4">
        <Text bold>Item 3</Text>
        <div className="mt-1">
          <Text variant="secondary">Third stack item</Text>
        </div>
      </Surface>
    </Stack>
  );
}

/** Stack with different gap sizes. */
export function StackGapDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-kumo-subtle">gap="none"</p>
        <Stack gap="none">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="xs"</p>
        <Stack gap="xs">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="sm"</p>
        <Stack gap="sm">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="base" (default)</p>
        <Stack gap="base">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="lg"</p>
        <Stack gap="lg">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">gap="xl"</p>
        <Stack gap="xl">
          <Surface className="rounded-lg p-4 text-center">
            <Text>1</Text>
          </Surface>
          <Surface className="rounded-lg p-4 text-center">
            <Text>2</Text>
          </Surface>
        </Stack>
      </div>
    </div>
  );
}

/** Stack with different cross-axis alignment. */
export function StackAlignDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-kumo-subtle">align="stretch" (default)</p>
        <Stack gap="sm" align="stretch">
          <Surface className="rounded-lg p-4">
            <Text>Full width</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Full width</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="start"</p>
        <Stack gap="sm" align="start">
          <Surface className="rounded-lg p-4">
            <Text>Aligned start</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Short</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="center"</p>
        <Stack gap="sm" align="center">
          <Surface className="rounded-lg p-4">
            <Text>Centered</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Short</Text>
          </Surface>
        </Stack>
      </div>

      <div>
        <p className="mb-2 text-kumo-subtle">align="end"</p>
        <Stack gap="sm" align="end">
          <Surface className="rounded-lg p-4">
            <Text>Aligned end</Text>
          </Surface>
          <Surface className="rounded-lg p-4">
            <Text>Short</Text>
          </Surface>
        </Stack>
      </div>
    </div>
  );
}
