"""Remote coordinates for authored cameraViewport viewers; no scene edits.

Panel.interactMouse shares the host cursor's panel values. cameraViewport's
whileOn can therefore see host UVs between remote packets. Use its public camera
methods with the remote gesture coordinates instead. Ordinary panels retain
interactMouse in runtime.py.
"""


class ViewerNavigation:
    def __init__(self):
        self.gesture = None

    def release(self):
        gesture, self.gesture = self.gesture, None
        if gesture and gesture[0].valid:
            gesture[0].EndTransform()

    @staticmethod
    def action(camera, buttons):
        # The browser does not forward keyboard modifiers. Respect native
        # bindings requiring them instead of silently invoking another action.
        pressed = {'left': bool(buttons & 1), 'middle': bool(buttons & 4),
                   'right': bool(buttons & 2)}
        for prefix, action in (('Tumble', 'tumble'), ('Dolly', 'dolly'), ('Pan', 'pan')):
            if prefix == 'Tumble' and camera.par.Orthographic.eval():
                continue
            if (pressed.get(getattr(camera.par, prefix + 'mouse').eval(), False)
                    and getattr(camera.par, prefix + 'mod').eval() == 'none'):
                if action == 'dolly' and camera.par.Orthographic.eval():
                    action = 'orthozoom'
                return action, prefix
        return None, None

    def mouse(self, viewer, u, v, buttons, wheel=0):
        camera = viewer.op('cameraViewport')
        if camera is None:
            self.release()
            return
        action, prefix = self.action(camera, buttons)
        mode = camera.par.Navigationmode.eval()
        gesture = (camera, buttons, action, mode) if action else None
        if gesture != self.gesture:
            self.release()
            if gesture:
                camera.StartTransform(action=action, u=u, v=v, mode=mode)
                self.gesture = gesture
                # The first sample anchors the drag; it is never movement.
        elif gesture:
            camera.Transform(u=u, v=v, scaler=getattr(camera.par, prefix + 'mult').eval())
        if wheel and not gesture:
            camera.StartTransform(action='orthozoom' if camera.par.Orthographic.eval() else 'wheel',
                                  u=u, v=v, mode=mode)
            try:
                camera.Transform(du=wheel * camera.par.Wheelmult.eval(), dv=0, scaler=1)
            finally:
                camera.EndTransform()


controller = ViewerNavigation()
