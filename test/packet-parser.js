"use strict";
var test = require('tape');
var GearmanPacket = require('../gearman-packet.js');
var stream = require('stream');

var parser = new GearmanPacket.Parser();

var reset = function (buffer,offset) {
    if (!offset && (buffer==null || typeof buffer == 'number')) {
        offset = buffer;
        buffer = [1,2,3];
    }
    parser.buffer = new Buffer(buffer);
    parser.offset=offset||0;
}

var lastError = null;
var errorListener = function(e){ lastError = e }
parser.on('error',errorListener);

var lastPushed = null;
parser.push = function (packet) { lastPushed = packet }

var callState = function (state) {
    lastError = null;
    lastPushed = null;
    parser.state = state;
    return state.call(parser,function(){}) || null;
}

var stateChanged = function (t, start, end, msg) {
    t.is(callState(start),end,msg);
}

var stateNotChanged = function (t, start, msg) {
    stateChanged(t, start, null, msg||'state did not change');
}

test("constructor",function(t) {
    t.plan(1);
    t.ok( parser._transform instanceof Function, 'duck types as a transform stream' );
});

test("_transform",function(t) {
    t.plan(6);
    parser.state = function () {
        t.is( this.buffer.toString(), 'TEST', 'New data with no buffer results in a new buffer' );
    }
    parser._transform( new Buffer('TEST'), 'buffer', function(){ t.pass() } );

    parser.state = function () {
        t.is( this.buffer.toString(), 'TESTTHIS', 'New data with existing buffer concats buffer' );
    }
    parser._transform( new Buffer('THIS'), 'buffer', function(){ t.pass() } );

    parser.state = function () {
        t.is( this.buffer.toString(), 'THISOUT', 'New data with existing buffer concats with slice of buffer' );
    }
    parser.consume(4);
    parser._transform( new Buffer('OUT'), 'buffer', function(){ t.pass() } );
    
    delete parser.state;

});

test("_flush",function(t) {
    t.plan(4);

    parser.state = parser.detect;
    var error = null;
    var errortest = function(e){ error = e };
    parser.on('error', errortest);
    var flushed = false;
    parser._flush(function(){ flushed = true });
    parser.removeListener('error',errortest);
    t.is(error,null,'Flushing while in detect state is ok ');
    t.is(flushed,true,'Flushing called its completion callback');

    error = null;
    flushed = false;
    parser.state = function () {'_flush'};
    parser.on('error', errortest);
    parser._flush(function(){ flushed = true });
    parser.removeListener('error',errortest);
    t.notEqual(error,null,'Flushing while in any non-detect state is an error');
    t.is(flushed,true,'Flushing called its completion callback');
});

test("clearBuffer",function(t) {
    t.plan(2);
    reset(1);
    parser.clearBuffer();
    t.is( parser.offset, 0, 'clearBuffer clears the offset' );
    t.is( parser.buffer, null, 'clearBuffer nulls the buffer' );
});

test("rewind",function(t) {
    t.plan(3);

    reset(3);
    parser.rewind(2);
    t.is( parser.offset, 1, 'rewind moves the offset back' );

    reset(1);
    var errortest = function(){ t.pass('rewinding past start results in error') };
    parser.on('error', errortest);
    parser.rewind(2);
    parser.removeListener('error',errortest);
    t.is( parser.offset, 0, "rewinding past start doesn't take the offset below zero" );
});

test("consume",function(t) {
    t.plan(5);

    reset();
    t.is( parser.consume(2), 0, "Consuming bytes returns the original offset" );
    t.is( parser.offset, 2, "Consuming bytes increases the actual offset" );

    reset(2);
    var errortest = function(){ t.pass('consuming past the end results in error') };
    parser.on('error', errortest);
    t.is( parser.consume(2), 2, "Consuming bytes returns the original offset" );
    parser.removeListener('error',errortest);
    t.is( parser.offset, 3, "Consuming bytes past end doesn't move offset past end" );
});

test("bytes",function(t) {
    t.plan(3);
    reset(0);
    t.is( parser.bytes(), 3, "Buffer at start, three bytes remain" );
    reset(2);
    t.is( parser.bytes(), 1, "Buffer has one byte remaining" );
    reset(3);
    t.is( parser.bytes(), 0, "No bytes remain" );
});

