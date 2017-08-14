"use strict";

var puzzleModel;
var puzzleViewer;
var puzzleControl;

var TO_RADIANS = Math.PI/180;

function drawRoundedBox(ctx, x0, y0, w, h, r) {
    ctx.beginPath();
    ctx.arc(x0 + r,     y0 + r,     r, Math.PI, 1.5 * Math.PI, false);
    ctx.arc(x0 + w - r, y0 + r,     r, 1.5 * Math.PI, 2 * Math.PI, false);
    ctx.arc(x0 + w - r, y0 + h - r, r, 0, 0.5 * Math.PI, false);
    ctx.arc(x0 + r,     y0 + h - r, r, 0.5 * Math.PI, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

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

MoveSequence.prototype.toBase64 = function() {
    var code;
    var salt = Math.floor(Math.random() * 256);
    var codeMoveLen = Math.min(this.numMoves(), 255);
    var i, v;
    code = String.fromCharCode(salt);
    code = code + String.fromCharCode(codeMoveLen);
    for (i = 0; i < codeMoveLen; ) {
        v = (this.sequence.charCodeAt(i++) - 65) << 4;
        if (i < codeMoveLen) {
            v += this.sequence.charCodeAt(i++) - 65;
        }
        code = code + (String.fromCharCode(v ^ salt));
    }
    return btoa(code);
}

MoveSequence.prototype.fromBase64 = function(base64Code) {
    var code = atob(base64Code);
    var salt, codeMoveLen;
    var i, v;

    this.sequence = "";

    if (code.length < 2) {
        console.log("Code too short");
        return;
    }
    salt = code.charCodeAt(0);
    codeMoveLen = code.charCodeAt(1);

    if (code.length < 2 + Math.floor((codeMoveLen + 1) / 2)) {
        console.log("Too few move characters");
        return;
    }

    for (i = 0; i < codeMoveLen; ) {
        v = code.charCodeAt(2 + i / 2) ^ salt;
        this.sequence = this.sequence + String.fromCharCode(65 + ((v >> 4) & 15));
        i++;
        if (i < codeMoveLen) {
            this.sequence = this.sequence + String.fromCharCode(65 + (v & 15));
            i++;
        }
    }
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

function PuzzleViewer(puzzleModel) {
    this.model = puzzleModel;
    this.tileElements = [];
    this.tileSprites = [];
    this.canvas = document.getElementById("puzzleCanvas");

    this.updateSizes(this.canvas.width);
    this.initTileSprites();
}

// Set sizes of the various puzzle elements based on the size of the view
PuzzleViewer.prototype.updateSizes = function(viewWidth) {
    var cols = this.model.numCols;
    var rows = this.model.numRows;

    // Relative sizes (wrt to tile size)
    var tileSepRel = 0.46; // Distance between tiles
    var tileBorderSepRel = 0.54; // Distance between tile and canvas
    var tileFrameSepRel = 0.35; // Distance between tile and frame
    var dotTileSepRel = 0.23; // Distance between center of dot and tile border

    this.tileSize = viewWidth / (cols + (cols - 1) * tileSepRel + 2 * tileBorderSepRel);
    console.log("tileSize = " + this.tileSize);

    this.tileDistance = this.tileSize * (1 + tileSepRel);
    this.tilePos0 = this.tileSize * (0.5 + tileBorderSepRel);
    this.tileR = this.tileSize * 0.25;

    this.dotR = this.tileSize * 0.09;
    this.dotPos0 = this.tileSize * dotTileSepRel;
    this.dotDistance = this.tileSize * (1 - 2 * dotTileSepRel) / 2;

    this.framePos0 = this.tileSize * (tileBorderSepRel - tileFrameSepRel);
    this.frameW = this.tileSize * (1 + 2 * tileFrameSepRel) + (cols - 1) * this.tileDistance;
    this.frameH = this.tileSize * (1 + 2 * tileFrameSepRel) + (rows - 1) * this.tileDistance;
    this.frameR = this.tileSize * 0.50;
}

PuzzleViewer.prototype.initTileSprites = function() {
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
            dotsForTiles[i], this
        );
    }
}

PuzzleViewer.prototype.drawFrame = function(ctx) {
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#808080";
    drawRoundedBox(
        ctx, this.framePos0, this.framePos0, this.frameW, this.frameH, this.frameR
    );
}

PuzzleViewer.prototype.drawTile = function(ctx, sprite, tileIndex) {
    sprite.x = this.tilePos0 + (tileIndex % this.model.numCols) * this.tileDistance;
    sprite.y = this.tilePos0 + Math.floor(tileIndex / this.model.numCols) * this.tileDistance;
    sprite.draw(ctx);
}

PuzzleViewer.prototype.drawPuzzle = function() {
    var ctx = this.canvas.getContext("2d");
    var i;

    // Clear canvas
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawFrame(ctx);

    for (i = 0; i < this.model.numTiles; i++) {
        var sprite = this.tileSprites[this.model.tileAt(i)];
        if ( !sprite.isPivotting ) {
            this.drawTile(ctx, sprite, i);
        }
    }

    if (this.pivot) {
        this.pivot.draw(ctx);
    }
}

PuzzleViewer.prototype.swapPairAt = function(x, y) {
    var x = x - this.tilePos0 + this.tileSize / 2;
    var y = y - this.tilePos0 + this.tileSize / 2;

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
            this.viewer
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
        displayStatus("Well done!");
        var me = this;
        var callback = function() { me.solveAnimationDone(); };
        this.animation = new SolveAnimation(this.viewer);
        this.animation.go(callback);
    } else {
        displayStatus(this.model.moves.numMoves() + " moves");
    }
}

