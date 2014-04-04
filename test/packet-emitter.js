"use strict";
var test = require('tape');
var GearmanPacket = require('../gearman-packet.js');


test("constructor",function(t) {
    t.plan(1);
    var emitter = new GearmanPacket.Emitter();
    t.ok( emitter._transform instanceof Function, 'duck types as a transform stream' );
});

test("_transform",function(t) {
    t.plan(18);
    var emitter = new GearmanPacket.Emitter();
    emitter.encodeAdmin = function(_,done){ this.push("ADMIN"); done() }
    emitter.encodeGearman = function(_,done){ this.push("GEARMAN"); done() }
    var pushed;
    emitter.push = function(buf){ pushed = buf };
    var error;
    emitter.on('error', function(e){ error = e });
    var complete;

    complete = false; pushed = null; error = null;
    emitter._transform({kind: 'admin'}, null, function(){ complete = true });
    t.is( complete, true, 'admin: _transform completed' );
    t.is( error, null, 'admin: no error' );
    t.is( pushed, 'ADMIN', 'admin: routed correctly' );

    complete = false; pushed = null; error = null;
    emitter._transform({kind: 'request'}, null, function(){ complete = true });
    t.is( complete, true, 'request: _transform completed' );
    t.is( error, null, 'request: no error' );
    t.is( pushed, 'GEARMAN', 'request: routed correctly' );

    complete = false; pushed = null; error = null;
    emitter._transform({kind: 'response'}, null, function(){ complete = true });
    t.is( complete, true, 'response: _transform completed' );
    t.is( error, null, 'response: no error' );
    t.is( pushed, 'GEARMAN', 'response: routed correctly' );

    complete = false; pushed = null; error = null;
    emitter._transform({kind: 'wibble'}, null, function(){ complete = true });
    t.is( complete, true, 'wibble: _transform completed' );
    t.notEqual( error, null, 'wibble: should emit error' );
    t.is( pushed, null, 'wibble: no routing' );

    complete = false; pushed = null; error = null;
    emitter._transform({}, null, function(){ complete = true });
    t.is( complete, true, 'nokind: _transform completed' );
    t.notEqual( error, null, 'nokind: should emit error' );
    t.is( pushed, null, 'nokind: no routing' );

    complete = false; pushed = null; error = null;
    emitter._transform(null, null, function(){ complete = true });
    t.is( complete, true, 'null: _transform completed' );
    t.notEqual( error, null, 'null: should emit error' );
    t.is( pushed, null, 'null: no routing' );


});

test("encodeAdmin",function(t) {
    t.plan(2);
    var emitter = new GearmanPacket.Emitter();
    var pushed;
    emitter.push = function(buf){ pushed = buf };
    emitter.encodeAdmin({command:'test'},function(){});
    t.ok( Buffer.isBuffer(pushed), 'Encoded into a buffer' );
    t.looseEqual( pushed, new Buffer('test\n'), 'Encoded with a newline at the end');
});

/*
test("encodeGearman",function(t) {
    t.plan(1);
    var emitter = new GearmanPacket.Emitter();

    interface: packet,done
    calls encodeGearmanArgs, encodeGearmanBody with the packet, expects return value with a length
    calls encodeGearmanHeader with packet and total length of args and body
    if body IS NOT a readable stream:
      concat it all and push that, then call done
    if it IS a stream:
      concat and push the headers and args
      attach a data event to the stream to push along any buffers (and bufferize strings)
      attach an end event to call done 
});
test("encodeGearmanHeader",function(t) {
    t.plan(1);
    var emitter = new GearmanPacket.Emitter();
    
    interface: packet, args+body length
    returns a buffer
});
test("encodeGearmanArgs",function(t) {
    t.plan(1);
    var emitter = new GearmanPacket.Emitter();

    interface: packet, returns buffer
});
test("encodeGearmanBody",function(t) {
    t.plan(1);
    var emitter = new GearmanPacket.Emitter();
    interface: packet, returns buffer or stream with length attribute set to packet.bodySize
});
*/