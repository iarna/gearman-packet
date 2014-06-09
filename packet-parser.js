"use strict";
var stream = require('stream');
var util = require('util');
var Packet = require('./packet-types');

var Parser = module.exports = function (options) {
    if (!options) options = {};
    options.objectMode = true;
    stream.Transform.call(this,options);
    this.state = this.detect;
    this.buffer = null;
    this.offset = 0;
    this.packet = null;
    this.packetSize = null;
    this.packetArgSize = null;
    this.argc = null;
    this.bodyRead = null;
}
util.inherits(Parser, stream.Transform);

var NOT_DONE = Parser.NOT_DONE = function() {}

Parser.prototype._transform = function (data, encoding, done) {
    if (Buffer.isBuffer(this.buffer)) {
        var bytes = this.bytes();
        this.buffer = Buffer.concat([
            this.buffer.slice(this.offset),
            data
        ], bytes + data.length);
        this.offset = 0;
    }
    else {
        this.buffer = data;
    }
    this.runCurrentState(done);
}

Parser.prototype.runCurrentState = function (done) {
    var nextState;
    while (nextState = this.state(done)) {
        if (nextState == NOT_DONE) return;
        this.state = nextState;
    }
    done();
}

Parser.prototype._flush = function (done) {
    if (this.state != this.detect) {
        this.emit('error',new Error('Disconnected while mid-packet'));
    }
    done();
}

//---------- Utilities

Parser.prototype.clearBuffer = function() {
    this.buffer=null;
    this.offset = 0;
}
Parser.prototype.rewind = function(num) {
    this.offset -= num;
    if (this.offset < 0) {
        this.emit('error',new Error('Attempted to rewind past start of buffer by '+(this.offset*-1)+' bytes'));
        this.offset = 0;
    }
}

Parser.prototype.consume = function (num) {
    if (this.buffer===null) {
        this.emit('error',new Error('Attempted to consume '+num+' bytes from an empty buffer'));
        return offset;
    }
    if (this.buffer.length < this.offset+num) {
        this.emit('error',new Error('Attempted to consume more bytes than the buffer contains, buffer length is '+this.buffer.length+', offset is '+this.offset+', tried to consume '+num+' bytes'));
        num = this.buffer.length - this.offset;
    }
    var offset = this.offset;
    this.offset += num;
    return offset;
}

Parser.prototype.bytes = function () {
    return this.buffer==null ? 0 : this.buffer.length - this.offset;
}

Parser.prototype.readBuffer = function(size) {
    if (!size) return new Buffer(0);
    if (this.buffer===null) {
        this.emit('error',new Error('Attempted to read '+size+' bytes from an empty buffer'));
        return new Buffer();
    }
    if (this.buffer.length < this.offset+size) {
        this.emit('error',new Error('Attempted to read more bytes than the buffer contains, buffer length is '+this.buffer.length+', offset is '+this.offset+', tried to read '+size+' bytes'));
        size = this.buffer.length - this.offset;
    }
    var buffer = this.buffer.slice(this.offset,this.offset+size);
    this.offset += size;
    if (this.offset == this.buffer.length) this.clearBuffer();
    return buffer;
}

Parser.prototype.readUInt32BE = function () {
    var value = this.buffer.readUInt32BE(this.consume(4),true);
    if (this.offset == this.buffer.length) this.clearBuffer();
    return value;
}

Parser.prototype.bufferIndexOf = function (start,length,num) {
    if (this.buffer===null) return -1;
    var end = start+length > this.buffer.length ? this.buffer.length : start+length;
    for (var ii=start; ii<end; ++ii) {
        if (this.buffer[ii]===num) return ii;
    }
    return -1;
}

//---------- Parser states

Parser.prototype.detect = function () {
    if (this.bytes() < 1) return;
    if (this.buffer[this.offset] != 0) {
        return this.admin;
    }
    else {
        this.consume(1);
        return this.magic;
    }
}

Parser.prototype.magic = function () {
    if (this.bytes() < 3) return;
    var magic = this.buffer.slice(this.offset,this.offset+3).toString('ascii');
    if (magic == 'REQ') {
        this.packet = { kind: 'request' }
    }
    else if (magic == 'RES') {
        this.packet = { kind: 'response' }
    }
    else {
        this.emit('error',new Error('Null found without known magic: '+this.buffer.toJSON()));
        return this.endPacket();
    }
    this.consume(3);
    return this.type;
}

Parser.prototype.type = function () {
    if (this.bytes() < 4) return;
    var type = this.readUInt32BE();
    if (!(this.packet.type = Packet.typesById[type])) {
        this.packet.type = {id: type, args: [], body: 'stream', name: 'unknown#'+type};
        this.emit('error',new Error('Unknown packet type: '+type));
    }
    return this.size;
}

Parser.prototype.size = function () {
    if (this.bytes() < 4)  return;
    this.packetSize = this.readUInt32BE();
    this.packetArgSize = 0;
    this.packet.args = {};
    for (var ii in this.packet.type.args) {
        this.packet.args[this.packet.type.args[ii]] = void 0;
    }
    if (!this.packet.type.body && this.packet.type.args.length==1) {
        this.argc = 0;
        return this.body;
    }
    else if (this.packet.type.args.length) {
        this.argc = 0;
        return this.args;
    }
    else {
        return this.body;
    }
}

