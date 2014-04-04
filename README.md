gearman-packet
--------------

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