test("readBuffer",function(t) {
    t.plan(9);
    reset();
    var buf = parser.readBuffer(2);
    t.is( buf.length, 2, "Read two bytes" );
    t.is( buf[0], 1, "Read first byte successfully" );
    t.is( buf[1], 2, "Read second byte successfully" );
    t.is( parser.offset, 2, "Reading moved offset forward" );

    reset(2);
    var errortest = function(){ t.pass('reading past the end results in an error') };
    parser.on('error', errortest);
    var buf = parser.readBuffer(2);
    parser.removeListener('error',errortest);
    t.is( buf.length, 1, "Read one remaining byte" );
    t.is( buf[0], 3, "Read first byte successfully" );
    t.is( parser.buffer, null, "Reading to/past end reset the buffer");
    t.is( parser.offset, 0, "Reading to/past end reset the offset" );
});

test("readUInt32BE",function (t) {
    t.plan(3);
    reset([0,0,1,0,0,1]);
    t.is( parser.readUInt32BE(), 256, "Read integer" );

    var errortest = function(){ t.pass('reading past the end results in an error') };
    parser.on('error', errortest);
    t.is( parser.readUInt32BE(), 65536, "Read truncated integer" );
    parser.removeListener('error',errortest);
});

test("bufferIndexOf",function (t) {
    t.plan(3);
    reset('abcdef\0');
    t.is(parser.bufferIndexOf(0,3,0),-1,'First three bytes do not contain a null');
    t.is(parser.bufferIndexOf(0,7,0),6,'Any of the seven bytes contain a null');
    t.is(parser.bufferIndexOf(4,3,0),6,'Last three bytes contain a null');
});

test("detect",function (t) {
    t.plan(8);

    parser.clearBuffer();
    stateNotChanged(t, parser.detect, "Do nothing if there's no magic byte to read yet" );
    t.is( lastError, null, "No errors");

    reset([0]);
    stateChanged(t, parser.detect, parser.header, "Moved on to the header state" );
    t.is( parser.bytes(), 0, "Consumed our buffer" );
    t.is( lastError, null, "No errors");

    reset([1]);
    stateChanged(t, parser.detect, parser.admin, "Moved on to the admin state" );
    t.is( parser.bytes(), 1, "Did not conusme the buffer" );
    t.is( lastError, null, "No errors");
});

test("header",function (t) {
    t.plan(31);

    reset('NO');
    stateNotChanged(t, parser.header);
    t.is( lastError, null, "No error" );
    t.is( parser.bytes(), 2, "Giving it fewer than eleven bytes does nothing" );

    reset('BAD456789012');
    stateChanged(t, parser.header, parser.detect, "Random bytes are reparsed");
    t.notEqual( lastError, null, 'No matching header results in error' );
    t.is( parser.bytes(), 12, "No matching header consumes no bytes" );

    reset('REQ\0\0\0\u0001\0\0\0\0');
    stateChanged(t, parser.header, parser.body, "Moved on to reading the body");
    t.is( lastError, null, "No error" );
    t.is( parser.bytes(), 0, "Consumed the header text" );
    t.is( parser.packet.kind, 'request', "REQ header results in a request packet" );

    reset('RES\0\0\0\u0001\0\0\0\0');
    stateChanged(t, parser.header, parser.body, "Moved on to reading the body");
    t.is( lastError, null, "No error" );
    t.is( parser.bytes(), 0, "Consumed the header text" );
    t.is( parser.packet.kind, 'response', "RES header results in a response packet" );

    reset('REQ\0\0\0\u0001\0\0\0\0');
    stateChanged(t, parser.header, parser.body, "Giving a type advances to reading the body");
    t.is( lastError, null, 'No error');
    t.is( parser.packet.type.name, 'CAN_DO', "Set the packet type to CAN_DO" );

    reset('REQ\0\0\u0001\0\0\0\0\0');
    stateChanged(t, parser.header, parser.packetSkip, "Giving an unknown type skips the packet" );
    t.notEqual( lastError, null, 'Unknown types emit errors' );
    t.is( parser.packet.type.name, 'unknown#256', "Unknown packet types are unknown" );

    reset('REQ\0\0\0\u0003\0\0\0\u0001'); // RESET_ABILITIES
    stateChanged(t, parser.header, parser.body, "No arguments means jumping to the body");
    t.is( lastError, null, 'No error');
    t.is( parser.bytes(), 0, "Read all the size bytes" );
    t.is( Object.keys(parser.packet.args).length, 0, "No args results in empty args array" );
    t.is( parser.packetArgSize, 0, "No argument bytes read yet" );

    reset('REQ\0\0\0\u0014\0\0\0\u0001'); // STATUS_RES
    stateChanged(t, parser.header, parser.args, "Go to the arguments parser");
    t.is( lastError, null, 'No error');
    t.is( parser.bytes(), 0, "Read all the size bytes" );
    t.is( Object.keys(parser.packet.args).length, 5, "Args object initialized to correct size" );
    t.is( parser.argc, 0, "Start with zero args read" );
    t.is( parser.packetArgSize, 0, "No argument bytes read yet" );
});

