/**
 * @a2ui-bridge/core - A2UI Message Processor
 * MIT License - Copyright (c) 2024 tpitre
 *
 * Core processor for handling A2UI protocol messages.
 * Based on Google's A2UI protocol specification.
 */

import type {
  ServerToClientMessage,
  AnyComponentNode,
  BeginRenderingMessage,
  DataArray,
  DataMap,
  DataValue,
  DeleteSurfaceMessage,
  ResolvedMap,
  ResolvedValue,
  Surface,
  SurfaceID,
  SurfaceUpdateMessage,
  DataModelUpdate,
  MessageProcessor,
} from './types.js';
import {
  isComponentArrayReference,
  isObject,
  isPath,
  isResolvedAudioPlayer,
  isResolvedButton,
  isResolvedCard,
  isResolvedCheckbox,
  isResolvedColumn,
  isResolvedDateTimeInput,
  isResolvedDivider,
  isResolvedIcon,
  isResolvedImage,
  isResolvedList,
  isResolvedModal,
  isResolvedMultipleChoice,
  isResolvedRow,
  isResolvedSlider,
  isResolvedTabs,
  isResolvedText,
  isResolvedTextField,
  isResolvedVideo,
} from './guards.js';

export interface ProcessorOptions {
  mapCtor: MapConstructor;
  arrayCtor: ArrayConstructor;
  setCtor: SetConstructor;
  objCtor: ObjectConstructor;
}

/**
 * Processes and consolidates A2UI protocol messages into a structured,
 * hierarchical model of UI surfaces.
 */
export class A2uiMessageProcessor implements MessageProcessor {
  static readonly DEFAULT_SURFACE_ID = '@default';

  #mapCtor: MapConstructor = Map;
  #arrayCtor: ArrayConstructor = Array;
  #setCtor: SetConstructor = Set;
  #objCtor: ObjectConstructor = Object;
  #surfaces: Map<SurfaceID, Surface>;

  constructor(
    opts: ProcessorOptions = {
      mapCtor: Map,
      arrayCtor: Array,
      setCtor: Set,
      objCtor: Object,
    }
  ) {
    this.#arrayCtor = opts.arrayCtor;
    this.#mapCtor = opts.mapCtor;
    this.#setCtor = opts.setCtor;
    this.#objCtor = opts.objCtor;

    this.#surfaces = new opts.mapCtor();
  }

  getSurfaces(): ReadonlyMap<string, Surface> {
    return this.#surfaces;
  }

  clearSurfaces(): void {
    this.#surfaces.clear();
  }

  processMessages(messages: ServerToClientMessage[]): void {
    for (const message of messages) {
      if (message.beginRendering) {
        this.#handleBeginRendering(
          message.beginRendering,
          message.beginRendering.surfaceId
        );
      }

      if (message.surfaceUpdate) {
        this.#handleSurfaceUpdate(
          message.surfaceUpdate,
          message.surfaceUpdate.surfaceId
        );
      }

