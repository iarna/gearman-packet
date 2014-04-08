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

Classes
------

`var GearmanPacket = require('gearman-packet');`

* `var parser = new GearmanPacket.Parser();`

This is an stream Transform class, so you can pipe buffers into it and it emits objects. Typical use is to pipe a socket into it and pipe the parser into something that acts on the packet objects. See Packet Objects below for details on what those look like.

* `var emitter = new GearmanPacket.Emitter();`

This too is a stream Transform class. It accepts objects like those the Parser emits and emits buffers. Typical use is to pipe the emitter into a socket and then write objects to the emitter.

Packet Objects
==============

Packet objects have the following properties:

* kind: 'request'|'response'
* type: typeobject
* args: typeargshash
* body: buffer|string|stream
* bodySize: integer

Kind should be request or response.  Type is one of the objects stored in `GearmanPacket.types`.  Types are simple objects that look like this:

    {name: 'SUBMIT_JOB', id: 7, args: ['function','uniqueid'], body: 'stream'}

The typeargshash is just a key/value pair, whose keys should match the args in the type object.

The body can be simple, in which case it should be a buffer or a string, and there's no need to include a bodySize.  Or, if body is a stream object then you must also tell us how big it's going to be by setting a bodySize.  Body streams will indeed have their content streamed out, without buffering.

Examples
--------

See example.js in the distribution.

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
