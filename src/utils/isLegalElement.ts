export const isHTMLElement = (ele: unknown) => {
  return ele instanceof HTMLElement;
}

export const isRenderImageElement = (ele: unknown) => {
  return (
    ele instanceof HTMLImageElement ||
    ele instanceof HTMLSourceElement ||
    ele instanceof HTMLEmbedElement ||
    ele instanceof HTMLIFrameElement
  );
}

export type IRenderImageElement = HTMLImageElement | HTMLSourceElement | HTMLEmbedElement | HTMLIFrameElement;
