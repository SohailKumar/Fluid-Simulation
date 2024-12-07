import * as THREE from 'three';
import Stats from 'stats.js';

////////////
/// Set up for stats
////////////
var stats;

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
    
    camera = new THREE.OrthographicCamera(-1.5, 1.5, 1, -1, 1, 1000); //vars: left right top bottom near far
    camera.position.z = 2;

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
    renderer.setSize(getRenderWidth(), getRenderHeight());
    renderer.setClearColor(0xff0000, 1)
    
    // document.body.prepend(renderer.domElement);
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
            mouseInput: {type:"v3",value:new THREE.Vector3(0,0,0)}///This keeps the position of the mouse and whether it was clicked or not
        },
        // fragmentShader: document.getElementById( 'fragShader' ).innerHTML
        vertexShader: `varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        fragmentShader: `varying vec2 vUv;
void main() {
    gl_FragColor = vec4(vUv.x, vUv.y, 1.0, 1.0);
}`
    } );

    geo = new THREE.PlaneGeometry(2,2)
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
