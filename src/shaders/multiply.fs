uniform sampler2D uTexture;

void main() {
    vec4 color = texture2D(uTexture, gl_FragCoord.xy / vec2(128, 128));
    gl_FragColor = color * vec4(0.5, 1.0, 0.5, 1.0); // Multiply color by greenish color
}