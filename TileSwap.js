var puzzleModel;
var puzzleViewer;
var puzzleControl;

var TO_RADIANS = Math.PI/180;

function SwapPair(pos1, pos2) {
    this.pos1 = Math.min(pos1, pos2);
    this.pos2 = Math.max(pos1, pos2);
}

SwapPair.prototype.toString = function() {
    return "(" + this.pos1 + ", " + this.pos2 + ")";
}

function MoveSequence(puzzleModel) {
    this.model = puzzleModel;
    this.sequence = "";
}

MoveSequence.prototype.numMoves = function() {
    return this.sequence.length;
}

MoveSequence.prototype.addMove = function(swapPair) {
    var moveValue = swapPair.pos1; // 0 <= val <= numTiles - 2
    if (swapPair.pos2 > swapPair.pos1 + 1) {
        moveValue += (this.model.numTiles - 1);
    }
    var moveChar = String.fromCharCode(65 + moveValue);

    // TODO: Replace with sequence.endsWith(moveChar) once that is widely supported.
    if (this.sequence.length > 0 && this.sequence.charAt(this.sequence.length - 1) == moveChar) {
        // Move is an undo of the last move. Treat it as such.
        this.sequence = this.sequence.substr(0, this.sequence.length - 1);
    } else {
        this.sequence = this.sequence + moveChar;
    }
}

MoveSequence.prototype.moveAt = function(moveIndex) {
    var moveValue = this.sequence.charCodeAt(moveIndex) - 65;
    var posDelta;
    if (moveValue >= this.model.numTiles - 1) {
        posDelta = this.model.numCols;
        moveValue -= this.model.numTiles - 1;
    } else {
        posDelta = 1;
    }
    return new SwapPair(moveValue, moveValue + posDelta);
}

MoveSequence.prototype.lastMove = function() {
    if (this.sequence.length > 0) {
        return this.moveAt(this.sequence.length - 1);
    }
}

MoveSequence.prototype.reset = function() {
    this.sequence = "";
}

function PuzzleModel(numCols, numRows) {
    this.numCols = numCols;
    this.numRows = numRows;
    this.numTiles = numCols * numRows;
    this.tiles = [];
    this.moves = new MoveSequence(this);

    this.reset();
}

PuzzleModel.prototype.reset = function() {
    var i;
    for (i = 0; i < this.numTiles; i++) {
        this.tiles[i] = this.numTiles - i - 1;
    }
    this.moves.reset();
}

PuzzleModel.prototype.isSolved = function() {
    var i;
    for (i = 0; i < this.numTiles; i++) {
        if (this.tiles[i] != i) {
            return false;
        }
    }
    return true;
}

PuzzleModel.prototype.tileAt = function(tilePos) {
    return this.tiles[tilePos];
}

PuzzleModel.prototype.tileValueAt = function(tilePos) {
    return this.tiles[tilePos] + 1;
}

PuzzleModel.prototype.canSwapTiles = function(swapPair) {
    var sum = this.tileValueAt(swapPair.pos1) + this.tileValueAt(swapPair.pos2);
    return (sum % 3) == 0 || (sum % 5) == 0;
}

PuzzleModel.prototype.swapTiles = function(swapPair) {
    var tile1 = this.tiles[swapPair.pos1];
    this.tiles[swapPair.pos1] = this.tiles[swapPair.pos2];
    this.tiles[swapPair.pos2] = tile1;
}

PuzzleModel.prototype.trySwapTiles = function(swapPair) {
    if (this.canSwapTiles(swapPair)) {
        this.swapTiles(swapPair);
        this.moves.addMove(swapPair);
        return true;
    }
    return false;
}

function PuzzleViewer(puzzleModel, emptyTileImage, dotImage) {
    this.model = puzzleModel;
    this.tileElements = [];
    this.tileSprites = [];
    this.canvas = document.getElementById("puzzleCanvas");

    this.initTileSprites(emptyTileImage, dotImage);
    this.tileSize = emptyTileImage.width;

    // Constants
    this.borderTileSep = 30;
    this.tileDistance = 82;
    this.borderFrameSep = 10;
    this.frameCornerR = 30;
}