PuzzleControl.prototype.solveAnimationDone = function() {
    this.animation = null;

    displayStatus("Solved in " + this.model.moves.numMoves() + " moves!");
    var solveCode = this.model.moves.toBase64();
    document.getElementById("solveCode").value = solveCode;
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

// Set the moves field based on the code in the solveCode area.
// A subsequent replay will then replay these.
PuzzleControl.prototype.movesFromCode = function() {
    if (this.animation) return;

    var solveCode = document.getElementById("solveCode").value;
    console.log("solveCode = " + solveCode);
    var solveSequence = new MoveSequence(this.model);
    solveSequence.fromBase64(solveCode);
    console.log("sequence = " + solveSequence.sequence);

    moves.sequence = document.getElementById("moves").value = solveSequence.sequence;
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

function TileSprite(dots, puzzleViewer) {
    Sprite.call(this);

    this.dots = dots;
    this.viewer = puzzleViewer;
    this.dotMod = 3;
}
TileSprite.prototype = Object.create(Sprite.prototype);

TileSprite.prototype.basicDraw = function(ctx) {
    var tileSize = this.viewer.tileSize;
    var pos0 = -tileSize / 2;

    ctx.fillStyle = "#FF0000";
    ctx.strokeStyle = "#800000";
    drawRoundedBox(ctx, pos0, pos0, tileSize, tileSize, this.viewer.tileR);

    var i;
    var dotPos0 = pos0 + this.viewer.dotPos0;
    var dotDist = this.viewer.dotDistance;
    ctx.fillStyle = "#FFFFFF";
    for (i = 0; i < this.dots.length; i++) {
        var dot = this.dots[i];
		var dotx = dotPos0 + (dot % this.dotMod) * dotDist;
		var doty = dotPos0 + Math.floor(dot / this.dotMod) * dotDist;

        ctx.beginPath();
        ctx.arc(dotx, doty, this.viewer.dotR, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
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

function SwapAnimation(tileSprite1, tileSprite2, viewer) {
    this.viewer = viewer;

    var pivot = new Pivot();
    pivot.x = (tileSprite1.x + tileSprite2.x) / 2;
    pivot.y = (tileSprite1.y + tileSprite2.y) / 2;
    pivot.addSprite(tileSprite1);
    pivot.addSprite(tileSprite2);

    this.viewer.pivot = pivot;
    this.moveDeltaX = this.moveDelta(tileSprite1.x, tileSprite2.x, this.viewer.tileSize);
    this.moveDeltaY = this.moveDelta(tileSprite1.y, tileSprite2.y, this.viewer.tileSize);

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
            this.viewer.pivot.destroy();
            this.viewer.pivot = null;
        }
    }

    this.viewer.drawPuzzle();

    if (this.animationDone) {
        clearInterval(this.id);
        // Invoke after drawPuzzle with pivot cleared. This ensures that both swapped tile
        // positions are updated
        this.callback();
    }
}

SwapAnimation.prototype.moveTilesStep = function(direction) {
    var phaseStepsTotal = 30;
    var pivot = this.viewer.pivot;

    this.phaseSteps++;
    pivot.sprites[0].x += direction * this.moveDeltaX / phaseStepsTotal;
    pivot.sprites[1].x -= direction * this.moveDeltaX / phaseStepsTotal;
    pivot.sprites[0].y += direction * this.moveDeltaY / phaseStepsTotal;
    pivot.sprites[1].y -= direction * this.moveDeltaY / phaseStepsTotal;

    return this.phaseSteps == phaseStepsTotal;
}

SwapAnimation.prototype.swapTilesStep = function() {
    var phaseStepsTotal = 100;
    var pivot = this.viewer.pivot;

    this.phaseSteps++;
    pivot.rotation = 180 * this.phaseSteps / phaseStepsTotal;

    return this.phaseSteps == phaseStepsTotal;
}

function SolveAnimation(viewer) {
    this.viewer = viewer;
    this.steps = 0;
    this.numSteps = 1000;
}

SolveAnimation.prototype.go = function(callback) {
    this.callback = callback;
    var me = this;
    this.id = setInterval(function() { me.step() }, 5);
}

SolveAnimation.prototype.step = function() {
    var i;
    var model = this.viewer.model;

    this.steps++;
    for (i = 0; i < model.numTiles; i++) {
        var sign = (i % 2) * 2 - 1;
        this.viewer.tileSprites[i].rotation =
            this.steps * sign * (360 * 5 / this.numSteps);
    }

    this.viewer.drawPuzzle();

    if (this.steps == this.numSteps) {
        clearInterval(this.id);
        this.callback();
    }
}

function displayStatus(statusText) {
    document.getElementById("status").innerHTML = "<center>" + statusText + "</center>";
}

function init() {
    puzzleModel = new PuzzleModel(3, 3);
    puzzleViewer = new PuzzleViewer(puzzleModel);
    puzzleControl = new PuzzleControl(puzzleModel, puzzleViewer);
    puzzleViewer.drawPuzzle();
    displayStatus("Try me!");
}

init();