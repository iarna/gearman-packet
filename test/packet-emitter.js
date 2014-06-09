"use strict";
var test = require('tape');
var GearmanPacket = require('../gearman-packet.js');
var bufferEqual = require('buffer-equal');
var stream = require('stream');
var streamify = require('stream-array');

var bufferIs = function (t,a,b,msg,extra) {
    t._assert( bufferEqual(a,b), {
        message:   msg || 'should be equal',
        operator: 'equal',
        actual:   a,
        expected: b,
        extra:    extra
    });
}

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
    emitter._transform({kind: 'admin',type:{name:'ok'}}, null, function(){ complete = true });
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
    emitter.encodeAdmin({args:{line:'test'},type:{name:'line'}},function(){});
    t.ok( Buffer.isBuffer(pushed), 'Encoded into a buffer' );
    bufferIs(t, pushed, new Buffer('test\n'), 'Encoded with a newline at the end');
});

test("encodeGearman",function(t) {
    t.plan(3);
    var emitter = new GearmanPacket.Emitter();
    var buf = [];
    emitter.push = function (B){ buf.push(B) }

    emitter.encodeGearman({kind:'request', type:{id:0,args:[],body:'buffer'}, body:new Buffer('abc')}, function () {
        bufferIs(t, buf[0], new Buffer([0,82,69,81,0,0,0,0,0,0,0,3,97,98,99]), 'Encode body buffer');
    });

    var stream = streamify([new Buffer('abc')]);
    buf = [];
    emitter.encodeGearman({kind:'request', type:{id:0,args:[],body:'buffer'}, body:stream, bodySize: 3}, function () {
        bufferIs(t, buf[0], new Buffer([0,82,69,81,0,0,0,0,0,0,0,3]), 'Encode body stream');
        bufferIs(t, buf[1], new Buffer([97,98,99]), 'Encode body stream');
    });
});

test("encodeGearmanHeader",function(t) {
    t.plan(4);
    var emitter = new GearmanPacket.Emitter();

    var buf = emitter.encodeGearmanHeader({kind:'request',type:{id:0}},0);
    bufferIs(t, buf, new Buffer([0,82,69,81,0,0,0,0,0,0,0,0]), 'Encode request');

    var buf = emitter.encodeGearmanHeader({kind:'response',type:{id:0}},0);
    bufferIs(t, buf, new Buffer([0,82,69,83,0,0,0,0,0,0,0,0]), 'Encode response');

    var buf = emitter.encodeGearmanHeader({kind:'request',type:{id:257}},0);
    bufferIs(t, buf, new Buffer([0,82,69,81,0,0,1,1,0,0,0,0]), 'Encode type');

    var buf = emitter.encodeGearmanHeader({kind:'request',type:{id:0}},257);
    bufferIs(t, buf, new Buffer([0,82,69,81,0,0,0,0,0,0,1,1]), 'Encode length');
});

test("encodeGearmanArgs",function(t) {
    t.plan(5);
    var emitter = new GearmanPacket.Emitter();

    var buf = emitter.encodeGearmanArgs({type:{args:[],body:'buffer'}});
    bufferIs(t, buf, new Buffer(0), 'No arguments');

    var buf = emitter.encodeGearmanArgs({type:{args:['foo'],body:'buffer'},args:{foo:'test'}});
    bufferIs(t, buf, new Buffer('test\0'), 'One argument');

    var buf = emitter.encodeGearmanArgs({type:{args:['foo','bar'],body:'buffer'},args:{foo:'test',bar:'baz'}});
    bufferIs(t, buf, new Buffer('test\0baz\0'), 'Two arguments');

    var buf = emitter.encodeGearmanArgs({type:{args:['foo','bar']},args:{foo:'test',bar:'baz'}});
    bufferIs(t, buf, new Buffer('test\0'), 'One arg and argbody');

    var buf = emitter.encodeGearmanArgs({type:{args:['foo']},args:{foo:'test'}});
    bufferIs(t, buf, new Buffer(0), 'Argbody only');
});

test("encodeGearmanBody",function(t) {
    t.plan(8);
    var emitter = new GearmanPacket.Emitter();

    var buf = emitter.encodeGearmanBody({type:{body:'buffer'},body: new Buffer([1,2,3])});
    bufferIs(t, buf, new Buffer([1,2,3]), 'Buffer bodies pass through');

    var buf = emitter.encodeGearmanBody({type:{body:'buffer'},body: [1,2,3]});
    bufferIs(t, buf, new Buffer([1,2,3].toString()), 'Non-buffers are passed to toString before being turned into buffers');

    var buf = emitter.encodeGearmanBody({type:{body:'buffer'}});
    bufferIs(t, buf, new Buffer(0), 'Missing bodies produce empty buffers');

    var buf = emitter.encodeGearmanBody({type:{body:'buffer'},body: streamify([new Buffer([1,2,3])]), bodySize:3});
    t.ok( buf instanceof stream.Readable, 'Streams get passed through' );
    t.is( buf.length, 3, 'Streams get a length' );

    var buf = emitter.encodeGearmanBody({type:{args:[]}});
    bufferIs(t, buf, new Buffer(0), 'No body, no args, empty buffer');

    var buf = emitter.encodeGearmanBody({type:{args:['foo']},args:{foo:'test'}});
    bufferIs(t, buf, new Buffer('test'), 'solo argbody');

    var buf = emitter.encodeGearmanBody({type:{args:['foo','bar']},args:{foo:'test',bar:'baz'}});
    bufferIs(t, buf, new Buffer('baz'), 'multi argbody');
});