PuzzleViewer.prototype.initTileSprites = function(emptyTileImage, dotImage) {
    var dotsForTiles = [
        [4],
        [0, 8],
        [0, 4, 8],
        [0, 2, 6, 8],
        [0, 2, 4, 6, 8],
        [0, 2, 3, 5, 6, 8],
        [0, 2, 3, 4, 5, 6, 8],
        [0, 1, 2, 3, 5, 6, 7, 8],
        [0, 1, 2, 3, 4, 5, 6, 7, 8]
    ];

    var i;
    for (i = 0; i < this.model.numTiles; i++) {
        this.tileSprites[i] = new TileSprite(
            dotsForTiles[i], emptyTileImage, dotImage
        );
    }
}

PuzzleViewer.prototype.drawFrame = function(ctx) {
    var r = this.frameCornerR;
    var x0 = this.borderFrameSep;
    var y0 = x0;
    var w = this.tileSize + (this.model.numCols - 1) * this.tileDistance +
        2 * (this.borderTileSep - this.borderFrameSep);
    var h = this.tileSize + (this.model.numRows - 1) * this.tileDistance +
        2 * (this.borderTileSep - this.borderFrameSep);

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(x0 + r,     y0 + r,     r, Math.PI, 1.5 * Math.PI, false);
    ctx.arc(x0 + w - r, y0 + r,     r, 1.5 * Math.PI, 2 * Math.PI, false);
    ctx.arc(x0 + w - r, y0 + h - r, r, 0, 0.5 * Math.PI, false);
    ctx.arc(x0 + r,     y0 + h - r, r, 0.5 * Math.PI, Math.PI, false);
    ctx.closePath();
    ctx.fill();
}

PuzzleViewer.prototype.drawPuzzle = function() {
    var ctx = this.canvas.getContext("2d");
    var x0 = this.borderTileSep + this.tileSize / 2;
    var y0 = x0;
    var i;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawFrame(ctx);

    for (i = 0; i < this.model.numTiles; i++) {
        var x = x0 + (i % this.model.numCols) * this.tileDistance;
        var y = y0 + Math.floor(i / this.model.numCols) * this.tileDistance;

        //console.log("Draw tile " + this.model.tileAt(i) + " at " + x + ", " + y);
        var sprite = this.tileSprites[this.model.tileAt(i)];
        if ( !sprite.isPivotting ) {
            sprite.x = x;
            sprite.y = y;
            sprite.draw(ctx);
        }
    }

    if (this.pivot) {
        this.pivot.draw(ctx);
    }
}

PuzzleViewer.prototype.swapPairAt = function(x, y) {
    var x = x - this.borderTileSep;
    var y = y - this.borderTileSep;

    var onCol = x % this.tileDistance < this.tileSize;
    var onRow = y % this.tileDistance < this.tileSize;

    var row = Math.floor(y / this.tileDistance);
    var col = Math.floor(x / this.tileDistance);

    var tileCols = this.model.numCols;
    if (onCol && !onRow && col >= 0 && col < tileCols) {
        // Vertical Swap
        return new SwapPair(col + row * tileCols, col + (row + 1) * tileCols);
    }
    if (!onCol && onRow && row >= 0 && row < this.model.numRows) {
        // Horizontal Swap
        return new SwapPair(col + row * tileCols, col + row * tileCols + 1);
    }
}

function PuzzleControl(puzzleModel, puzzleViewer) {
    this.model = puzzleModel;
    this.viewer = puzzleViewer;

    var me = this;
    this.viewer.canvas.addEventListener("mousedown", function(evt) { me.handleClick(evt) });
}

PuzzleControl.prototype.handleClick = function(evt) {
    if (this.animation) return;

    var rect = this.viewer.canvas.getBoundingClientRect();
    var x = evt.clientX - rect.left;
    var y = evt.clientY - rect.top;
    //console.log("Handle click at " + x + ", " + y);

    var swapPair = this.viewer.swapPairAt(x, y);
    if (swapPair) {
        this.trySwapTiles(swapPair);
    }
}

