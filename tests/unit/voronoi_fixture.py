"""Independent CPU reference and graph fixtures for Voronoi GPU checks."""
import itertools
import math


def graph(c, dim=3, feature='f1', metric='euclidean', target='top', stage='pixel', output=None, **values):
    g = c.demo_graph('color', target)
    n = c.node('voronoi', 'cells', dimensions=dim, feature=feature, metric=metric)
    ports = c.resolved_ports(c.CATALOG['voronoi'], n['params'])
    n['inputValues'] = {key: value for key, value in values.items() if key in ports['inputs']}
    output = output or next(iter(ports['outputs']))
    g['stages'][stage] = dict(nodes=[n, c.node(stage+'_out', 'result')],
                             edges=[c.edge('cells', 'result', 'color' if stage == 'pixel' else 'position', output)])
    return g


def _hash(value):
    value = (value ^ (value >> 16)) * 0x7feb352d & 0xffffffff
    value = (value ^ (value >> 15)) * 0x846ca68b & 0xffffffff
    return value ^ (value >> 16)


def random(cell, salt=0):
    value = salt
    for component in cell:
        value = _hash(value ^ (component & 0xffffffff))
    return [(_hash(value ^ salt) & 0xffffff) / 16777216 for salt in
            (0x68bc21eb, 0x02e5be93, 0x967a889b, 0x368cc8b7)]


def distance(delta, metric, exponent):
    a = [abs(v) for v in delta]
    if metric == 'manhattan': return sum(a)
    if metric == 'chebyshev': return max(a)
    if metric == 'minkowski': return sum(v ** exponent for v in a) ** (1/exponent)
    return math.sqrt(sum(v*v for v in a))


def sites(center, dim, randomness, radius):
    for offset in itertools.product(range(-radius, radius+1), repeat=dim):
        cell = tuple(center[i] + offset[i] for i in range(dim)) + (0,)*(4-dim)
        jitter = random(cell)
        yield cell, [cell[i] + .5 + randomness*(jitter[i]-.5) for i in range(dim)]


def sample(point, feature='f1', metric='euclidean', randomness=1, smoothness=1, exponent=.5, radius=2):
    dim = len(point)
    center = [math.floor(v) for v in point]
    metric = metric if dim != 1 and feature in ('f1', 'f2', 'smooth_f1') else 'euclidean'
    candidates = [(distance([p-x for p, x in zip(site, point)], metric, exponent), cell, site)
                  for cell, site in sites(center, dim, randomness, radius)]
    nearest = sorted(candidates, key=lambda row: row[0])
    d, cell, pos = nearest[feature == 'f2']
    color = random(cell, 0x9e3779b9)[:3]
    if feature == 'smooth_f1' and smoothness > 0:
        k = smoothness*.5
        d, cell, pos = candidates[0]; color = random(cell, 0x9e3779b9)[:3]
        for next_d, cell, next_pos in candidates[1:]:
            h = max(0, min(1, .5+.5*(d-next_d)/k))
            d = d*(1-h)+next_d*h-k*h*(1-h)
            pos = [a*(1-h)+b*h for a, b in zip(pos, next_pos)]
            color = [a*(1-h)+b*h for a, b in zip(color, random(cell, 0x9e3779b9)[:3])]
    if feature in ('distance_to_edge', 'n_sphere_radius'):
        distances = []
        for _, site in sites(cell, dim, randomness, max(3, radius)):
            delta = [a-b for a, b in zip(site, pos)]
            length = math.sqrt(sum(x*x for x in delta))
            if length < 1e-6: continue
            distances.append(length/2 if feature == 'n_sphere_radius' else
                             sum(((a+b)/2-x)*axis for a, b, x, axis in zip(site, pos, point, delta))/length)
        d = min(distances)
    return dict(distance=max(d, 0), color=color, position=pos)


def reference(dim=3, feature='f1', metric='euclidean', normalize=False, **values):
    vector = values.get('vector', [0,0,0])
    coordinate = [values.get('w', 0)] if dim == 1 else vector[:min(dim, 3)]+([values.get('w', 0)] if dim == 4 else [])
    scale = values.get('scale', 5)
    point = [max(-1048576, min(1048576, v*scale)) for v in coordinate]
    detail = max(0, min(15, values.get('detail', 0)))
    roughness = max(0, min(1, values.get('roughness', .5)))
    lacunarity = max(0, min(16, values.get('lacunarity', 2)))
    randomness = max(0, min(1, values.get('randomness', 1)))
    smoothness = max(0, min(1, values.get('smoothness', 1)))
    exponent = max(.125, min(32, values.get('exponent', .5)))
    if feature == 'n_sphere_radius': return {'radius': sample(point, feature, randomness=randomness)['distance']}
    total, color, pos, weights, amplitude, frequency = 0, [0]*3, [0]*dim, 0, 1, 1
    for octave in range(16):
        weight = amplitude*max(0, min(1, detail+1-octave))
        if weight <= 0: break
        result = sample([max(-1048576, min(1048576, v*frequency)) for v in point], feature, metric, randomness, smoothness, exponent)
        total += weight*result['distance']; weights += weight
        color = [a+weight*b for a, b in zip(color, result['color'])]
        if abs(scale*frequency) > 1e-8: pos = [a+weight*b/(scale*frequency) for a, b in zip(pos, result['position'])]
        amplitude *= roughness; frequency = min(frequency*lacunarity, 1048576)
    if normalize:
        bound = math.sqrt(dim) if feature == 'distance_to_edge' else distance(
            [2 if feature == 'f2' else 1]+[1]*(dim-1), metric if dim != 1 else 'euclidean', exponent)
        total = max(0, min(1, total/(weights*bound)))
    result = {'distance': total}
    if feature != 'distance_to_edge':
        result['color'] = [v/weights for v in color]+[1]
        if dim != 1: result['position'] = [v/weights for v in pos[:3]]+([0] if dim == 2 else [])
        if dim in (1, 4): result['w'] = pos[-1]/weights
    return result
