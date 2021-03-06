/// <reference path="../node_modules/@types/jquery/index.d.ts"/>
/// <reference path="../node_modules/@types/dat-gui/index.d.ts"/>
/// <reference path="../svg.js.d.ts"/>
var Point = (function () {
    function Point(x, y) {
        this.x = x;
        this.y = y;
    }
    Point.prototype.clone = function () {
        return new Point(this.x, this.y);
    };
    Point.prototype.add = function (b) {
        return new Point(this.x + b.x, this.y + b.y);
    };
    Point.prototype.subtract = function (b) {
        return new Point(this.x - b.x, this.y - b.y);
    };
    Point.prototype.multiply = function (f) {
        return new Point(this.x * f, this.y * f);
    };
    Point.prototype.divide = function (f) {
        return new Point(this.x / f, this.y / f);
    };
    Point.prototype.length = function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    };
    Point.prototype.distTo = function (b) {
        return b.subtract(this).length();
    };
    Point.prototype.alignedWith = function (b, c) {
        return this.x * (b.y - c.y) + b.x * (c.y - this.y) + c.x * (this.y - c.y) < 0.01;
    };
    return Point;
}());
document.addEventListener("DOMContentLoaded", function (event) {
    var canvas = document.getElementById('canvas');
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    var svg = SVG("svgContainer"); //.size('100%', '100%').spof()
    SVG.on(window, 'resize', function () { svg.spof(); });
    var svgElement = document.getElementById('svgContainer');
    svgElement.style.visibility = 'hidden';
    svg.width = canvas.clientWidth;
    svg.height = canvas.clientWidth;
    var context = canvas.getContext('2d');
    $ = jQuery;
    var position = $(canvas).position();
    var cityWidth = canvas.width;
    var cityHeight = canvas.height;
    var handles = [];
    var nHandleMax = 10;
    var city = {
        width: cityWidth,
        height: cityHeight,
        left: position.left,
        top: position.top,
        nActors: 100,
        lifetimeMax: 1000,
        angleVariation: 0,
        generationProbability: 100,
        speed: 1,
        nHandles: 3,
        recordSVG: false,
        reset: init,
        toggleHandles: function () { return handles.forEach(function (h) { return h.toggle(); }); },
        saveSVG: function () {
            svgElement.style.visibility = 'visible';
            saveSvgFile(svg, 'ili');
            svgElement.style.visibility = 'hidden';
        },
        savePNG: function () {
            canvas.toBlob(function (blob) {
                saveAs(blob, 'lil.png');
            });
        }
    };
    var gui = new dat.GUI();
    var colorControllers = [];
    for (var n = 0; n < nHandleMax; n++) {
        city['color' + n] = '#000000';
        colorControllers.push(gui.addColor(city, 'color' + n));
        if (n >= city.nHandles) {
            $(colorControllers[n].__li).hide();
        }
    }
    gui.add(city, 'speed', 1, 100);
    gui.add(city, 'generationProbability', 1, 100);
    gui.add(city, 'angleVariation', 0, 360);
    var handleController = gui.add(city, 'nHandles', 1, 10).step(1);
    handleController.onFinishChange(function (value) {
        for (var n = 0; n < handles.length; n++) {
            handles[n].destroy();
            $(colorControllers[n].__li).hide();
        }
        handles = [];
        for (var n = 0; n < city.nHandles; n++) {
            var handle = new Handle(new Point(Math.random() * city.width, Math.random() * city.height));
            handles.push(handle);
            $(colorControllers[n].__li).show();
        }
        init();
    });
    gui.add(city, 'toggleHandles');
    gui.add(city, 'reset');
    gui.add(city, 'recordSVG');
    gui.add(city, 'saveSVG');
    gui.add(city, 'savePNG');
    var OUT = -500;
    var actors = [];
    var nInitializedActors = 0;
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
    var Handle = (function () {
        function Handle(pos) {
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
        Handle.prototype.mouseDown = function (mousePosition) {
            if (this.position.distTo(mousePosition) < this.radius * 2) {
                this.dragged = true;
                this.offset = mousePosition.subtract(this.position);
            }
        };
        Handle.prototype.mouseMove = function (mousePosition) {
            if (this.dragged) {
                this.position = mousePosition.subtract(this.offset);
                context.clearRect(0, 0, city.width, city.height);
                // this.draw()
                this.handleElement.style.left = (this.position.x / window.devicePixelRatio) + 'px';
                this.handleElement.style.top = (this.position.y / window.devicePixelRatio) + 'px';
            }
        };
        Handle.prototype.mouseUp = function (mousePosition) {
            if (this.dragged) {
                this.position = mousePosition.subtract(this.offset);
                this.dragged = false;
                this.handleElement.style.left = (this.position.x / window.devicePixelRatio) + 'px';
                this.handleElement.style.top = (this.position.y / window.devicePixelRatio) + 'px';
                init();
            }
        };
        // draw() {
        //   context.beginPath();
        //   context.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI, false);
        //   context.fillStyle = this.color;
        //   context.fill();
        //   context.lineWidth = 2;
        //   context.strokeStyle = '#003300';
        //   context.stroke();
        // }
        Handle.prototype.toggle = function () {
            this.visible = !this.visible;
            this.handleElement.style.visibility = this.visible ? 'visible' : 'hidden';
        };
        Handle.prototype.destroy = function () {
            this.handleElement.remove();
        };
        return Handle;
    }());
    var Actor = (function () {
        function Actor() {
            this.speed = city.speed;
            this.reset();
            this.polyline = null;
        }
        Actor.prototype.reset = function () {
            this.position = new Point(-OUT, -OUT);
            this.previousPosition = new Point(-OUT, -OUT);
            this.positionFloat = new Point(-OUT, -OUT);
            this.initialized = false;
            this.polyline = null;
        };
        Actor.prototype.initialize = function (pos, angle, incrementNInitializedActors, color) {
            if (pos === void 0) { pos = null; }
            if (angle === void 0) { angle = null; }
            if (incrementNInitializedActors === void 0) { incrementNInitializedActors = true; }
            if (color === void 0) { color = null; }
            this.color = color;
            // if position is negative: intialize this position at a random actor position
            if (pos == null) {
                if (nInitializedActors > 0) {
                    var n = Math.floor(Math.random() * (nInitializedActors));
                    pos = actors[n].position.clone();
                    this.color = actors[n].color;
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
            this.polyline = null;
            if (incrementNInitializedActors) {
                nInitializedActors++;
            }
        };
        Actor.prototype.update = function () {
            if (!this.initialized) {
                return;
            }
            this.previousPosition.x = this.position.x;
            this.previousPosition.y = this.position.y;
            this.positionFloat.x += this.speed * Math.cos(this.angle * Math.PI / 180);
            this.positionFloat.y += this.speed * Math.sin(this.angle * Math.PI / 180);
            this.position.x = Math.round(this.positionFloat.x);
            this.position.y = Math.round(this.positionFloat.y);
            var ix = this.position.x;
            var iy = this.position.y;
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
                    actors[nInitializedActors].initialize(this.position, null, true, this.color);
                }
            }
        };
        Actor.prototype.draw = function () {
            if (!this.initialized) {
                return;
            }
            context.strokeStyle = this.color;
            context.lineWidth = 1;
            context.lineCap = 'square';
            context.beginPath();
            context.moveTo(this.previousPosition.x, this.previousPosition.y);
            context.lineTo(this.position.x, this.position.y);
            context.closePath();
            context.stroke();
            if (city.recordSVG) {
                var pp = this.previousPosition.divide(window.devicePixelRatio);
                var p = this.position.divide(window.devicePixelRatio);
                if (this.polyline == null) {
                    this.polyline = svg.polyline([[pp.x, pp.y], [p.x, p.y]]);
                    this.polyline.stroke({ width: 0.5, color: this.color }).fill('none');
                }
                else {
                    var points = this.polyline.array();
                    var secondLast = points.value[points.value.length - 2];
                    var secondLastPoint = new Point(secondLast[0], secondLast[1]);
                    secondLastPoint = secondLastPoint.divide(window.devicePixelRatio);
                    if (secondLastPoint.alignedWith(this.previousPosition, this.position)) {
                        points.value[points.value.length - 1][0] = p.x;
                        points.value[points.value.length - 1][1] = p.y;
                    }
                    else {
                        points.value.push([p.x, p.y]);
                    }
                    this.polyline.plot(points);
                }
            }
        };
        return Actor;
    }());
    for (var i = 0; i < city.nActors; i++) {
        actors.push(new Actor());
    }
    for (var n = 0; n < city.nHandles; n++) {
        var handle = new Handle(new Point(Math.random() * city.width, Math.random() * city.height));
        handles.push(handle);
    }
    function init() {
        for (var i = 0; i < city.nActors; i++) {
            actors[i].reset();
        }
        nInitializedActors = 0;
        canvas.width = canvas.clientWidth * window.devicePixelRatio;
        canvas.height = canvas.clientHeight * window.devicePixelRatio;
        context.translate(0.5, 0.5);
        context.clearRect(0, 0, canvas.width, canvas.height);
        svg.clear();
        city.width = canvas.width;
        city.height = canvas.height;
        // actors[0].initialize(new Point(20, 20), 0);
        // actors[1].initialize(new Point(city.width-20, city.height-20), 2*90);
        // actors[2].initialize(new Point(city.width-20, 20), 2*90);
        // actors[3].initialize(new Point(20, city.height-20), 0);
        for (var n = 0; n < city.nHandles; n++) {
            actors[n].initialize(handles[n].position.clone(), Math.floor(Math.random() * 4) * 90, true, city['color' + n]);
        }
    }
    function animate() {
        requestAnimationFrame(animate);
        for (var _i = 0, actors_1 = actors; _i < actors_1.length; _i++) {
            var actor = actors_1[_i];
            actor.update();
        }
    }
    init();
    animate();
    function resize() {
        init();
    }
    window.onresize = resize;
    var mouseX = 0;
    var mouseY = 0;
    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    function onDocumentMouseDown(event) {
        var mousePosition = new Point(event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio);
        for (var _i = 0, handles_1 = handles; _i < handles_1.length; _i++) {
            var handle = handles_1[_i];
            handle.mouseDown(mousePosition);
        }
    }
    function onDocumentMouseMove(event) {
        var mousePosition = new Point(event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio);
        for (var _i = 0, handles_2 = handles; _i < handles_2.length; _i++) {
            var handle = handles_2[_i];
            handle.mouseMove(mousePosition);
        }
    }
    function onDocumentMouseUp(event) {
        var mousePosition = new Point(event.clientX * window.devicePixelRatio, event.clientY * window.devicePixelRatio);
        for (var _i = 0, handles_3 = handles; _i < handles_3.length; _i++) {
            var handle = handles_3[_i];
            handle.mouseUp(mousePosition);
        }
    }
});
// function saveSvgFile(svgEl, linkLabel) {
//     svgEl.setAttribute('version', '1.1');
//     svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
//     var markup = svgEl.outerHTML;
//     var b64 = btoa(markup);
//     var aEl = document.createElement('a');
//     aEl.setAttribute('download', linkLabel + '.svg');
//     aEl.href = 'data:image/svg+xml;base64,\n' + b64;
//     document.body.appendChild(aEl);
//     aEl.click();
// }
function saveSvgFile(svgElement, filename) {
    try {
        var isFileSaverSupported = !!new Blob();
    }
    catch (e) {
        alert("blob not supported");
    }
    var blob = new Blob([svgElement.svg()], { type: "image/svg+xml" });
    saveAs(blob, filename + ".svg");
}
;