PuzzleControl.prototype.trySwapTiles = function(swapPair, callback) {
    console.log("Try swapping " + swapPair);
    if (this.model.trySwapTiles(swapPair)) {
        this.animation = new SwapAnimation(
            this.viewer.tileSprites[this.model.tileAt(swapPair.pos1)],
            this.viewer.tileSprites[this.model.tileAt(swapPair.pos2)],
            this.viewer.tileSize
        );
        if (!callback) {
            var me = this;
            callback = function() { me.swapDone(); };
        }
        this.animation.go(callback);
    }
}

PuzzleControl.prototype.swapDone = function() {
    this.animation = null;

    document.getElementById("moves").value = this.model.moves.sequence;
    if (this.model.isSolved()) {
        displayStatus("Solved in " + this.model.moves.numMoves() + " moves!");
    } else {
        displayStatus(this.model.moves.numMoves() + " moves");
    }
}

PuzzleControl.prototype.resetPuzzle = function() {
    if (this.animation) return;

    this.model.reset();
    this.viewer.drawPuzzle();
    displayStatus("Try again!");
}

PuzzleControl.prototype.undoMove = function() {
    if (this.animation) return;

    var swapPair = this.model.moves.lastMove();
    if (swapPair) {
        console.log("Undoing " + swapPair);
        this.trySwapTiles(swapPair);
    }
}

PuzzleControl.prototype.replayMoves = function() {
    if (this.animation) return;

    this.resetPuzzle();

    // Take from input field, so that user can inject sequence
    var moves = new MoveSequence(this.model);
    moves.sequence = document.getElementById("moves").value;

    var movesReplay = new MovesReplay(moves, this);
    movesReplay.replayNextMove();
}

function MovesReplay(moves, puzzleControl) {
    this.moves = moves;
    this.control = puzzleControl;
}

MovesReplay.prototype.replayNextMove = function() {
    var movesSofar = this.control.model.moves.numMoves();
    if (movesSofar == this.moves.numMoves()) {
        // All done
        this.control.swapDone();
    } else {
        displayStatus("Replaying move " + (movesSofar + 1));
        var me = this;
        // Replay next move
        this.control.trySwapTiles(
            this.moves.moveAt(movesSofar),
            function() { me.replayNextMove() }
        );
    }
}


function Sprite() {
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
}

// Draws the sprite, taking into account position and rotation
Sprite.prototype.draw = function(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * TO_RADIANS);

    // Draw the sprite placed at the origin in normal orientation
    this.basicDraw(ctx);

    ctx.restore();
}

function TileSprite(dots, emptyTileImage, dotImage) {
    Sprite.call(this);

    this.dots = dots;
    this.emptyTileImage = emptyTileImage;
    this.dotImage = dotImage;

    // Constants
    this.dotTileSep = 13;
    this.dotMod = 3;
}
TileSprite.prototype = Object.create(Sprite.prototype);

TileSprite.prototype.basicDraw = function(ctx) {
    var x0 = -this.emptyTileImage.width / 2;
    var y0 = -this.emptyTileImage.height / 2;
    ctx.drawImage(this.emptyTileImage, x0, y0);

    var i;
	var dotSep = (this.emptyTileImage.width - 2 * this.dotTileSep) / (this.dotMod - 1);
    var dotSize = this.dotImage.width;
    for (i = 0; i < this.dots.length; i++) {
        var dot = this.dots[i];
		var dotx = this.dotTileSep + (dot % this.dotMod) * dotSep - dotSize / 2;
		var doty = this.dotTileSep + Math.floor(dot / this.dotMod) * dotSep - dotSize / 2;

        ctx.drawImage(this.dotImage, x0 + dotx, y0 + doty);
    }
}

function Pivot(tileSprite1, tileSprite2) {
    Sprite.call(this);

    this.sprites = [];
}
Pivot.prototype = Object.create(Sprite.prototype);

Pivot.prototype.basicDraw = function(ctx) {
    var i;
    for (i = 0; i < this.sprites.length; i++) {
        this.sprites[i].draw(ctx);
    }
}

Pivot.prototype.addSprite = function(sprite) {
    sprite.isPivotting = true;

    this.sprites.push(sprite);
    sprite.x -= this.x;
    sprite.y -= this.y;
}

