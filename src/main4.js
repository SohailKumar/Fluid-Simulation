import * as THREE from 'three';
import Stats from 'stats.js';

////////////
/// Set up for stats
////////////
function setupStats(){
    stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = "absolute";
    stats.domElement.style.left = "5px";
    stats.domElement.style.top = "5px";
    document.body.appendChild(stats.domElement);
}

setupStats();

function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}

var stats;
var scene;
var camera;
var renderer;
var thing = 0;

////////////
/// Set up scene, camera, and renderer
////////////
function setupScene(){
    scene = new THREE.Scene();
    width = getRenderWidth();
    height = getRenderHeight();
    camera = new THREE.OrthographicCamera( width / - 2, width / 2, height / 2, height / - 2, 1, 1000 );
    camera.position.z = 2;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
    renderer.setSize(getRenderWidth(), getRenderHeight());
    renderer.setClearColor(0xff0000, 1)
    
    document.body.prepend(renderer.domElement);
}

setupScene();

var bufferScene;
var textureA;
var textureB;
var bufferMaterial;
var geo;
var bufferMesh;
var finalMaterial;
var finalMesh;

function setupGeoAndBuffer(){
    bufferScene = new THREE.Scene()

    textureA = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter}) //{ minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter}
    textureB = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter})

     //Pass textureA to shader
    bufferMaterial = new THREE.ShaderMaterial( {
        uniforms: {
         bufferTexture: { type: "t", value: textureA },
         res : {type: 'v2',value: new THREE.Vector2(window.innerWidth,window.innerHeight)},//Keeps the resolution
         smokeSource: {type:"v3",value:new THREE.Vector3(0,0,0)}///This keeps the position of the mouse and whether it was clicked or not
        },
        fragmentShader: document.getElementById( 'fragShader' ).innerHTML
    } );

    geo = new THREE.PlaneGeometry(getRenderWidth(), getRenderHeight())
    bufferMesh = new THREE.Mesh(geo, bufferMaterial)
    bufferScene.add(bufferMesh)

    //render texture b on screen
    finalMaterial = new THREE.MeshBasicMaterial({map: textureB.texture});
    finalMesh = new THREE.Mesh(geo, finalMaterial)
    scene.add(finalMesh)
}
setupGeoAndBuffer();

//Send position of mouse posistion source with value
var mouseDown = false;
function UpdateMousePosition(X,Y){
    var mouseX = X;
    var mouseY = window.innerHeight - Y;
    bufferMaterial.uniforms.mouseInput.value.x = mouseX;
    bufferMaterial.uniforms.mouseInput.value.y = mouseY;
}
document.onmousemove = function(event){
    UpdateMousePosition(event.clientX,event.clientY)
}

document.onmousedown = function(event){
    mouseDown = true;
    bufferMaterial.uniforms.mouseInput.value.z = 0.1;
}
document.onmouseup = function(event){
    mouseDown = false;
    bufferMaterial.uniforms.mouseInput.value.z = 0;
}


//Render everything!
function render() {

    requestAnimationFrame( render );
    
    //Draw to textureB
    renderer.setRenderTarget( textureB );
    renderer.render(bufferScene,camera);
      
    //Swap textureA and B 
    var t = textureA;
    textureA = textureB;
    textureB = t;
    finalMesh.material.map = textureB.texture;
    bufferMaterial.uniforms.bufferTexture.value = textureA.texture;
    // thing+=0.1;

    //Finally, draw to the screen
    renderer.setRenderTarget( null );
    renderer.render( scene, camera );

}
render();


// const vertexShader = loadShader('/shaders/vertexShader.glsl');
// const fragmentShader = loadShader('/shaders/fragmentShader.glsl');    
// const geo = new THREE.PlaneGeometry(2,2)
// const lbmMaterial = new THREE.ShaderMaterial({
//     uniforms: {
//         // Define your uniforms here
//         u_time: { value: 0 },
//         u_resolution: { value: new THREE.Vector2() },
//         u_texture: { value: null }
//     },
//     vertexShader: `
//         varying vec2 vUv;

//         void main()
//         {
//             vUv = uv;
//             gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//         }
//     `,
//     fragmentShader: `
//         uniform float u_time;
//         uniform vec2 u_resolution;
//         uniform sampler2D u_texture;

//         varying vec2 vUv;

//         void main() {
//         // Implement LBM algorithm here
//         // Example: Simple fluid movement
//         vec2 st = gl_FragCoord.xy / u_resolution;
//         vec2 uv = vUv + 0.1 * vec2(cos(u_time), sin(u_time));
//         vec4 color = texture2D(u_texture, uv);
        
//         gl_FragColor = color;
//         }
//     `
// })

// const textureSize = 256;
// const data = new Uint8Array(4 * textureSize * textureSize);
// for (let i = 0; i < data.length; i += 4) {
//   data[i] = Math.random() * 255;
//   data[i + 1] = Math.random() * 255;
//   data[i + 2] = Math.random() * 255;
//   data[i + 3] = 255;
// }
// const texture = new THREE.DataTexture(data, textureSize, textureSize, THREE.RGBAFormat);
// texture.needsUpdate = true;

// lbmMaterial.uniforms.u_texture.value = texture;

// const mesh = new THREE.Mesh(geo, lbmMaterial);
// scene.add( mesh );


// function animate() {
//     stats.begin()
//     requestAnimationFrame(animate);

//     lbmMaterial.uniforms.u_time.value += 0.05;
//     lbmMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);

//     renderer.render(scene, camera);
//     stats.end()
// }

// setupStats();
// animate();