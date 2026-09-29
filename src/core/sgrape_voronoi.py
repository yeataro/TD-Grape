"""Independent cellular noise implementation; no Blender or host shader source.

Modes are compile-time choices. A fixed cell stencil bounds GPU work even for
fractional Minkowski exponents; this is procedural noise, not a mesh Voronoi
solver. See docs/features/VORONOI.md for the numerical and search contract.
"""
DIMENSIONS = (1, 2, 3, 4)
FEATURES = ('f1', 'f2', 'smooth_f1', 'distance_to_edge', 'n_sphere_radius')
METRICS = ('euclidean', 'manhattan', 'chebyshev', 'minkowski')
DEFAULTS = dict(dimensions=3, feature='f1', metric='euclidean', normalize=False)
INPUT_DEFAULTS = dict(vector=0, w=0, scale=5, detail=0, roughness=.5,
                      lacunarity=2, smoothness=1, exponent=.5, randomness=1)


def settings(params):
    values = {key: params.get(key, value) for key, value in DEFAULTS.items()}
    if (type(values['dimensions']) is not int or values['dimensions'] not in DIMENSIONS
            or values['feature'] not in FEATURES or values['metric'] not in METRICS
            or type(values['normalize']) is not bool):
        raise ValueError('Voronoi: invalid dimensions, feature, metric or Normalize option')
    return values


def interface(params):
    p = settings(params)
    dim, feature = p['dimensions'], p['feature']
    nearest = feature in ('f1', 'f2', 'smooth_f1')
    inputs = {}
    if dim != 1: inputs['vector'] = 'vec3'
    if dim in (1, 4): inputs['w'] = 'float'
    inputs['scale'] = 'float'
    if feature != 'n_sphere_radius':
        inputs.update(detail='float', roughness='float', lacunarity='float')
    if feature == 'smooth_f1': inputs['smoothness'] = 'float'
    if nearest and dim != 1 and p['metric'] == 'minkowski': inputs['exponent'] = 'float'
    inputs['randomness'] = 'float'
    outputs = {'radius' if feature == 'n_sphere_radius' else 'distance': 'float'}
    if nearest:
        outputs['color'] = 'vec4'
        if dim != 1: outputs['position'] = 'vec3'
        if dim in (1, 4): outputs['w'] = 'float'
    return dict(inputs=inputs, outputs=outputs)


def contract():
    return dict(dimensions=list(DIMENSIONS), features=list(FEATURES), metrics=list(METRICS),
                defaults=dict(DEFAULTS), interfaces={
                    f'{dim}:{feature}:{metric}': interface(dict(dimensions=dim, feature=feature, metric=metric))
                    for dim in DIMENSIONS for feature in FEATURES for metric in METRICS})


# Integer hashing avoids sine-based cell seams and platform-dependent huge sin
# arguments. Unsigned overflow is intentional; the last 24 bits fit a float.
COMMON = '''struct sg_VoronoiResult { float distance; vec3 color; vec4 position; };
uint sg_voronoiHash(uint x) {
    x ^= x >> 16u; x *= 0x7feb352du;
    x ^= x >> 15u; x *= 0x846ca68bu;
    return x ^ (x >> 16u);
}
vec4 sg_voronoiRandom(ivec4 cell, uint salt) {
    uint h = sg_voronoiHash(uint(cell.x) ^ salt);
    h = sg_voronoiHash(h ^ uint(cell.y));
    h = sg_voronoiHash(h ^ uint(cell.z));
    h = sg_voronoiHash(h ^ uint(cell.w));
    return vec4(sg_voronoiHash(h ^ 0x68bc21ebu) & 0x00ffffffu,
                sg_voronoiHash(h ^ 0x02e5be93u) & 0x00ffffffu,
                sg_voronoiHash(h ^ 0x967a889bu) & 0x00ffffffu,
                sg_voronoiHash(h ^ 0x368cc8b7u) & 0x00ffffffu) / 16777216.0;
}'''