test("args",function (t) {
    t.plan(34);

    reset('nothing');
    parser.packet = {type: {args: ['one'],body:'stream'},args: {one:void 0}};
    parser.packetArgSize = 0;
    parser.argc = 0;
    stateNotChanged(t, parser.args, 'No arg terminator, no state change');
    t.is( lastError, null, 'No error');
    t.is(parser.argc, 0, 'No arg terminator, no args read');
    t.is(parser.packetArgSize, 0, 'No arg terminator, no arg bytes read');
    t.is(parser.packet.args.one, void 0, 'No arg terminator, no arg read');

    reset('something that is much too long as gearman limits args to 64 chars, including null\0');
    parser.packet = {type: {args: ['one'],name:'forced error',body:'stream'},args: {one:void 0}};
    parser.packetArgSize = 0;
    parser.argc = 0;
    stateChanged(t, parser.args, parser.body, "too long args are treated as a body");
    t.notEqual( lastError, null, 'too long args emit errors' );
    t.is(parser.argc, 0, 'Too long args, no args read');
    t.is(parser.packetArgSize, 0, 'Too long args, no arg bytes read');
    t.is(parser.packet.args.one, void 0, 'Too long args, no arg read');

    reset('something\0');
    parser.packet = {type: {args: ['one','two'], body: 'stream'},args: {one:void 0, two:void 0}};
    parser.packetArgSize = 0;
    parser.argc = 0;
    stateNotChanged(t, parser.args, 'not all args read, so no state change');
    t.is(lastError, null, 'No error');
    t.is(parser.argc, 1, 'One arg read');
    t.is(parser.packetArgSize, 10, 'Ten bytes read');
    t.is(parser.packet.args.one, 'something', 'read arg correctly');

    reset('something\0else');
    parser.packet = {type: {args: ['one','two'], body: 'stream'},args: {one:void 0, two:void 0}};
    parser.packetArgSize = 0;
    parser.argc = 0;
    stateNotChanged(t, parser.args, 'not all args read, so no state change');
    t.is(lastError, null, 'No error');
    t.is(parser.argc, 1, 'One arg read');
    t.is(parser.packetArgSize, 10, 'Ten bytes read');
    t.is(parser.packet.args.one, 'something', 'read arg correctly');

    reset('something\0else\0body');
    parser.packet = {type: {args: ['one','two'], body: 'stream'},args: {one:void 0, two:void 0}};
    parser.packetArgSize = 0;
    parser.argc = 0;
    stateChanged(t, parser.args, parser.body, "completed reading args, moving on to body" );
    t.is(lastError, null, 'No error');
    t.is(parser.argc, 2, 'Both args read');
    t.is(parser.packetArgSize, 15, 'Fifteen bytes read');
    t.is(parser.packet.args.one, 'something', 'read arg correctly');
    t.is(parser.packet.args.two, 'else', 'read arg correctly');
    t.is(parser.bytes(),4,'Four bytes remain for the body');

    reset('onearg\0twoarg\0smooarg'); 
    parser.packet = {type: {args: ['one','two','smoo']}, args: {one:void 0, two:void 0, three:void 0}}; 
    parser.packetArgSize = 0; 
    parser.argc = 0; 
    stateChanged(t, parser.args, parser.body, "completed reading the arg type args, moving on" ); 
    t.is(lastError, null, 'No error'); 
    t.is(parser.argc, 2, 'First two read, third lives in the "body"'); 
    t.is(parser.packetArgSize, 14, 'Fifteen bytes read'); 
    t.is(parser.packet.args.one, 'onearg', 'read arg correctly'); 
    t.is(parser.packet.args.two, 'twoarg', 'read arg correctly'); 
    t.is(parser.bytes(),7,'Seven bytes remain for the body');
});

