precision highp float;

uniform sampler2D uTexture; // Texture storing post-collision distributions
uniform vec2 uGridSize;                // Grid size (resolution)

const vec2 c[9] = vec2[](
    vec2(0.0, 0.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(-1.0, 0.0),
    vec2(0.0, -1.0),
    vec2(1.0, 1.0),
    vec2(-1.0, 1.0),
    vec2(-1.0, -1.0),
    vec2(1.0, -1.0)
);

void main() {
    vec2 uv = gl_FragCoord.xy / uGridSize;
    vec3 f[9];

    // Stream distributions from neighboring cells
    for (int i = 0; i < 9; i++) {
        vec2 neighborUV = clamp(uv - c[i] / uGridSize, vec2(0.0), vec2(1.0));
f[i] = texture2D(uTexture, neighborUV).rgb;
    }

    // Output the streamed distributions
    gl_FragColor = vec4(f[0].r, f[1].r, f[2].r, 1.0);
}