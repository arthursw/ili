/// <reference path="../node_modules/@types/jquery/index.d.ts"/>
/// <reference path="../node_modules/@types/dat-gui/index.d.ts"/>
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    clone() {
        return new Point(this.x, this.y);
    }
    add(b) {
        return new Point(this.x + b.x, this.y + b.y);
    }
    subtract(b) {
        return new Point(this.x - b.x, this.y - b.y);
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    distTo(b) {
        return b.subtract(this).length();
    }
}
document.addEventListener("DOMContentLoaded", function (event) {
    let canvas = document.getElementById('canvas');
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    let context = canvas.getContext('2d');
    $ = jQuery;
    let position = $(canvas).position();
    let cityWidth = canvas.width;
    let cityHeight = canvas.height;
    let handles = [];
    let city = {
        width: cityWidth,
        height: cityHeight,
        left: position.left,
        top: position.top,
        nActors: 100,
        lifetimeMax: 1000,
        angleVariation: 0,
        generationProbability: 10,
        color: '#000000',
        speed: 10,
        nHandles: 3,
        reset: init,
        toggleHandles: () => handles.forEach((h) => h.toggle())
    };
    var gui = new dat.GUI();
    gui.addColor(city, 'color');
    gui.add(city, 'speed', 1, 100);
    gui.add(city, 'generationProbability', 1, 100);
    gui.add(city, 'angleVariation', 0, 360);
    gui.add(city, 'toggleHandles');
    gui.add(city, 'reset');
    var handleController = gui.add(city, 'nHandles', 1, 10).step(1);
    handleController.onFinishChange(function (value) {
        for (let n = 0; n < handles.length; n++) {
            handles[n].destroy();
        }
        handles = [];
        for (let n = 0; n < city.nHandles; n++) {
            let handle = new Handle(new Point(Math.random() * city.width, Math.random() * city.height));
            handles.push(handle);
        }
        init();
    });
    let OUT = -500;
    let actors = [];
    let nInitializedActors = 0;
    function getCityAt(x, y) {
        return context.getImageData(x, y, 1, 1).data[3];
        // return context.getImageData(0, 0, city.width, city.height).data[4 * (x + y * city.width)]
        // return city.map[4 * (x + (city.height - y) * city.width)]
        // return city.map != null ? city.map.data[4 * (x + y * city.width)] : 0
        // return cityMap[x][y]
        //
        // let data = context.getImageData(x-1, y-1, 2, 2).data;
        // let average = 0;
        // for(let i=0 ; i<4 ; i++) {
        // 	average += data[i*4];
        // }
        // average /= 4;
        // return average > 120 ? 1 : 0;
    }
    function vToString(v) {
        return 'x: ' + v.x + ', y: ' + v.y;
    }
    class Handle {
        constructor(pos) {
            this.position = pos;
            this.radius = 17;
            this.color = '#CC3482';
            this.dragged = false;
            this.handleElement = document.createElement("div");
            this.handleElement.setAttribute('class', 'handle');
            this.visible = true;
            document.body.insertBefore(this.handleElement, canvas);
            this.handleElement.style.backgroundColor = "#6699ff";
            this.handleElement.style.borderRadius = '10px';
            this.handleElement.style.width = '15px';
            this.handleElement.style.height = '15px';
            this.handleElement.style.position = 'absolute';
            this.handleElement.style.left = (this.position.x / window.devicePixelRatio) + 'px';
            this.handleElement.style.top = (this.position.y / window.devicePixelRatio) + 'px';
            this.handleElement.style.visibility = 'hidden';
        }
        mouseDown(mousePosition) {
            console.log('mp: ' + mousePosition.x + ', ' + mousePosition.y + ' -- x: ' + this.position.x + ', y: ' + this.position.y + ', : ' + this.position.distTo(mousePosition));
            if (this.position.distTo(mousePosition) < this.radius * 2) {
                this.dragged = true;
                this.offset = mousePosition.subtract(this.position);
                console.log('handle down');
            }
        }
        mouseMove(mousePosition) {
            if (this.dragged) {
                console.log('handle move to: ' + this.position.x);
                this.position = mousePosition.subtract(this.offset);
                context.clearRect(0, 0, city.width, city.height);
                // this.draw()
                this.handleElement.style.left = (this.position.x / window.devicePixelRatio) + 'px';
                this.handleElement.style.top = (this.position.y / window.devicePixelRatio) + 'px';
            }
        }
        mouseUp(mousePosition) {
            if (this.dragged) {
                console.log('handle up to: ' + this.position.x);
                this.position = mousePosition.subtract(this.offset);
                this.dragged = false;
                this.handleElement.style.left = (this.position.x / window.devicePixelRatio) + 'px';
                this.handleElement.style.top = (this.position.y / window.devicePixelRatio) + 'px';
                init();
            }
        }
        draw() {
            context.beginPath();
            context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI, false);
            context.fillStyle = this.color;
            context.fill();
            context.lineWidth = 2;
            context.strokeStyle = '#003300';
            context.stroke();
        }
        toggle() {
            this.visible = !this.visible;
            this.handleElement.style.visibility = this.visible ? 'visible' : 'hidden';
        }
        destroy() {
            this.handleElement.remove();
        }
    }
    class Actor {
        constructor() {
            this.speed = city.speed;
            this.reset();
        }
        reset() {
            this.position = new Point(-OUT, -OUT);
            this.previousPosition = new Point(-OUT, -OUT);
            this.positionFloat = new Point(-OUT, -OUT);
            this.initialized = false;
        }
        initialize(pos = null, angle = null, incrementNInitializedActors = true) {
            // if position is negative: intialize this position at a random actor position
            if (pos == null) {
                if (nInitializedActors > 0) {
                    let n = Math.floor(Math.random() * (nInitializedActors));
                    pos = actors[n].position.clone();
                }
                else {
                    pos = new Point(city.width / 2, city.height / 2);
                }
            }
            this.position.x = pos.x;
            this.position.y = pos.y;
            this.positionFloat.x = pos.x;
            this.positionFloat.y = pos.y;
            this.previousPosition.x = this.position.x;
            this.previousPosition.y = this.position.y;
            this.angle = angle != null ? angle : Math.floor(Math.random() * 5) * 90;
            this.lifetime = angle != null ? 10000000000 : Math.random() * city.lifetimeMax;
            this.time = 0;
            this.initialized = true;
            this.speed = city.speed;
            if (incrementNInitializedActors) {
                nInitializedActors++;
            }
        }
        update() {
            if (!this.initialized) {
                return;
            }
            this.previousPosition.x = this.position.x;
            this.previousPosition.y = this.position.y;
            this.positionFloat.x += this.speed * Math.cos(this.angle * Math.PI / 180);
            this.positionFloat.y += this.speed * Math.sin(this.angle * Math.PI / 180);
            this.position.x = Math.round(this.positionFloat.x);
            this.position.y = Math.round(this.positionFloat.y);
            let ix = this.position.x;
            let iy = this.position.y;
            if (ix < 0 || iy < 0 ||
                ix >= city.width - 1 || iy >= city.height - 1 ||
                getCityAt(ix, iy) > 0 || this.time > this.lifetime) {
                this.initialize(null, null, false);
                return;
            }
            this.draw();
            this.angle += (Math.random() - 0.5) * city.angleVariation;
            this.time++;
            if (Math.random() * 100 < city.generationProbability) {
                if (nInitializedActors < actors.length) {
                    actors[nInitializedActors].initialize(this.position);
                }
            }
        }
        draw() {
            context.strokeStyle = city.color;
            context.lineWidth = 1;
            context.lineCap = 'square';
            context.beginPath();
            context.moveTo(this.previousPosition.x, this.previousPosition.y);
            context.lineTo(this.position.x, this.position.y);
            context.closePath();
            context.stroke();
        }
    }
    for (let i = 0; i < city.nActors; i++) {
        actors.push(new Actor());
    }
    for (let n = 0; n < city.nHandles; n++) {
        let handle = new Handle(new Point(Math.random() * city.width, Math.random() * city.height));
        handles.push(handle);
    }
    function init() {
        for (let i = 0; i < city.nActors; i++) {
            actors[i].reset();
        }
        nInitializedActors = 0;
        canvas.width = canvas.clientWidth * window.devicePixelRatio;
        canvas.height = canvas.clientHeight * window.devicePixelRatio;
        context.translate(0.5, 0.5);
        context.clearRect(0, 0, canvas.width, canvas.height);
        city.width = canvas.width;
        city.height = canvas.height;
        // actors[0].initialize(new Point(20, 20), 0);
        // actors[1].initialize(new Point(city.width-20, city.height-20), 2*90);
        // actors[2].initialize(new Point(city.width-20, 20), 2*90);
        // actors[3].initialize(new Point(20, city.height-20), 0);
        for (let n = 0; n < city.nHandles; n++) {
            actors[n].initialize(handles[n].position.clone(), 0);
        }
    }
    function animate() {
        requestAnimationFrame(animate);
        for (let actor of actors) {
            actor.update();
        }
    }
    init();
    animate();
    function resize() {
        init();
    }
    window.onresize = resize;
    let mouseX = 0;
    let mouseY = 0;
    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    function onDocumentMouseDown(event) {
        let mousePosition = new Point(event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio);
        for (let handle of handles) {
            handle.mouseDown(mousePosition);
        }
    }
    function onDocumentMouseMove(event) {
        let mousePosition = new Point(event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio);
        for (let handle of handles) {
            handle.mouseMove(mousePosition);
        }
    }
    function onDocumentMouseUp(event) {
        let mousePosition = new Point(event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio);
        for (let handle of handles) {
            handle.mouseUp(mousePosition);
        }
    }
});
