import * as THREE from 'three';
import Stats from 'stats.js';

//CREATE STATS PAGE
var stats = new Stats();
stats.setMode(0);
stats.domElement.style.position = "absolute";
stats.domElement.style.left = "5px";
stats.domElement.style.top = "5px";
document.body.appendChild(stats.domElement);

thing = 1


// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}
console.log(getRenderWidth(), getRenderHeight());

// Set up scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.62, 1.62, 1, -1, -10, 10); //vars: left right top bottom near far
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
renderer.setClearColor(0xFF9900)
document.body.prepend(renderer.domElement);

// const geometry = new THREE.BoxGeometry( 1, 1, 1 );
// const geometry = new THREE.PlaneGeometry(2, 2)

const width = 10, height = 10   ;
const size = width * height;
const data = new Uint8Array( 4 * size );

////////
forPix = function(color, x, y, i){
    let v = Math.floor( THREE.MathUtils.seededRandom() * 255 );
    color.r = v;
    color.g = v;
    color.b = v;
    return color;
};

for ( let i = 0; i < size; i ++ ) {
    let stride = i * 4,
    x = (i % width),
    y = (Math.floor(i / width)),
    color = forPix( new THREE.Color(), x, y, i);
    data[ stride ] = color.r;
    data[ stride + 1 ] = color.g;
    data[ stride + 2 ] = color.b;
    data[ stride + 3 ] = 255;
}
/////////
const texture = new THREE.DataTexture( data, width, height );
texture.needsUpdate = true;

// const mesh = new THREE.Mesh
const material = new THREE.MeshBasicMaterial( { map: texture} );
// const plane = new THREE.Mesh( geometry, material );

const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2,2),
    new THREE.MeshBasicMaterial( { map: texture } )
)
scene.add( mesh );

// Render loop
function animate() {
    stats.begin(); // Start measuring frame
    renderer.render(scene, camera); // Render the current frame
    thing += 1;
    stats.end(); // End measuring frame
}
renderer.setAnimationLoop(animate); // Automatically calls animate in a loop