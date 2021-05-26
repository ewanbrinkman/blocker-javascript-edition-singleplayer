import { DEFAULT_PLAYER, PLAYER_SQUARE, FRICTION_PARTICLES } from '../constants.js';

function squareCenterOffset(side1, side2, scale) {
    // The argument "side1" is the amount of pixels on one side of the
    // square. The argument "side2" is the amount of pixels on the
    // opposite side of the square.
    return (side1 - side2) / 2 * scale
}

function getSquareCenter(x, y, playerType, scale) {
    // Given an x and y position, move the coordinates so that the
    // center is at the middle of the animal square, not the middle of
    // the image. Since the animals are symmetrical on the right and
    // left side, only the y position needs to change.
    return [x - squareCenterOffset(PLAYER_SQUARE[playerType].left, PLAYER_SQUARE[playerType].right, scale),
            y - squareCenterOffset(PLAYER_SQUARE[playerType].top, PLAYER_SQUARE[playerType].bottom, scale)];
}

function getBodyOffset(playerType) {
    // The x and y distance to get to the top left of the square
    // from the top left of the image.
    return [PLAYER_SQUARE[playerType].left,
            PLAYER_SQUARE[playerType].top];
}

export default class Player extends Phaser.GameObjects.Sprite {
    constructor(config) {
        // Adjust position, since when first creating the sprite it is
        // the center of the image. The player should spawn so that the
        // center of its square is the given coordinate.
        let [ squareCenterStartX, squareCenterStartY ] = getSquareCenter(
            config.x, config.y, config.playerType, DEFAULT_PLAYER.scale);

        super(config.scene, squareCenterStartX, squareCenterStartY, 
            config.texture, config.frame);
        
        // Save the scene the player is in.
        this.scene = config.scene;

        // Start position.
        this.startX = config.x
        this.startY = config.y
        
        // Add the player to the scene.
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);

        // Which animal type the player is.
        this.playerType = config.playerType;
        // Player movement settings.
        this.acceleration = DEFAULT_PLAYER.acceleration;
        this.jumpVelocity = DEFAULT_PLAYER.jumpVelocity;
        this.maxVelocity = DEFAULT_PLAYER.maxVelocity;
        this.wallJumpVelocity = DEFAULT_PLAYER.wallJumpVelocity;
        this.wallSlide = DEFAULT_PLAYER.wallSlide;

        // Friction when moving. The maximum player velocity is the
        // acceleration divded by the friction constant. For example,
        // if the maximum acceleration is 1000 and the friction
        // constant is 2, then the maximum velocity is 1000 / 2 which
        // is 500.
        this.friction = DEFAULT_PLAYER.friction;
        // Friction when stopping.
        this.drag = DEFAULT_PLAYER.drag;
        // How much the player should bounce on impacts.
        this.bounce = DEFAULT_PLAYER.bounce;

        this.topVelocity = {
            x: this.acceleration / this.friction
        }
        
        // How fast the player will slow down.
        this.body.setDrag(this.drag.x, this.drag.y);
        // Make sure the player doesn't go too fast, or else they could
        // clip through blocks.
        this.body.setMaxVelocity(this.maxVelocity.x, this.maxVelocity.y);
        // How much the player will bounce on collisions.
        this.body.setBounce(this.bounce);
        
        // Change the player's hitbox size.
        this.scale = DEFAULT_PLAYER.scale;
        this.body.setSize(PLAYER_SQUARE.size, PLAYER_SQUARE.size);
        // Adjust the hitbox location to overlap with the square body section of
        // the animal.

        const [ bodyOffsetX, bodyOffsetY ] = getBodyOffset(this.playerType);
        this.body.setOffset(bodyOffsetX, bodyOffsetY);
        // Change the player size.
        this.setScale(this.scale);

        // Don't go out of the map.
        this.body.setCollideWorldBounds(true);
        // Collide with the blocks of the map.
        this.scene.physics.add.collider(this.scene.blockLayer, this);