      if (message.dataModelUpdate) {
        this.#handleDataModelUpdate(
          message.dataModelUpdate,
          message.dataModelUpdate.surfaceId
        );
      }

      if (message.deleteSurface) {
        this.#handleDeleteSurface(message.deleteSurface);
      }
    }
  }

  getData(
    node: AnyComponentNode,
    relativePath: string,
    surfaceId = A2uiMessageProcessor.DEFAULT_SURFACE_ID
  ): DataValue | null {
    const surface = this.#getOrCreateSurface(surfaceId);
    if (!surface) return null;

    let finalPath: string;

    if (relativePath === '.' || relativePath === '') {
      finalPath = node.dataContextPath ?? '/';
    } else {
      finalPath = this.resolvePath(relativePath, node.dataContextPath);
    }

    return this.#getDataByPath(surface.dataModel, finalPath);
  }

  setData(
    node: AnyComponentNode | null,
    relativePath: string,
    value: DataValue,
    surfaceId = A2uiMessageProcessor.DEFAULT_SURFACE_ID
  ): void {
    if (!node) {
      console.warn('No component node set');
      return;
    }

    const surface = this.#getOrCreateSurface(surfaceId);
    if (!surface) return;

    let finalPath: string;

    if (relativePath === '.' || relativePath === '') {
      finalPath = node.dataContextPath ?? '/';
    } else {
      finalPath = this.resolvePath(relativePath, node.dataContextPath);
    }

    this.#setDataByPath(surface.dataModel, finalPath, value);
  }

  resolvePath(path: string, dataContextPath?: string): string {
    if (path.startsWith('/')) {
      return path;
    }

    if (dataContextPath && dataContextPath !== '/') {
      return dataContextPath.endsWith('/')
        ? `${dataContextPath}${path}`
        : `${dataContextPath}/${path}`;
    }

    return `/${path}`;
  }

  #parseIfJsonString(value: DataValue): DataValue {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    if (
      (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
      (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
    ) {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.warn(
          `Failed to parse potential JSON string: "${value.substring(0, 50)}..."`,
          e
        );
        return value;
      }
    }

    return value;
  }

  #convertKeyValueArrayToMap(arr: DataArray): DataMap {
    const map = new this.#mapCtor<string, DataValue>();
    for (const item of arr) {
      if (!isObject(item) || !('key' in item)) continue;

      const key = item.key as string;

      const valueKey = this.#findValueKey(item);
      if (!valueKey) continue;

      let value: DataValue = item[valueKey];
      if (valueKey === 'valueMap' && Array.isArray(value)) {
        value = this.#convertKeyValueArrayToMap(value);
      } else if (typeof value === 'string') {
        value = this.#parseIfJsonString(value);
      }

      this.#setDataByPath(map, key, value);
    }
    return map;
  }

  #setDataByPath(root: DataMap, path: string, value: DataValue): void {
    if (
      Array.isArray(value) &&
      (value.length === 0 || (isObject(value[0]) && 'key' in value[0]))
    ) {
      if (value.length === 1 && isObject(value[0]) && value[0].key === '.') {
        const item = value[0];
        const valueKey = this.#findValueKey(item);

        if (valueKey) {
          value = item[valueKey];

          if (valueKey === 'valueMap' && Array.isArray(value)) {
            value = this.#convertKeyValueArrayToMap(value);
          } else if (typeof value === 'string') {
            value = this.#parseIfJsonString(value);
          }
        } else {
          value = this.#convertKeyValueArrayToMap(value);
        }
      } else {
        value = this.#convertKeyValueArrayToMap(value);
      }
    }

    const segments = this.#normalizePath(path)
      .split('/')
      .filter((s) => s);
    if (segments.length === 0) {
      if (value instanceof Map || isObject(value)) {
        if (!(value instanceof Map) && isObject(value)) {
          value = new this.#mapCtor(Object.entries(value));
        }

        root.clear();
        for (const [key, v] of value.entries()) {
          root.set(key, v);
        }
      } else {
        console.error('Cannot set root of DataModel to a non-Map value.');
      }
      return;
    }

    let current: DataMap | DataArray = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let target: DataValue | undefined;

      if (current instanceof Map) {
        target = current.get(segment);
      } else if (Array.isArray(current) && /^\d+$/.test(segment)) {
        target = current[parseInt(segment, 10)];
      }

      if (
        target === undefined ||
        typeof target !== 'object' ||
        target === null
      ) {
        target = new this.#mapCtor();
        if (current instanceof this.#mapCtor) {
          current.set(segment, target);
        } else if (Array.isArray(current)) {
          current[parseInt(segment, 10)] = target;
        }
      }
      current = target as DataMap | DataArray;
    }

    const finalSegment = segments[segments.length - 1];
    const storedValue = value;
    if (current instanceof this.#mapCtor) {
      current.set(finalSegment, storedValue);
    } else if (Array.isArray(current) && /^\d+$/.test(finalSegment)) {
      current[parseInt(finalSegment, 10)] = storedValue;
    }
  }

  #normalizePath(path: string): string {
    const dotPath = path.replace(/\[(\d+)\]/g, '.$1');
    const segments = dotPath.split('.');
    return '/' + segments.filter((s) => s.length > 0).join('/');
  }

  #getDataByPath(root: DataMap, path: string): DataValue | null {
    const segments = this.#normalizePath(path)
      .split('/')
      .filter((s) => s);

    let current: DataValue = root;
    for (const segment of segments) {
      if (current === undefined || current === null) return null;

      if (current instanceof Map) {
        current = current.get(segment) as DataMap;
      } else if (Array.isArray(current) && /^\d+$/.test(segment)) {
        current = current[parseInt(segment, 10)];
      } else if (isObject(current)) {
        current = current[segment];
      } else {
        return null;
      }
    }
    return current;
  }

  #getOrCreateSurface(surfaceId: string): Surface {
    let surface: Surface | undefined = this.#surfaces.get(surfaceId);
    if (!surface) {
      surface = new this.#objCtor({
        rootComponentId: null,
        componentTree: null,
        dataModel: new this.#mapCtor(),
        components: new this.#mapCtor(),
        styles: new this.#objCtor(),
      }) as Surface;

      this.#surfaces.set(surfaceId, surface);
    }

    return surface;
  }

  #handleBeginRendering(
    message: BeginRenderingMessage,
    surfaceId: SurfaceID
  ): void {
    const surface = this.#getOrCreateSurface(surfaceId);
    surface.rootComponentId = message.root;
    surface.styles = message.styles ?? {};
    this.#rebuildComponentTree(surface);
  }

  #handleSurfaceUpdate(
    message: SurfaceUpdateMessage,
    surfaceId: SurfaceID
  ): void {
    const surface = this.#getOrCreateSurface(surfaceId);
    for (const component of message.components) {
      surface.components.set(component.id, component);
    }
    this.#rebuildComponentTree(surface);
  }

  #handleDataModelUpdate(
    message: DataModelUpdate,
    surfaceId: SurfaceID
  ): void {
    const surface = this.#getOrCreateSurface(surfaceId);
    const path = message.path ?? '/';
    this.#setDataByPath(surface.dataModel, path, message.contents);
    this.#rebuildComponentTree(surface);
  }

  #handleDeleteSurface(message: DeleteSurfaceMessage): void {
    this.#surfaces.delete(message.surfaceId);
  }

  #rebuildComponentTree(surface: Surface): void {
    if (!surface.rootComponentId) {
      surface.componentTree = null;
      return;
    }

    const visited = new this.#setCtor<string>();
    surface.componentTree = this.#buildNodeRecursive(
      surface.rootComponentId,
      surface,
      visited,
      '/',
      ''
    );
  }

  #findValueKey(value: Record<string, unknown>): string | undefined {
    return Object.keys(value).find((k) => k.startsWith('value'));
  }

  #buildNodeRecursive(
    baseComponentId: string,
    surface: Surface,
    visited: Set<string>,
    dataContextPath: string,
    idSuffix = ''
  ): AnyComponentNode | null {
    const fullId = `${baseComponentId}${idSuffix}`;
    const { components } = surface;

    if (!components.has(baseComponentId)) {
      return null;
    }

    if (visited.has(fullId)) {
      throw new Error(`Circular dependency for component "${fullId}".`);
    }

    visited.add(fullId);

    const componentData = components.get(baseComponentId)!;
    const componentProps = componentData.component ?? {};
    const componentType = Object.keys(componentProps)[0];
    const unresolvedProperties =
      componentProps[componentType as keyof typeof componentProps];

    const resolvedProperties: ResolvedMap = new this.#objCtor() as ResolvedMap;
    if (isObject(unresolvedProperties)) {
      for (const [key, value] of Object.entries(unresolvedProperties)) {
        resolvedProperties[key] = this.#resolvePropertyValue(
          value,
          surface,
          visited,
          dataContextPath,
          idSuffix
        );
      }
    }

    visited.delete(fullId);

    const baseNode = {
      id: fullId,
      dataContextPath,
      weight: componentData.weight ?? 'initial',
    };

    switch (componentType) {
      case 'Text':
        if (!isResolvedText(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Text',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Image':
        if (!isResolvedImage(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Image',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Icon':
        if (!isResolvedIcon(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Icon',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Video':
        if (!isResolvedVideo(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Video',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'AudioPlayer':
        if (!isResolvedAudioPlayer(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'AudioPlayer',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Row':
        if (!isResolvedRow(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Row',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Column':
        if (!isResolvedColumn(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Column',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'List':
        if (!isResolvedList(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'List',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Card':
        if (!isResolvedCard(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Card',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Tabs':
        if (!isResolvedTabs(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Tabs',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Divider':
        if (!isResolvedDivider(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Divider',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Modal':
        if (!isResolvedModal(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Modal',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Button':
        if (!isResolvedButton(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Button',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'CheckBox':
        if (!isResolvedCheckbox(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'CheckBox',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'TextField':
        if (!isResolvedTextField(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'TextField',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'DateTimeInput':
        if (!isResolvedDateTimeInput(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'DateTimeInput',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'MultipleChoice':
        if (!isResolvedMultipleChoice(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'MultipleChoice',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      case 'Slider':
        if (!isResolvedSlider(resolvedProperties)) {
          throw new Error(`Invalid data; expected ${componentType}`);
        }
        return new this.#objCtor({
          ...baseNode,
          type: 'Slider',
          properties: resolvedProperties,
        }) as AnyComponentNode;

      default:
        return new this.#objCtor({
          ...baseNode,
          type: componentType,
          properties: resolvedProperties,
        }) as AnyComponentNode;
    }
  }

  #resolvePropertyValue(
    value: unknown,
    surface: Surface,
    visited: Set<string>,
    dataContextPath: string,
    idSuffix = ''
  ): ResolvedValue {
    if (typeof value === 'string' && surface.components.has(value)) {
      return this.#buildNodeRecursive(
        value,
        surface,
        visited,
        dataContextPath,
        idSuffix
      );
    }

    if (isComponentArrayReference(value)) {
      if (value.explicitList) {
        return value.explicitList.map((id) =>
          this.#buildNodeRecursive(
            id,
            surface,
            visited,
            dataContextPath,
            idSuffix
          )
        );
      }

      if (value.template) {
        const fullDataPath = this.resolvePath(
          value.template.dataBinding,
          dataContextPath
        );
        const data = this.#getDataByPath(surface.dataModel, fullDataPath);

        const template = value.template;
        if (Array.isArray(data)) {
          return data.map((_, index) => {
            const parentIndices = dataContextPath
              .split('/')
              .filter((segment) => /^\d+$/.test(segment));

            const newIndices = [...parentIndices, index];
            const newSuffix = `:${newIndices.join(':')}`;
            const childDataContextPath = `${fullDataPath}/${index}`;

            return this.#buildNodeRecursive(
              template.componentId,
              surface,
              visited,
              childDataContextPath,
              newSuffix
            );
          });
        }

        const mapCtor = this.#mapCtor;
        if (data instanceof mapCtor) {
          return Array.from(data.keys(), (key) => {
            const newSuffix = `:${key}`;
            const childDataContextPath = `${fullDataPath}/${key}`;

            return this.#buildNodeRecursive(
              template.componentId,
              surface,
              visited,
              childDataContextPath,
              newSuffix
            );
          });
        }

        return new this.#arrayCtor();
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.#resolvePropertyValue(
          item,
          surface,
          visited,
          dataContextPath,
          idSuffix
        )
      );
    }

    if (isObject(value)) {
      const newObj: ResolvedMap = new this.#objCtor() as ResolvedMap;
      for (const [key, propValue] of Object.entries(value)) {
        let propertyValue = propValue;
        if (isPath(key, propValue) && dataContextPath !== '/') {
          propertyValue = propValue
            .replace(/^\.?\/item/, '')
            .replace(/^\.?\/text/, '')
            .replace(/^\.?\/label/, '')
            .replace(/^\.?\//, '');
          newObj[key] = propertyValue as ResolvedValue;
          continue;
        }

        newObj[key] = this.#resolvePropertyValue(
          propertyValue,
          surface,
          visited,
          dataContextPath,
          idSuffix
        );
      }
      return newObj;
    }

    return value as ResolvedValue;
  }
}

/**
 * Create a new A2UI message processor with default options.
 */
export function createA2uiMessageProcessor(
  opts?: ProcessorOptions
): A2uiMessageProcessor {
  return new A2uiMessageProcessor(opts);
}