test("body",function (t) {
    t.plan(9);

    parser.packetSize = 10;
    parser.packetArgSize = 5;
    parser.packet = {type: {}};
    stateChanged(t, parser.body, parser.bodyarg, 'No body type, so it must be an argument' );
    t.is(lastError, null, 'No error');

    parser.packetSize = 10;
    parser.packetArgSize = 10;
    var packet = parser.packet = {type: {}};
    stateChanged(t, parser.body, parser.detect, 'No body type nor body, gues we\'re done' );
    t.is(lastError, null, 'No error');
    t.is(lastPushed, packet, 'Pushed our packet object');

    parser.packet = {type: {body: true}};
    parser.packetSize = 100;
    parser.packetArgSize = 30;
    stateChanged(t, parser.body, parser.bodystream, 'A stream body means the bodystream state');
    t.is(lastError, null, 'No error');
    t.is(lastPushed, parser.packet, 'Pushed our packet object');
    t.ok(parser.packet.body instanceof stream.Readable, 'Body is a readable stream');

});

test("bodyarg",function (t) {
    t.plan(8);
    reset('abc');
    parser.packet = {bodySize: 4};
    stateNotChanged(t, parser.bodyarg, 'We do nothing with fewer than bodySize bytes');
    t.is(lastError, null, 'No error');
    t.is(lastPushed, null, 'No packet pushed');

    reset('abcd');
    var packet = parser.packet = {bodySize: 4,type:{args:['foo']}, args:{foo:void 0}};
    parser.argc = 0;
    stateChanged(t, parser.bodyarg, parser.detect, 'We completed this packet, go to start');
    t.is(lastError, null, 'No error');
    t.is(lastPushed, packet, 'We pushed the packet');
    t.is(packet.args.foo, 'abcd', 'The packet had our data in its args');
    t.is(parser.packet, null, 'the in-progress packet has been cleared');
});

test("bodystream",function (t) {
    t.plan(12);

    var lastData = null;
    var dataComplete = false;
    var body = {
        end: function(){ dataComplete=true },
        write: function(chunk,done) { lastData = chunk; if (done) done() },
    }

    reset([0,0,0]);
    parser.packet = {bodySize: 4, body: body };
    parser.bodyRead = 0;
    stateChanged(t, parser.bodystream, GearmanPacket.Parser.NOT_DONE, 'Not done');
    t.is(parser.state, parser.bodystream, 'We do nothing with fewer than bodySize bytes');
    t.is(lastError, null, 'No error');
    t.is(lastData.length,3, 'We read the three bytes we had available');
    t.is(dataComplete, false, "But we're not done yet");

    reset([0,0,1,0]);
    var lastData = null;
    var dataComplete = false;
    parser.packet = {bodySize: 4, body: body };
    parser.bodyRead = 0;
    stateChanged(t, parser.bodystream, GearmanPacket.Parser.NOT_DONE, 'Not done');
    t.is(parser.state, parser.detect, 'We completed this packet, go to start');
    t.is(lastError, null, 'No error');
    t.is(parser.packet, null, 'the in-progress packet has been cleared');
    t.is(lastData?lastData.length:0,4, 'We read the four bytes in the body');
    t.is(lastData?lastData.readUInt32BE(0):null, 256, 'We pushed the packet with our body');
    t.is(dataComplete, true, 'And the body is done');
});

test("admin",function (t) {
    t.plan(9);

    reset('abcdef');
    stateNotChanged(t, parser.admin, "no newline, so keep skipping");
    t.is(lastError, null, 'No error');

    var toolong = '';
    for (var ii=0; ii<12; ++ii) {
        toolong += 'something that is much too long, we limit admin commands to 1024 chars, including a linefeed';
    }
    toolong += "\n";
    reset(toolong);
    stateChanged(t, parser.admin, parser.adminSkip, "command too long, skip the rest");
    t.notEqual(lastError, null, 'Commands that overflow our buffer should emit errors');

    reset('abc\ndef');
    stateChanged(t, parser.admin, parser.detect, "found a command");
    t.is(lastError, null, 'No error');
    t.is(parser.buffer.slice(parser.offset).toString(), 'def', "buffer should just be stuff after the newline");
    t.is(lastPushed?lastPushed.kind:null, 'admin', 'admin packet was pushed');
    t.is(lastPushed?lastPushed.args.line:null, 'abc', 'admin command was correct');
});

test("adminSkip",function (t) {
    t.plan(6);

    reset('abcdef');
    stateNotChanged(t, parser.adminSkip, "no newline, so keep skipping");
    t.is(lastError, null, 'No error');
    t.is(parser.buffer, null, "buffer should have been cleared entirely");

    reset('abc\ndef');
    stateChanged(t, parser.adminSkip, parser.detect, "found newline, back to packet detection");
    t.is(lastError, null, 'No error');
    t.is(parser.buffer.slice(parser.offset).toString(), 'def', "buffer should just be stuff after the newline");
});
