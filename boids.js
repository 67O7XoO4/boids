
(function(){

    const COLOR_PREFIX = "rgba(85, 150, 250 ";

    //to compute FPS
    var lastRun;

    // canvas config (Size,...). These get updated after browser loading.
    let canvasConfig = {w : 150, h: 150};
    let mousePos = {x: 0, y:0, out: true}; //out = mouse over or not

    var boids = [];
    let rules = [];

    //randomly create boids
    function initBoids() {
        boids = [];

        let mean = config.speedLimit / 2;

        for (var i = 0; i < config.numBoids; i += 1) {
            boids[boids.length] = {
                x: Math.random() * canvasConfig.w,
                y: Math.random() * canvasConfig.h,
                dx: Math.random() * config.speedLimit - mean,
                dy: Math.random() * config.speedLimit - mean,
                history: [],
            };
        }
    }

    function distance(boid1, boid2) {
        //pythagore
        return Math.sqrt(
            (boid1.x - boid2.x) * (boid1.x - boid2.x) +
            (boid1.y - boid2.y) * (boid1.y - boid2.y),
        );
    }

    // Called initially and whenever the window resizes to update the canvas
    // get size: width/height variables.
    function initCanvas() {
        canvasConfig.displayedCanvas = document.getElementById("boidsCanvas");
        //map the canvas size to the displayed size
        canvasConfig.displayedCanvas.width= canvasConfig.displayedCanvas.clientWidth;
        canvasConfig.displayedCanvas.height= canvasConfig.displayedCanvas.clientHeight;
        //save the size
        canvasConfig.w = canvasConfig.displayedCanvas.clientWidth;
        canvasConfig.h = canvasConfig.displayedCanvas.clientHeight;
        
        canvasConfig.offscreenCanvas = document.createElement('canvas');
        canvasConfig.offscreenCanvas.width = canvasConfig.displayedCanvas.width;
        canvasConfig.offscreenCanvas.height = canvasConfig.displayedCanvas.height;
        

        canvasConfig.displayedCanvas.addEventListener('mouseout', function(evt) {           
            mousePos.out = true;
        }, false);

        canvasConfig.displayedCanvas.addEventListener('mousemove', function(evt) {
            var rect = canvasConfig.displayedCanvas.getBoundingClientRect();

            mousePos.out = false;

            mousePos.x = evt.clientX - rect.left;
            mousePos.y = evt.clientY - rect.top;
        }, false);
    }

    // Constrain a boid to within the window. If it gets too close to an edge,
    // nudge it back in and reverse its direction.
    function keepWithinBounds(boid) {
        
        if ( ! config.margin) {
            //if no margin, boid bounce 
            let nextX = boid.x + boid.dx;
            let nextY = boid.y + boid.dy;
            
            if (nextX < 0 || nextX > canvasConfig.w) {
                boid.dx = -boid.dx;
            }
            
            if (nextY < 0 || nextY > canvasConfig.h) {
                boid.dy = -boid.dy;
            }
        }else{
            const turnFactor = 1;
        
            if (boid.x < config.margin) {
                boid.dx += turnFactor;
            }
            if (boid.x > canvasConfig.w - config.margin) {
                boid.dx -= turnFactor
            }
            if (boid.y < config.margin) {
                boid.dy += turnFactor;
            }
            if (boid.y > canvasConfig.h - config.margin) {
                boid.dy -= turnFactor;
            }
        }
    }

    //fly Towards Center
    rules.push((() => {
        let centerX = 0;
        let centerY = 0;
        let numNeighbors = 0;

        return {
            enabled : function(){
                centerX = 0;
                centerY = 0;
                numNeighbors = 0;

                return config.centeringFactor;
            },

            getDistance : function(){
                return config.visualRange;
            },

            compareTo : function(boid, otherBoid){
                centerX += otherBoid.x;
                centerY += otherBoid.y;
                numNeighbors += 1;
            },
            
            decide : function(boid){
                if (numNeighbors) {

                    centerX = centerX / numNeighbors;
                    centerY = centerY / numNeighbors;
        
                    boid.dx += (centerX - boid.x) * config.centeringFactor / 1000;
                    boid.dy += (centerY - boid.y) * config.centeringFactor / 1000;
                }
            }
        }
    })()    );


    //avoid other boids
    rules.push((() => {
        return {
            enabled : function(){
                return config.avoidFactor;
            },

            getDistance : function(){
                return config.minDistance;
            },

            compareTo : function(boid, otherBoid){
                avoid(boid, otherBoid, config.minDistance, config.avoidFactor); 
            },
            
            decide : function(boid){    }
        }
    })()    );

    // Move away from the mouse
    function avoidMouse(boid) {

        if ( ! config.avoidMouseFactor || mousePos.out) return;

        avoid(boid, mousePos, config.mouseMinDistance, config.avoidMouseFactor);        
    }

    //move the given boid away from 'other' from the given 'avoidFactor' only if the distance between them is inferior to 'minDistance'
    function avoid(boid, other, minDistance, avoidFactor){
        let dist = distance(boid, other);
        if (dist < minDistance) {
             //the closest the otherBoid is, the bigger the move will be
            let distX = boid.x - other.x;
            boid.dx += distX ? (distX / Math.abs(distX)) * avoidFactor / dist : avoidFactor;
            let distY = boid.y - other.y;
            boid.dy += distY ? (distY / Math.abs(distY)) * avoidFactor / dist : avoidFactor;
        }
    }


    //match Velocity and direction
    rules.push((() => {
        let avgDX = 0;
        let avgDY = 0;
        let numNeighbors = 0;

        return {
            enabled : function(){
                avgDX = 0;
                avgDY = 0;
                numNeighbors = 0;

                return config.matchVelocityFactor;
            },

            getDistance : function(){
                return config.visualRange;
            },

            compareTo : function(boid, otherBoid){
                avgDX += otherBoid.dx;
                avgDY += otherBoid.dy;
                numNeighbors += 1; 
            },
            
            decide : function(boid){
                if (numNeighbors) {

                    avgDX = avgDX / numNeighbors;
                    avgDY = avgDY / numNeighbors;
        
                    boid.dx += (avgDX - boid.dx) * config.matchVelocityFactor / 100;
                    boid.dy += (avgDY - boid.dy) * config.matchVelocityFactor / 100;
                }
            }
        }
    })()    );



    // Speed will naturally vary in flocking behavior, but real animals can't go
    // arbitrarily fast.
    function limitSpeed(boid) {
        if ( ! config.speedLimit) return;

        const speedLimit = config.speedLimit;

        const speed = Math.sqrt(boid.dx * boid.dx + boid.dy * boid.dy);
        if (speed > speedLimit) {
            boid.dx = (boid.dx / speed) * speedLimit;
            boid.dy = (boid.dy / speed) * speedLimit;
        }
    }

    //
    function drawBoid(ctx, boid) {
        const angle = Math.atan2(boid.dy, boid.dx);
        ctx.translate(boid.x, boid.y);
        ctx.rotate(angle);
        ctx.translate(-boid.x, -boid.y);
        ctx.fillStyle = COLOR_PREFIX+")";
        ctx.beginPath();
        ctx.moveTo(boid.x, boid.y);
        ctx.lineTo(boid.x - 15, boid.y + 5);
        ctx.lineTo(boid.x - 15, boid.y - 5);
        ctx.lineTo(boid.x, boid.y);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (config.drawTrail) {
            ctx.strokeStyle = COLOR_PREFIX+")";
            ctx.beginPath();
            ctx.moveTo(boid.history[0][0], boid.history[0][1]);
            for (const point of boid.history) {
                ctx.lineTo(point[0], point[1]);
            }
            ctx.stroke();
        }
        
        if (config.showMinDistance) {
            var a = 0.2;
            ctx.fillStyle = COLOR_PREFIX+"," + a + ")";
            ctx.beginPath();
            ctx.arc(boid.x, boid.y,config.minDistance,0,2*Math.PI);
            ctx.fill();
        }
        if (config.showVisualRange) {
            var a = 0.5;
            ctx.strokeStyle = COLOR_PREFIX+"," + a + ")";
            ctx.beginPath();
            ctx.arc(boid.x, boid.y,config.visualRange,0,2*Math.PI);
            ctx.stroke();
        }
    }

    //
    function drawAllCanvas(){
                
        // Clear the canvas and redraw all the boids in their current positions
        let ctx = canvasConfig.offscreenCanvas.getContext("2d");
        ctx.clearRect(0, 0, canvasConfig.w, canvasConfig.h);

        boids.forEach(boid => drawBoid(ctx, boid));

        //show mouse distance
        if ( ! mousePos.out && config.showMouseMinDistance){
            var a = 0.1;
            ctx.fillStyle = "rgba(100, 240, 240, " + a + ")";
            ctx.beginPath();
            ctx.arc(Math.floor(mousePos.x), Math.floor(mousePos.y), config.mouseMinDistance,0 , 2*Math.PI);
            ctx.fill();
        }

        //display on real canvas
        ctx = canvasConfig.displayedCanvas.getContext("2d");

        ctx.clearRect(0, 0, canvasConfig.w, canvasConfig.h);
        ctx.drawImage(canvasConfig.offscreenCanvas, 0, 0);
    }

    // Main animation loop
    function animationLoop() {

        if(!lastRun) {
            lastRun = performance.now();
            animationLoop();
            return ;
        }

        var delta = (performance.now() - lastRun)/1000;
        lastRun = performance.now();

        config.fps = Math.floor(1/delta);

        // for each boid
        boids.forEach(boid => {

            if (config.applyRules){

                //apply each rule if enabled
                rules.forEach(rule => {

                    if (rule.enabled()) {

                        //compare with other boid
                        boids.forEach(otherBoid => {
                            if (otherBoid !== boid && distance(boid, otherBoid) < rule.getDistance()) {
                                rule.compareTo(boid, otherBoid)
                            }
                        });

                        //and decide what to do
                        rule.decide(boid);
                    }
                })

                avoidMouse(boid);
            }

            limitSpeed(boid);
            keepWithinBounds(boid);

            // Update the position based on the current velocity
            boid.x += boid.dx;
            boid.y += boid.dy;
            boid.history.push([boid.x, boid.y])
            //keep last 50 positions
            boid.history = boid.history.slice(-50);

        });

        drawAllCanvas();

        // Schedule the next frame
        window.requestAnimationFrame(animationLoop);
    }

    window.onload = () => {
        // Make sure the canvas always fills the whole window
        window.addEventListener("resize", initCanvas, false);
        initCanvas();

        // Randomly distribute the boids to start
        initBoids();

        // Schedule the main animation loop
        window.requestAnimationFrame(animationLoop);
    };

    var config = new Vue({
        el: '#config',
        data: {
            applyRules  : true,
            matchVelocityFactor: 5,
            speedLimit  : 10,
            numBoids    : 60,
            visualRange : 75, 
            minDistance : 20, 
            drawTrail   : false,
            showMinDistance : false,
            showVisualRange : false,
            margin      : 100,
            avoidFactor : 5,
            centeringFactor     : 5,
            avoidMouseFactor    : 20,
            mouseMinDistance    : 50,
            showMouseMinDistance    : false ,
            fps : 10 //not very config !!
        },
        watch: {
            // whenever numBoids changes, this function will run
            numBoids: _.debounce(initBoids, 500)
        },
        methods: {
            
        }
    })

})();