Pivot.prototype.destroy = function() {
    var i;
    for (i = 0; i < this.sprites.length; i++) {
        this.sprites[i].isPivotting = false;
    }
    this.sprites = null;
}

function SwapAnimation(tileSprite1, tileSprite2, tileSize) {
    var pivot = new Pivot();
    pivot.x = (tileSprite1.x + tileSprite2.x) / 2;
    pivot.y = (tileSprite1.y + tileSprite2.y) / 2;
    pivot.addSprite(tileSprite1);
    pivot.addSprite(tileSprite2);

    puzzleViewer.pivot = pivot;

    this.moveDeltaX = this.moveDelta(tileSprite1.x, tileSprite2.x, tileSize);
    this.moveDeltaY = this.moveDelta(tileSprite1.y, tileSprite2.y, tileSize);

    this.phaseSteps = 0;
}

// The amount that each tile should move
SwapAnimation.prototype.moveDelta = function(coord1, coord2, tileSize) {
    var delta = coord2 - coord1;
    if (delta > tileSize) {
        return (delta - tileSize) / 2;
    }
    if (-delta > tileSize) {
        return (delta + tileSize) / 2;
    }
    return 0;
}

SwapAnimation.prototype.go = function(callback) {
    this.callback = callback;
    var me = this;
    this.id = setInterval(function() { me.step() }, 5);
}

SwapAnimation.prototype.step = function() {
    if ( !this.tilesConnected ) {
        if (this.moveTilesStep(1)) {
            this.tilesConnected = true;
            this.phaseSteps = 0;
        }
    } else if ( !this.tilesSwapped ) {
        if (this.swapTilesStep()) {
            this.tilesSwapped = true;
            this.phaseSteps = 0;
        }
    } else {
        if (this.moveTilesStep(-1)) {
            this.animationDone = true;
            puzzleViewer.pivot.destroy();
            puzzleViewer.pivot = null;
        }
    }

    puzzleViewer.drawPuzzle();

    if (this.animationDone) {
        clearInterval(this.id);
        // Invoke after drawPuzzle with pivot cleared. This ensures that both swapped tile
        // positions are updated
        this.callback();
    }
}

SwapAnimation.prototype.moveTilesStep = function(direction) {
    var phaseStepsTotal = 30;
    var pivot = puzzleViewer.pivot;

    this.phaseSteps++;
    pivot.sprites[0].x += direction * this.moveDeltaX / phaseStepsTotal;
    pivot.sprites[1].x -= direction * this.moveDeltaX / phaseStepsTotal;
    pivot.sprites[0].y += direction * this.moveDeltaY / phaseStepsTotal;
    pivot.sprites[1].y -= direction * this.moveDeltaY / phaseStepsTotal;

    return this.phaseSteps == phaseStepsTotal;
}

SwapAnimation.prototype.swapTilesStep = function() {
    var phaseStepsTotal = 100;
    var pivot = puzzleViewer.pivot;

    this.phaseSteps++;
    pivot.rotation = 180 * this.phaseSteps / phaseStepsTotal;

    return this.phaseSteps == phaseStepsTotal;
}

function displayStatus(statusText) {
    document.getElementById("status").innerHTML = statusText;
}

function preloadImages(srcs, imgs, callback) {
    var img;
    var remaining = srcs.length;
    for (var i = 0; i < srcs.length; i++) {
        img = new Image();
        img.onload = function() {
            --remaining;
            if (remaining <= 0) {
                callback();
            }
        };
        img.src = srcs[i];
        imgs.push(img);
    }
}

function init() {
    puzzleModel = new PuzzleModel(3, 3);

    displayStatus("Loading Images");
    var tileImages = [];
    preloadImages(
        ["Images/Tile.png", "Images/Dot.png"],
        tileImages,
        function() {
            puzzleViewer = new PuzzleViewer(puzzleModel, tileImages[0], tileImages[1]);
            puzzleControl = new PuzzleControl(puzzleModel, puzzleViewer);

            puzzleViewer.drawPuzzle();
            displayStatus("Try me!");
        }
    );
}

init();