Parser.prototype.args = function () {
    var nullindex;
    while (-1 != (nullindex = this.bufferIndexOf(this.offset,64,0))) {
        var arg = this.buffer.slice(this.offset,nullindex);
        var argBytes = arg.length+1;
        this.consume(argBytes);
        this.packetArgSize += argBytes;
        this.packet.args[this.packet.type.args[this.argc++]] = arg.toString();
        if (this.argc == this.packet.type.args.length || 
            (!this.packet.type.body && this.argc==this.packet.type.args.length-1) ) {
            return this.body;
        }
    }
    if (this.bytes()>=64) {
        this.emit('error',new Error('In a '+this.packet.type.name+' packet, argument #'+(this.argc+1)+' is missing or more then 64 bytes'));
        return this.body;
    }
}

Parser.prototype.body = function () {
    this.packet.bodySize = this.packetSize - this.packetArgSize;
    if (! this.packet.type.body) {
        if (this.packet.bodySize==0) {
            delete this.packet.bodySize;
            this.sendPacket(this.packet);
            return this.endPacket();
        }
        else {
            return this.bodyarg;
        }
    }
    else if (this.packet.type.body == 'string') {
        return this.bodystring;
    }
    else if (this.packet.type.body == 'stream') {
        this.packet.body = new stream.PassThrough();
        this.packet.body.length = this.packet.bodySize;
        this.bodyRead = 0;
        this.sendPacket(this.packet);
        return this.bodystream;
    }
    else {
        throw new Error('Unknown packet body type '+this.packet.type.body+', expected string or stream');
    }
    
}

Parser.prototype.sendPacket = function(packet) {
    if (!packet.body) {
        delete packet.bodySize;
    }
    this.push(packet);
}

Parser.prototype.endPacket = function(packet) {
    this.packet = null;
    this.packetSize = null;
    this.packetArgSize = null;
    this.argc = null;
    this.bodyRead = null;
    return this.detect;
}

Parser.prototype.bodyarg = function () {
    if (this.bytes() < this.packet.bodySize) return;
    var buf = this.readBuffer(this.packet.bodySize);
    delete this.packet.bodySize;
    this.packet.args[this.packet.type.args[this.argc]] = buf!=null ? buf.toString() : buf;
    this.sendPacket(this.packet);
    return this.endPacket();
}

Parser.prototype.bodystream = function (done) {
    if (this.bodyRead + this.bytes() >= this.packet.bodySize) {
        var self = this;
        this.packet.body.write( this.readBuffer(this.packet.bodySize-this.bodyRead), function(){
            self.packet.body.end();
            self.state = self.endPacket();
            self.runCurrentState(done);
        });
        return NOT_DONE;
    }
    else if (! this.bytes()) {
        this.clearBuffer();
        return;
    }
    else if (this.offset) {
        this.bodyRead += this.bytes();
        this.packet.body.write( this.readBuffer(this.bytes()), done );
        return NOT_DONE;
    }
    else {
        this.bodyRead += this.buffer.length;
        this.packet.body.write( this.buffer, done );
        this.buffer = null;
        return NOT_DONE;
    }
}

Parser.prototype.bodystring = function () {
    if (this.bytes() < this.packet.bodySize) return;
    this.packet.body = this.readBuffer(this.packet.bodySize).toString();
    this.sendPacket(this.packet);
    return this.endPacket();
}

Parser.prototype.admin = function () {
    var lfindex;
    if (-1 != (lfindex = this.bufferIndexOf(this.offset,1024,10))) {
        var cmd = this.buffer.slice(this.offset,lfindex).toString().replace(/^\s+|\s+$/g,'');
        var cmdBytes = (lfindex - this.offset) + 1;
        this.consume(cmdBytes);
        var match;
        if (match = cmd.match(/^OK(?:\s+(.*))?$/)) {
            this.sendPacket({ kind: 'admin', type: Packet.adminTypes['ok'], args: { line: match[1] } });
        }
        else if (match = cmd.match(/^ERR \s+(\S+)(?:\s+(\S+))?/)) {
            this.sendPacket({ kind: 'admin', type: Packet.adminTypes['error'], args: { code: match[1], message: match[2] } });
        }
        else if (cmd === '.') {
            this.sendPacket({ kind: 'admin', type: Packet.adminTypes['block-complete'], args: {} });
        }
        else {
            this.sendPacket({ kind: 'admin', type: Packet.adminTypes['line'], args: { line: cmd } });
        }
        return this.endPacket();
    }
    else if (this.bytes()>=1024) {
        this.emit('error',new Error('An admin command went 1024 characters without a newline'));
        return this.adminSkip;
    }
}

Parser.prototype.adminSkip = function () {
    var lfindex;
    if (-1 != (lfindex = this.bufferIndexOf(this.offset,1024,10))) {
        this.consume(lfindex+1);
        return this.endPacket();
    }
    else {
        this.clearBuffer();
    }
}
