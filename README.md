gearman-packet
--------------
[![Build Status](https://travis-ci.org/iarna/gearman-packet.svg?branch=master)](https://travis-ci.org/iarna/gearman-packet)

A streaming packet parser and emitter for the Gearman protocol and Node.js. 

This is a set of *transform* streams.  The parser accepts a stream of
buffers of any size and emits objects.  The emitter accepts a stream of
objects and emits buffers.

For packet types that include an opaque body, the body is provided as a
stream by the parser.  The emitter can accept either a stream for the body
or a buffer or utf-8 string.

Usage
-----

For now, just checkout example.js in the distribution.

Purpose
-------

This is intended as low-level layer for both a new,
streaming-from-the-ground-up gearman client/worker library and also a
gearmand-in-node project.

Unsupported
-----------

Admin commands are not yet fully supported:

* Arguments to admin commands are not supported
* The results of admin commands (variously formatted text) are not supported.
