/**
 * Renderer entry point. getRenderer() returns the app-wide RendererAPI singleton: the
 * progressive WebGL2 ray tracer, or a Canvas 2D stand-in (supported = false, with an
 * explanatory error) when the browser cannot run it.
 */
import type { RendererAPI } from '@/core/renderApi';
import { RayTracer } from './gl/RayTracer';
import { UnsupportedRenderer, WebGLRenderer } from './Renderer';

export { MAX_LIGHTS, MAX_OBJECTS } from './layout';

let instance: RendererAPI | null = null;

export function getRenderer(): RendererAPI {
  if (instance) return instance;
  let created: { tracer: RayTracer } | { error: string };
  try {
    created = RayTracer.create();
  } catch (err) {
    created = { error: `The ray tracer could not start: ${err instanceof Error ? err.message : String(err)}` };
  }
  instance = 'tracer' in created ? new WebGLRenderer(created.tracer) : new UnsupportedRenderer(created.error);
  return instance;
}
