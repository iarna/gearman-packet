"use strict";
var streamify = require('stream-array');
var GearmanPacket = require('./gearman-packet');
var through = require('through2');

// Showing off the round tripping
// Below is are the example packets from the Gearman protocol docs, plus an admin command
// Notice how you can intermix these all without any issues

streamify([
    {kind:'request',  type:GearmanPacket.types['CAN_DO'],        args:{function:'reverse'}},
    {kind:'request',  type:GearmanPacket.types['GRAB_JOB']},
    {kind:'response', type:GearmanPacket.types['NO_JOB']},
    {kind:'request',  type:GearmanPacket.types['PRE_SLEEP']},
    {kind:'request',  type:GearmanPacket.types['SUBMIT_JOB'],    args:{function:'reverse',uniqueid:''},   body:streamify(['test']), bodySize:4},
    {kind:'response', type:GearmanPacket.types['JOB_CREATED'],   args:{job:'H:lap:1'}},
    {kind:'response', type:GearmanPacket.types['NOOP']},
    {kind:'request',  type:GearmanPacket.types['GRAB_JOB']},
    {kind:'response', type:GearmanPacket.types['JOB_ASSIGN'],    args:{job:'H:lap:1',function:'reverse'}, body:'test'},
    {kind:'request',  type:GearmanPacket.types['WORK_COMPLETE'], args:{job:'H:lap:1'},                      body:'tset'},
    {kind:'response', type:GearmanPacket.types['WORK_COMPLETE'], args:{job:'H:lap:1'},                      body:'tset'},
    {kind:'admin', command: 'workers'}
])
.pipe(new GearmanPacket.Emitter())
.pipe(new GearmanPacket.Parser())
.pipe(through.obj(function(packet,enc,done){
    if (packet.type) packet.type = packet.type.name;
    if (!packet.body || !packet.body.read) {
        this.push(JSON.stringify(packet)+"\n");
        done();
        return;
    }
    var body = new Buffer(0);
    packet.body.on('data',function(data){
        body = Buffer.concat([body,data]);
    })
    var self = this;
    packet.body.on('end',function(){
        packet.body = body.toString();
        self.push(JSON.stringify(packet)+"\n");
        done();
    });
}))
.pipe(process.stdout);
