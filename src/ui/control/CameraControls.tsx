/**
 * View Control (big icon cycling the views), the three camera crosses and the camera
 * Trackball. They move whichever camera the current view edits (render camera or
 * director); orthographic views have no camera to move, so the controls dim.
 */
import { useState } from 'react';
import { bank, cameraStep, editActiveCamera, getActiveCamera, look, lookAt, orbit } from '@/core/cameraOps';
import { defaultCamera } from '@/core/defaults';
import { cameraBasis, v3 } from '@/core/math';
import { isInfinitePlane } from '@/core/objects';
import { useStore } from '@/core/store';
import type { CameraState, Vec3, ViewMode } from '@/core/types';
import { CrossControl, Icon3D, IconButton, TriangleMenu, Trackball, type IconKind, type MenuItem } from '@/ui/kit';
import { worldBounds } from '../edit/transformOps';

export const VIEWS: { id: ViewMode; label: string; icon: IconKind }[] = [
  { id: 'camera', label: 'Camera View', icon: 'viewCamera' },
  { id: 'director', label: "Director's View", icon: 'viewDirector' },
  { id: 'top', label: 'Top View', icon: 'viewTop' },
  { id: 'bottom', label: 'Bottom View', icon: 'viewBottom' },
  { id: 'left', label: 'Left View', icon: 'viewLeft' },
  { id: 'right', label: 'Right View', icon: 'viewRight' },
  { id: 'front', label: 'Front View', icon: 'viewFront' },
  { id: 'back', label: 'Back View', icon: 'viewBack' },
];

export const viewLabel = (v: ViewMode) => VIEWS.find((x) => x.id === v)?.label ?? 'View';

const gesture = {
  onStart: () => useStore.getState().beginGesture(),
  onEnd: () => useStore.getState().endGesture(),
};

/** Slide eye and target together: sideways, forward across the ground, and up. */
function slide(c: CameraState, side: number, forward: number, up: number): CameraState {
  const { right, forward: f } = cameraBasis(c);
  const r = v3.norm([right[0], 0, right[2]]);
  const flatLen = Math.hypot(f[0], f[2]);
  const fw: Vec3 = flatLen > 1e-4 ? [f[0] / flatLen, 0, f[2] / flatLen] : v3.norm([-r[2], 0, r[0]]);
  const d: Vec3 = [r[0] * side + fw[0] * forward, up, r[2] * side + fw[2] * forward];
  return { ...c, position: v3.add(c.position, d), target: v3.add(c.target, d) };
}

const stepFor = (e: PointerEvent) => {
  const cam = getActiveCamera();
  return (cam ? cameraStep(cam) : 0.3) * 0.35 * (e.shiftKey ? 0.2 : e.altKey ? 3 : 1);
};

/** Center of the selection (or of all solid objects). */
function focusPoint(selectionOnly: boolean): Vec3 | null {
  const s = useStore.getState();
  const ids = new Set(s.selection);
  const objs = s.scene.objects.filter((o) => !o.hidden && !isInfinitePlane(o.type) && (!selectionOnly || ids.has(o.id)));
  if (!objs.length) return null;
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const o of objs) {
    const b = worldBounds(o);
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], b.min[i]);
      hi[i] = Math.max(hi[i], b.max[i]);
    }
  }
  return v3.scale(v3.add(lo, hi), 0.5);
}

export function ViewControl() {
  const view = useStore((s) => s.ui.view);
  const cur = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const setView = (id: ViewMode) => {
    useStore.getState().setUI({ view: id });
    useStore.getState().setHint(viewLabel(id));
  };
  const cycle = (dir: 1 | -1) => {
    const i = VIEWS.findIndex((v) => v.id === view);
    setView(VIEWS[(i + dir + VIEWS.length) % VIEWS.length].id);
  };
  return (
    <div className="view-block">
      <span className="view-name" aria-hidden="true">
        {cur.label.replace(' View', '').replace("'s", '')}
      </span>
      <IconButton hint={`${cur.label}: click for the next view (Shift-click: previous)`} size={70} onClick={(e) => cycle(e.shiftKey ? -1 : 1)}>
        <Icon3D kind={cur.icon} size={64} />
      </IconButton>
      <TriangleMenu hint="Views" items={VIEWS.map((v) => ({ label: v.label, checked: v.id === view, onSelect: () => setView(v.id) }))} />
    </div>
  );
}