        // Create the friction particle emitter.
        this.frictionParticlesEmitter = this.scene.frictionParticles.createEmitter({
            speed: 100,
            scale: { start: 0.13, end: 0},
            blendMode: 'NORMAL',
            follow: this, // Follow the player.
            frequency: 70, // The amount of ms between particles.
            on: false,
            followOffset: {
                y: this.displayHeight / 2 - PLAYER_SQUARE[this.playerType].bottom * this.scale
            } // Make the particles appear at the bottom of the player image.
        });
    }

    wallJump() {
        if (!this.body.onFloor() && this.body.onWall()) {
            // Wall jump, set the x velocity in the correct direction.
            if (this.body.blocked.right) {
                this.body.setVelocityX(-this.wallJumpVelocity.x);
            } else if (this.body.blocked.left) {
                this.body.setVelocityX(this.wallJumpVelocity.x);
            }
            this.body.setVelocityY(-this.wallJumpVelocity.y)
        }
    }

    update(cursors, time, delta) {
        // Friction particles when moving on the ground.
        if (this.body.onFloor() && Math.abs(this.body.velocity.x) > this.topVelocity.x * FRICTION_PARTICLES.startAtRelativeVelocity) {
            this.frictionParticlesEmitter.on = true;
            // Set direction based on player verlocity direction.
            if (this.body.velocity.x > 0) {
                this.frictionParticlesEmitter.setAngle({ min: 160, max: 200 })
            } else {
                this.frictionParticlesEmitter.setAngle({ min: -20, max: 20 })
            }
        } else {
            this.frictionParticlesEmitter.on = false;
        }

        // If the player is moving into a wall (moving left or right)
        // and moving down, make them slide slower down the wall.
        if (this.body.onWall() && this.body.velocity.y > 0) {
            this.body.velocity.y *= this.wallSlide;
            
            // Friction particles when moving on the wall.
            // Stuff here.
        }

        // Friction increases as the player's velocity increases.
        // Multiply the velocity be a negative number to make friction
        // go in the opposite direction of movement.
        if (cursors.left.isDown) {
            this.body.setAccelerationX(-this.acceleration + this.body.velocity.x * -this.friction);
        } else if (cursors.right.isDown) {
            this.body.setAccelerationX(this.acceleration + this.body.velocity.x * -this.friction);
        } else {
            this.body.setAccelerationX(0);
        }

        if (cursors.space.isDown || cursors.up.isDown) {
            if (this.body.onFloor()) {
                // Jump off the ground.
                this.body.setVelocityY(-this.jumpVelocity);
            }
        }

        if (cursors.down.isDown) {
            this.body.setVelocityX(900);
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(cursors.space)) {
            this.wallJump()
        }
    
        if (this.body.position.y > this.scene.map.heightInPixels) {
            this.respawn();
        }

        this.collideWorldSides();
    }

    teleport(x, y) {
        // Set the body's center to the given x and y position. Since
        // the body is poitioned based on the top left coordinate, half
        // of the body's width and height must be subtracted from the x
        // and y coordinate.
        this.body.position.x = x - this.body.halfWidth;
        this.body.position.y = y - this.body.halfHeight;
    }

    respawn() {
        // Teleport back to the spawn point.
        this.teleport(this.startX, this.startY);
        // Reset their velocity so they don't keep their velocity from
        // before they respawn.
        this.body.setVelocity(0, 0);
    }

    collideWorldSides() {
        // Don't go off the left or right side of the screen. This
        // method is better than doing physics.world.setBoundsCollision
        // since it doesn't count running into the left or right edge
        // as being blocked.
        if (this.body.position.x < 0) {
            this.body.position.x = 0;
            this.body.setVelocityX(0);
        } else if (this.body.position.x + this.body.width > this.scene.map.widthInPixels) {
            this.body.position.x = this.scene.map.widthInPixels - this.body.width;
            this.body.setVelocityX(0);
        }
    }
}
