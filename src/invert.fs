uniform sampler2D uTexture;

void main() {
    vec4 color = texture2D(uTexture, gl_FragCoord.xy / vec2(128, 128));  // assuming 512x512 texture resolution
    gl_FragColor = vec4(1.0 - color.rgb, 1.0);  // Invert the color
}