type TrackMode = 'orbit' | 'turn' | 'bank';

export function CameraControls() {
  const view = useStore((s) => s.ui.view);
  const [mode, setMode] = useState<TrackMode>('orbit');
  const ortho = view !== 'camera' && view !== 'director';
  const who = view === 'director' ? 'director camera' : 'camera';
  const why = ortho ? ' (switch to the Camera or Director view)' : '';

  const cameraMenu: MenuItem[] = [
    {
      label: 'Center Scene',
      disabled: ortho,
      onSelect: () => {
        const p = focusPoint(false);
        if (p) editActiveCamera((c) => lookAt(c, p));
      },
    },
    {
      label: 'Center Selection',
      disabled: ortho,
      onSelect: () => {
        const p = focusPoint(true);
        if (p) editActiveCamera((c) => lookAt(c, p));
        else useStore.getState().showStatus('Select an object to center on.');
      },
    },
    { label: 'Eye-Level Camera', disabled: ortho, onSelect: () => editActiveCamera((c) => ({ ...c, position: [c.position[0], 2, c.position[2]], target: [c.target[0], 2, c.target[2]], roll: 0 })) },
    { divider: true, label: '' },
    { label: 'Director to Camera', onSelect: () => useStore.getState().setCamera({ ...useStore.getState().ui.directorCamera }) },
    { label: 'Camera to Director', onSelect: () => useStore.getState().setUI({ directorCamera: { ...useStore.getState().scene.camera } }) },
    { divider: true, label: '' },
    { label: 'Level the Horizon', disabled: ortho, onSelect: () => editActiveCamera((c) => ({ ...c, roll: 0 })) },
    { label: 'Reset Camera', onSelect: () => useStore.getState().setCamera(defaultCamera()) },
  ];

  const trackMenu: MenuItem[] = [
    { label: 'Orbit Around Target', checked: mode === 'orbit', onSelect: () => setMode('orbit') },
    { label: 'Turn In Place', checked: mode === 'turn', onSelect: () => setMode('turn') },
    { label: 'Bank (Roll)', checked: mode === 'bank', onSelect: () => setMode('bank') },
  ];

  const trackHint =
    mode === 'orbit' ? `Trackball: orbit the ${who} around its target${why}` : mode === 'turn' ? `Trackball: turn the ${who} in place${why}` : `Trackball: bank the ${who}${why}`;

  return (
    <div className={`camera-block ${ortho ? 'is-ortho' : ''}`}>
      <div className="camera-crosses">
        <CrossControl
          plane="xy"
          size={56}
          disabled={ortho}
          hint={`Move ${who}: left/right and up/down${why}`}
          {...gesture}
          onDrag={(a, b, e) => {
            const k = stepFor(e);
            editActiveCamera((c) => slide(c, a * k, 0, b * k));
          }}
        />
        <CrossControl
          plane="zy"
          size={56}
          disabled={ortho}
          hint={`Move ${who}: forward/back and up/down${why}`}
          {...gesture}
          onDrag={(a, b, e) => {
            const k = stepFor(e);
            editActiveCamera((c) => slide(c, 0, a * k, b * k));
          }}
        />
        <CrossControl
          plane="xz"
          size={58}
          disabled={ortho}
          hint={`Move ${who}: left/right and forward/back${why}`}
          {...gesture}
          onDrag={(a, b, e) => {
            const k = stepFor(e);
            editActiveCamera((c) => slide(c, a * k, b * k, 0));
          }}
        />
      </div>
      <TriangleMenu className="camera-menu" hint="Camera options" items={cameraMenu} />
      <div className="trackball-row">
        <Trackball
          size={84}
          disabled={ortho}
          hint={trackHint}
          {...gesture}
          onDrag={(dx, dy, e) => {
            const k = e.shiftKey ? 0.25 : 1;
            if (mode === 'orbit') editActiveCamera((c) => orbit(c, -dx * 0.45 * k, dy * 0.45 * k));
            else if (mode === 'turn') editActiveCamera((c) => look(c, -dx * 0.25 * k, -dy * 0.25 * k));
            else editActiveCamera((c) => bank(c, dx * 0.4 * k));
          }}
        />
        <TriangleMenu hint="Trackball options" items={trackMenu} />
      </div>
    </div>
  );
}
