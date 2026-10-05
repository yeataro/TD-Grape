"""Main-thread application of frontend TOP artifacts to a native Family.

The Family's shader and native parameter drivers never call the Manager.
This adapter is used only while editing. It does not understand graph nodes.
"""
from copy import deepcopy
import json
import uuid


class NativeFamily:
    def __init__(self, comp, *, artifact, document, sources, controls_source=None, values=None):
        self.comp = comp
        self.artifact = artifact
        self.document = document
        self.sources = sources
        self.controls_source = controls_source
        self.values = values

    def set_parameter_with_undo(self, parameter, value, validate=None):
        if self.values is None:
            raise RuntimeError('The native value writer is not configured.')
        return self.values.set_parameter_with_undo(parameter, value, validate)

    def set_parameters_with_undo(self, plans):
        if self.values is None:
            raise RuntimeError('The native value writer is not configured.')
        return self.values.set_parameters_with_undo(plans)

    def control_helper(self, comp, name='parameter_links'):
        return comp.op('GrapeControls/' + name)

    def ensure_supported_shader(self, comp):
        self.document.restore(comp.op('GrapeControls/document').text,
                              target_id=comp.fetch('sgrapeShaderId', None))

    def prepare_control_helpers(self):
        container = self.comp.op('GrapeControls')
        helper = container.op('parameter_links')
        if helper is not None:
            if not helper.fetch('grapeControlHelper', False):
                raise RuntimeError('An unrelated DAT occupies the native controls helper name.')
            return helper
        if not self.controls_source:
            raise RuntimeError('The native custom-control adapter is not configured.')
        self.comp.par.parentshortcut = 'GrapeFamily'
        helper = container.create(parameterexecuteDAT, 'parameter_links')
        helper.nodeX, helper.nodeY = 220, -160
        helper.store('grapeControlHelper', True)
        helper.text = self.controls_source
        helper.par.op.expr = "parent.GrapeFamily.op('shader')"
        helper.par.pars = 'vec*value* color*rgb* color*alpha const*value'
        helper.par.builtin = True
        helper.par.custom = False
        helper.par.valuechange = True
        helper.par.modechange = True
        helper.module.prime(self.comp)
        lifecycle = container.create(executeDAT, 'parameter_lifecycle')
        lifecycle.nodeX, lifecycle.nodeY = 440, -160
        lifecycle.par.start = True
        lifecycle.par.create = True
        lifecycle.par.framestart = False
        lifecycle.par.frameend = False
        lifecycle.text = "def onStart():\n    me.parent().op('parameter_links').module.prime(parent.GrapeFamily)\ndef onCreate():\n    onStart()\n"
        return helper

    def target(self):
        return self.comp

    def shader_operator(self, comp):
        shader = comp.op('shader')
        if shader is None or shader.type != 'glsl':
            raise RuntimeError('This Family does not contain a native GLSL TOP.')
        return shader

    def source_module(self):
        return self.sources

    def validate_history_graph(self, graph):
        self.document.validate_graph(graph)

    def state(self):
        return self.document.restore(self.comp.op('GrapeControls/document').text,
                                     target_id=self.comp.fetch('sgrapeShaderId', None))

    def checked_state(self):
        return self.state()

    def configure_sources(self, graph, revision):
        """Create/restore native rows without generating or replacing GLSL."""
        current = self.state()
        if current['revision'] != revision:
            raise RuntimeError('Conflict: refresh the native source revision.')
        self.document.validate_graph(graph)
        # Missing native rows are preserved editing data, not rows to create.
        self.artifact.validate_declarations([row for row in graph['declarations'] if not row.get('sourceMissing')])
        before = self.sources.capture_configuration(self, self.comp)
        try:
            self.sources.configure(self, self.comp, graph, {})
            self.write_state(self.document.update(current, graph))
        except Exception as error:
            rollback_errors = []
            try:
                self.sources.restore_configuration(self, self.comp, before)
            except Exception as rollback_error:
                rollback_errors.append('native parameters: ' + str(rollback_error))
            self.status('rollback-failed' if rollback_errors else 'source-configuration', str(error),
                        exception=type(error).__name__, rollbackErrors=rollback_errors)
            if rollback_errors:
                failure = RuntimeError('Source configuration failed and rollback needs review: ' + str(error))
                failure.rollback_errors = rollback_errors
                raise failure from error
            raise
        return {'ok': True}

    def write_state(self, state):
        # Serialize completely before changing either view. The outer graph DAT
        # is a human-readable projection; document is the persistence envelope.
        saved = self.document.serialize(state)
        graph = json.dumps(state['graph'], ensure_ascii=False, indent=2, allow_nan=False)
        data = self.comp.op('GrapeControls/document')
        view = self.comp.op('graph')
        before = data.text, view.text
        try:
            data.text = saved
            view.text = graph
        except Exception:
            data.text, view.text = before
            raise

    def status(self, phase, message, **details):
        data = self.comp.op('GrapeControls/status')
        if data:
            data.text = json.dumps({'phase': phase, 'message': message,
                'targetId': self.comp.fetch('sgrapeShaderId', None), **details},
                ensure_ascii=False, indent=2)

    def _verify_gpu(self, comp):
        shader = self.shader_operator(comp)
        shader.cook(force=True)
        info = comp.op('compile_info')
        info.cook(force=True)
        message = info.text
        error = shader.errors()
        if error or 'ERROR:' in message or message.count('Compiled Successfully') < 2:
            raise RuntimeError((error + '\n' + message).strip() or 'TD has not confirmed Shader compilation.')
        return message

    def _validate_candidate(self, candidate, validation_area):
        # This disposable native compiler target is never a delivered Family.
        # No timers, polling, Manager expressions or parameter callbacks exist.
        comp = validation_area.create(baseCOMP, 'candidate_' + uuid.uuid4().hex[:12])
        try:
            pixel = comp.create(textDAT, 'pixel_shader')
            pixel.text = candidate['compiled']['pixel']
            shader = comp.create(glslTOP, 'shader')
            shader.par.pixeldat = 'pixel_shader'
            shader.par.glslversion = self.shader_operator(self.comp).par.glslversion.eval()
            shader.par.outputresolution = 'custom'
            shader.par.resolutionw = 16
            shader.par.resolutionh = 16
            shader.par.format = 'rgba32float'
            info = comp.create(infoDAT, 'compile_info')
            info.par.op = 'shader'
            self.sources.configure(self, comp, candidate['graph'], {}, input_owner=self.comp,
                                   used={row['id'] for row in candidate['compiled']['bindings']})
            return self._verify_gpu(comp)
        finally:
            comp.destroy()

    def apply(self, body, *, catalog_hash, validation_area, initial=False):
        if initial and self.comp.op('GrapeControls/document').text:
            raise RuntimeError('This Family already has a saved document; initialization cannot replace it.')
        if not initial:
            self.sources.sync(self)
        current = None if initial else self.state()
        candidate = self.artifact.receive(body,
            target_id=self.comp.fetch('sgrapeShaderId', None),
            revision=0 if initial else current['revision'], catalog_hash=catalog_hash)
        # Public-control creation still belongs to the native controls adapter.
        # Do not silently accept exposure metadata while creating no control.
        if any(row.get('expose') for row in candidate['graph']['declarations']):
            raise RuntimeError('Public Uniform exposure is not connected to this new Family adapter yet.')
        phase = 'gpu-validation'
        try:
            self._validate_candidate(candidate, validation_area)
            phase = 'native-apply'
            before = self.sources.capture_configuration(self, self.comp)
            pixel = self.comp.op('pixel_shader')
            previous_code = pixel.text
            try:
                self.sources.configure(self, self.comp, candidate['graph'], {},
                    used={row['id'] for row in candidate['compiled']['bindings']})
                if pixel.text != candidate['compiled']['pixel']:
                    pixel.text = candidate['compiled']['pixel']
                compile_info = self._verify_gpu(self.comp)
                state = self.document.create(candidate) if initial else self.document.accept(current, candidate)
                self.write_state(state)
            except Exception as error:
                rollback_errors = []
                try:
                    self.sources.restore_configuration(self, self.comp, before)
                except Exception as rollback_error:
                    rollback_errors.append('native parameters: ' + str(rollback_error))
                try:
                    pixel.text = previous_code
                except Exception as rollback_error:
                    rollback_errors.append('GLSL source: ' + str(rollback_error))
                if rollback_errors:
                    failure = RuntimeError('Native Apply failed and rollback needs review: ' + str(error))
                    failure.rollback_errors = rollback_errors
                    raise failure from error
                raise
        except Exception as error:
            rollback_errors = getattr(error, 'rollback_errors', [])
            self.status('rollback-failed' if rollback_errors else phase, str(error),
                        exception=type(error).__name__, rollbackErrors=rollback_errors)
            raise
        self.status('applied', 'Frontend GLSL and native bindings applied', revision=state['revision'],
                    producer=candidate['protocol'], catalogHash=candidate['catalogHash'])
        return {'ok': True, 'state': state, 'target': self.comp.path,
                'compileInfo': compile_info, 'shaderUpdated': previous_code != candidate['compiled']['pixel']}