def specialization(params):
    p = settings(params)
    metric = p['metric'] if p['dimensions'] != 1 and p['feature'] in ('f1', 'f2', 'smooth_f1') else 'euclidean'
    normalized = p['normalize'] and p['feature'] != 'n_sphere_radius'
    return f"sg_voronoi_{p['dimensions']}_{p['feature']}_{metric}_{int(normalized)}"


def _loop(dim, radius, body):
    axes = 'xyzw'[:dim]
    return '\n'.join([f'    for (int {a} = -{radius}; {a} <= {radius}; ++{a}) {{' for a in axes]
                     + ['    ivec4 offset = ivec4(' + ', '.join(list(axes) + ['0'] * (4-dim)) + ');']
                     + ['    ' + line for line in body.splitlines()] + ['    }' for _ in axes])


def helper(params):
    """Generate only the selected dimensionality/feature/metric, shared per stage."""
    p = settings(params)
    dim, feature = p['dimensions'], p['feature']
    if dim == 1 or feature in ('distance_to_edge', 'n_sphere_radius'): p['metric'] = 'euclidean'
    if feature == 'n_sphere_radius': p['normalize'] = False
    metric = p['metric']
    name = specialization(p)
    active = 'vec4(' + ', '.join(['1.0'] * dim + ['0.0'] * (4-dim)) + ')'
    terms = [f'd.{axis}' for axis in 'xyzw'[:dim]]
    if dim == 1: distance = 'd.x'
    elif metric == 'manhattan': distance = ' + '.join(terms)
    elif metric == 'chebyshev':
        distance = terms[0]
        for term in terms[1:]: distance = f'max({distance}, {term})'
    elif metric == 'minkowski':
        # Scale before raising powers. This is stable for p=32 and zero vectors.
        distance = 'm * pow(' + ' + '.join(f'pow({term} / m, exponent)' for term in terms) + ', 1.0 / exponent)'
    else: distance = 'length(d)'
    metric_function = f'''float {name}_metric(vec4 delta, float exponent) {{
    vec4 d = abs(delta);
    float m = max(max(d.x, d.y), max(d.z, d.w));
    if (m == 0.0) return 0.0;
    return {distance};
}}'''
    nearest_body = f'''ivec4 cell = base + offset;
vec4 site = vec4(offset) + mix(vec4(0.5), sg_voronoiRandom(cell, 0u), randomness);
site *= {active};
float distance = {name}_metric(site - local, exponent);'''
    if feature == 'smooth_f1':
        nearest_body += '''
vec3 color = sg_voronoiRandom(cell, 0x9e3779b9u).rgb;
if (first.distance > 1e18) first = sg_VoronoiResult(distance, color, site);
else if (smoothness > 0.0) {
    float h = clamp(0.5 + 0.5 * (first.distance - distance) / smoothness, 0.0, 1.0);
    first.distance = mix(first.distance, distance, h) - smoothness * h * (1.0 - h);
    first.color = mix(first.color, color, h);
    first.position = mix(first.position, site, h);
} else if (distance < first.distance) first = sg_VoronoiResult(distance, color, site);'''
    else:
        nearest_body += '''
if (distance < first.distance) {
    second = first;
    first = sg_VoronoiResult(distance, sg_voronoiRandom(cell, 0x9e3779b9u).rgb, site);
    winningCell = cell;
} else if (distance < second.distance) second = sg_VoronoiResult(distance, sg_voronoiRandom(cell, 0x9e3779b9u).rgb, site);'''
    if feature in ('distance_to_edge', 'n_sphere_radius'):
        # Both geometric features use Euclidean sites irrespective of hidden metric.
        nearest_body = nearest_body.replace(f'{name}_metric(site - local, exponent)', 'length(site - local)')
    result = 'second' if feature == 'f2' else 'first'
    extra = ''
    if feature in ('distance_to_edge', 'n_sphere_radius'):
        extra = '    float boundary = 1e20;\n' + _loop(dim, 3, f'''ivec4 cell = winningCell + offset;
vec4 other = (vec4(cell - base) + mix(vec4(0.5), sg_voronoiRandom(cell, 0u), randomness)) * {active};
vec4 separation = other - first.position;
float separationLength = length(separation);
if (separationLength > 1e-6) {{
    float candidate = {'0.5 * separationLength' if feature == 'n_sphere_radius' else 'dot(0.5 * (other + first.position) - local, separation / separationLength)'};
    boundary = min(boundary, candidate);
}}''') + '\n    first.distance = max(boundary, 0.0);\n'
    octave = metric_function + f'''
sg_VoronoiResult {name}_sample(vec4 point, float randomness, float smoothness, float exponent) {{
    ivec4 base = ivec4(floor(point));
    vec4 local = fract(point);
    sg_VoronoiResult first = sg_VoronoiResult(1e20, vec3(0.0), vec4(0.0));
    sg_VoronoiResult second = first;
    ivec4 winningCell = base;
{_loop(dim, 2, nearest_body)}
{extra}    sg_VoronoiResult result = {result};
    result.distance = max(result.distance, 0.0);
    result.position += vec4(base);
    return result;
}}
'''
    norm = '1.0'
    if feature in ('f1', 'f2', 'smooth_f1'):
        # An upper bound from this cell (F1) and a face neighbor (F2).
        delta = 'vec4(' + ', '.join((['2.0'] + ['1.0'] * (dim-1) if feature == 'f2' else ['1.0'] * dim) + ['0.0'] * (4-dim)) + ')'
        norm = f'{name}_metric({delta}, exponent)'
    elif feature == 'distance_to_edge': norm = str(float(dim ** .5))
    normalization = f'result.distance = clamp(result.distance / (weights * {norm}), 0.0, 1.0);' if p['normalize'] else ''
    if feature == 'n_sphere_radius':
        body = f'''sg_VoronoiResult result = {name}_sample(point, randomness, 0.0, exponent);
    return result;'''
    else:
        body = f'''sg_VoronoiResult result = sg_VoronoiResult(0.0, vec3(0.0), vec4(0.0));
    float weights = 0.0, amplitude = 1.0, frequency = 1.0;
    detail = clamp(detail, 0.0, 15.0);
    roughness = clamp(roughness, 0.0, 1.0);
    lacunarity = clamp(lacunarity, 0.0, 16.0);
    for (int octave = 0; octave <= 15; ++octave) {{
        float weight = amplitude * clamp(detail + 1.0 - float(octave), 0.0, 1.0);
        if (weight <= 0.0) break;
        vec4 coordinate = clamp(point * frequency, vec4(-1048576.0), vec4(1048576.0));
        sg_VoronoiResult sampleValue = {name}_sample(coordinate, randomness, smoothness, exponent);
        result.distance += weight * sampleValue.distance;
        result.color += weight * sampleValue.color;
        if (abs(scale * frequency) > 1e-8) result.position += weight * sampleValue.position / (scale * frequency);
        weights += weight;
        amplitude *= roughness;
        frequency = min(frequency * lacunarity, 1048576.0);
    }}
    result.color /= weights;
    result.position /= weights;
    {normalization}
    return result;'''
    return octave + f'''
sg_VoronoiResult {name}(vec4 coordinate, float scale, float detail, float roughness,
        float lacunarity, float smoothness, float exponent, float randomness) {{
    vec4 point = clamp(coordinate * scale, vec4(-1048576.0), vec4(1048576.0)) * {active};
    randomness = clamp(randomness, 0.0, 1.0);
    smoothness = clamp(smoothness, 0.0, 1.0) * 0.5;
    exponent = clamp(exponent, 0.125, 32.0);
    {body}
}}'''
