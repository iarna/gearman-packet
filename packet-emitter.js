"use strict";
var stream = require('stream');
var util = require('util');
var Packet = require('./packet-types');

var Emitter = module.exports = function (options) {
    if (!options) options = {};
    stream.Transform.call(this,options);
    this._writableState.objectMode = true;
    this._readableState.objectMode = false;
}
util.inherits(Emitter, stream.Transform);

Emitter.prototype._transform = function (packet, encoding, done) {
    if (packet != null && packet.kind && packet.kind == 'admin') {
        this.encodeAdmin(packet,done);
    }
    else if (packet != null && packet.kind && (packet.kind == 'request' || packet.kind == 'response')) {
        this.tryEncodeGearman(packet,done);
    }
    else if (packet != null && packet.kind) {
        this.emit('error',new Error('Received unknown kind of packet '+packet.kind));
        done();
    }
    else {
        this.emit('error',new Error('Invalid packet, expecting an object with a kind attribute but got ' +
            (packet == null ? 'null' : typeof packet.kind)) );
        done();
    }
}

Emitter.prototype.encodeAdmin = function (packet,done) {
    if (!packet.args) { packet.args = {} }
    if (packet.type.name == 'error') {
        if (packet.args.code) {
            this.push(new Buffer('ERR ' + packet.args.code + (packet.args.message && packet.args.message.length ? ' ' + packet.args.message : '') + '\n'));
        }
        else {
            this.emit('error',new Error('Received invalid error admin packet, missing code argument'));
        }
    }
    else if (packet.type.name == 'ok') {
        this.push(new Buffer('OK' + (packet.args.line && packet.args.line.length ? ' ' + packet.args.line : '') + '\n'));
    }
    else if (packet.type.name == 'block-complete') {
        this.push(new Buffer('.\n'));
    }
    else if (packet.type.name == 'line') {
        if (packet.args.line) {
            this.push(new Buffer(packet.args.line+'\n'));
        }
        else {
            this.emit('error',new Error('Received invalid line admin packet, missing line argument'));
        }
    }
    else {
        this.emit('error',new Error('Received unknown type of admin packet '+packet.type.name));
    }
    done();
}

Emitter.prototype.tryEncodeGearman = function (packet,done) {
    try {
        this.encodeGearman(packet,done);
    }
    catch (e) {
        this.emit('error', e);
        done();
    }
}

Emitter.prototype.encodeGearman = function (packet,done) {
    if (!packet.type) {
        throw new TypeError("Packet missing type in "+util.inspect(packet));
    }
    var args = this.encodeGearmanArgs(packet);
    var body = this.encodeGearmanBody(packet);
    var header = this.encodeGearmanHeader(packet,args.length+body.length);

    if (body instanceof stream.Readable) {
        this.push(Buffer.concat([header,args], header.length+args.length));
        var self = this;
        var emitted = 0;
        body.on('data', function(chunk){
            try {
                var buffer = self.toBuffer(chunk);
                emitted += buffer.length;
                self.push( buffer );
            }
            catch (e) {
                self.emit('error',e);
            }
        });
        body.once('end', function () {
            if (emitted < body.length) {
                var missing = new Buffer(body.length-emitted);
                missing.fill(0);
                self.push(missing);
                self.emit('error',new TypeError('Packet body stream length mismatch, got '+emitted+' bytes, expected '+buffer.length+' in packet '+util.inspect(packet)));
            }
            done();
        });
    }
    else {
        this.push(Buffer.concat([header,args,body], header.length+args.length+body.length));
        done();
    }
}

Emitter.prototype.encodeGearmanHeader = function (packet,argsbodylen) {
    var header = new Buffer(12);
    header[0] = '\0';
    if (packet.kind=='request') {
        header.write('REQ',1,4,'ascii');
    }
    else if (packet.kind=='response') {
        header.write('RES',1,4,'ascii');
    }
    else {
        throw new TypeError('Unknown kind of packet: '+util.inspect(packet.kind));
    }
    header.writeUInt32BE(packet.type.id,4);
    header.writeUInt32BE(argsbodylen,8);
    return header;
}

Emitter.prototype.encodeGearmanArgs = function (packet) {
    var argcount = packet.type.args.length;
    if (argcount && !packet.type.body) -- argcount; // if the final arg is sent as the body
    var args = new Array(argcount);
    var argsbytes = 0;
    for (var ii = 0; ii<argcount; ++ii) {
        var arg = packet.type.args[ii];
        var argvalue = this.toBuffer( packet.args ? packet.args[arg] : null );
        if (argvalue.length > 64) {
            throw new TypeError("Gearman packet "+packet.type.name+" argument #"+ii+" ("+packet.type.argvalue+") was "+argvalue.length+" bytes long, but arguments are limited to 64 bytes");
        }
        args[ii] = Buffer.concat([ argvalue, new Buffer([0]) ], argvalue.length+1);
        argsbytes += args[ii].length;
    }
    return Buffer.concat(args,argsbytes);
}

Emitter.prototype.encodeGearmanBody = function (packet) {
    if (!packet.type.body) {
        if (! packet.type.args.length) {
            return new Buffer(0);
        }
        var arg = packet.type.args[packet.type.args.length-1];
        return this.toBuffer(packet.args ? packet.args[arg] : new Buffer(0));
    }
    else if (packet.body instanceof stream.Readable) {
        if (typeof packet.bodySize == 'number') packet.body.length = packet.bodySize;
        if (packet.body.length == null) {
            throw new TypeError("Streamable gearman packet bodies MUST either have a bodySize passed in with them or a length attribute "+util.inspect(packet));
        }
        return packet.body;
    }
    else {
        return this.toBuffer(packet.body);
    }
}

Emitter.prototype.toBuffer = function (thing) {
    if (Buffer.isBuffer(thing)) {
        return new Buffer(thing);
    }
    else if (thing == null) {
        return new Buffer(0);
    }
    else if (typeof thing.toString == 'function') {
        return new Buffer(thing.toString());
    }
    else {
        throw new TypeError("Do not know how to convert "+typeof(thing)+" to a buffer");
    }
}
