// uint indexOfDirection(int i, int j) {
//     return 3*(j+1) + (i+1);
// }
// // 6,7,8,
// // 3,4,5,
// // 0,1,2    

// uint indexOfLatticeCell(uint x, uint y) {
//     return q*nX*y + q*x;
// }
precision highp float;

uniform sampler2D uCurrentState; // Texture storing the current distributions f_i
uniform float uOmega;            // Relaxation parameter (omega)
uniform vec2 uGridSize;          // Grid size (resolution)

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

const float w[9] = float[](4.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 36.0, 1.0 / 36.0, 1.0 / 36.0, 1.0 / 36.0);

void main() {
    vec2 uv = gl_FragCoord.xy / uGridSize;
    vec3 f[9];

    // Load the distributions for all 
    for (int i = 0; i < 9; i++) {
        f[i] = texture2D(uCurrentState, uv).rgb;
    }

    // Compute macroscopic density and velocity
    float rho = 0.0;
    vec2 u = vec2(0.0);
    for (int i = 0; i < 9; i++) {
        rho += f[i].r;
        u += c[i] * f[i].r;
    }
    u /= rho;

    // Compute equilibrium distribution f_i^eq
    vec3 fEq[9];
    for (int i = 0; i < 9; i++) {
        float cu = dot(c[i], u);
        fEq[i] = vec3(w[i] * rho * (1.0 + 3.0 * cu + 4.5 * cu * cu - 1.5 * dot(u, u)));
    }

    // Apply BGK collision
    vec3 fPostCollision[9];
    for (int i = 0; i < 9; i++) {
        fPostCollision[i] = f[i] + uOmega * (fEq[i] - f[i]);
    }

    // Output the post-collision distributions
    gl_FragColor = vec4(fPostCollision[0].r, fPostCollision[1].r, fPostCollision[2].r, 1.0);
}